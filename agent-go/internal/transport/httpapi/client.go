package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"inventario-agent/internal/app/updater"
	"inventario-agent/internal/config"
	"inventario-agent/internal/domain/inventory"
)

type Client struct {
	ServerURL  string
	APIKey     string
	MaxRetries int
	httpClient *http.Client
}

type RegisterOptions struct {
	ServerURL     string
	AdminSecret   string
	Client        string
	EnrollmentKey string
	AgentName     string
}

type RegisterResult struct {
	ID     string `json:"id"`
	APIKey string `json:"apiKey"`
}

func NewClient(serverURL, apiKey string) (*Client, error) {
	normalized, err := config.NormalizeServerURL(serverURL)
	if err != nil {
		return nil, err
	}

	return &Client{
		ServerURL:  normalized,
		APIKey:     apiKey,
		MaxRetries: 3,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}, nil
}

func (c *Client) Send(payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("serializacao JSON: %w", err)
	}

	var lastErr error
	for attempt := 1; attempt <= c.MaxRetries; attempt++ {
		if err := c.doRequest(body); err != nil {
			lastErr = err
			log.Printf("[WARN] Tentativa %d/%d falhou: %v", attempt, c.MaxRetries, err)

			if isAuthError(err) {
				return fmt.Errorf("erro de autenticacao - verifique a API Key: %w", err)
			}

			if attempt < c.MaxRetries {
				backoff := time.Duration(attempt*attempt) * 5 * time.Second
				log.Printf("[INFO] Aguardando %v antes de tentar novamente...", backoff)
				time.Sleep(backoff)
			}
			continue
		}

		return nil
	}

	return fmt.Errorf("todas as %d tentativas falharam. Ultimo erro: %w", c.MaxRetries, lastErr)
}

func Register(options RegisterOptions) (*RegisterResult, error) {
	normalized, err := config.NormalizeServerURL(options.ServerURL)
	if err != nil {
		return nil, err
	}

	if options.AgentName == "" {
		return nil, fmt.Errorf("agentName obrigatorio")
	}

	if options.AdminSecret == "" && (options.Client == "" || options.EnrollmentKey == "") {
		return nil, fmt.Errorf("informe -secret ou o par -client e -key")
	}

	payload := map[string]string{
		"name": options.AgentName,
	}
	if options.Client != "" {
		payload["client"] = options.Client
	}
	if options.EnrollmentKey != "" {
		payload["enrollmentKey"] = options.EnrollmentKey
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("serializacao do registro: %w", err)
	}

	req, err := http.NewRequest("POST", normalized+"/api/agent/register", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	if options.AdminSecret != "" {
		req.Header.Set("X-Admin-Secret", options.AdminSecret)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("conexao com servidor: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return nil, fmt.Errorf("credencial de registro invalida (HTTP 401)")
	}

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("registro falhou HTTP %d: %s", resp.StatusCode, string(body))
	}

	var result RegisterResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

type PendingCommand struct {
	ID     string          `json:"id"`
	Type   string          `json:"type"`
	Params json.RawMessage `json:"params"`
}

type CommandResult struct {
	Status       string `json:"status"` // "done" | "failed"
	Output       string `json:"output,omitempty"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

// PollCommand pergunta ao servidor se ha comando pendente para este agente.
// Retorna nil, nil quando nao ha nada na fila - nao e erro.
func (c *Client) PollCommand() (*PendingCommand, error) {
	req, err := http.NewRequest("GET", c.ServerURL+"/api/agent/commands/pending", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", c.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, &authError{code: resp.StatusCode}
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("servidor retornou %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Command *PendingCommand `json:"command"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result.Command, nil
}

// ReportCommandResult envia o resultado de execucao de volta ao servidor.
func (c *Client) ReportCommandResult(commandID string, result CommandResult) error {
	body, err := json.Marshal(result)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", c.ServerURL+"/api/agent/commands/"+commandID+"/result", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("servidor retornou %d ao reportar resultado: %s", resp.StatusCode, string(body))
	}
	return nil
}

// SendMetrics envia a amostra leve de uso para o ciclo de metricas (~10 min),
// separado do checkin completo (1h). Sem retry: se uma amostra se perder, a
// proxima chega em poucos minutos, e nao vale a pena acumular backoff numa
// serie temporal de alta frequencia.
func (c *Client) SendMetrics(payload *inventory.MetricsPayload) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("serializacao JSON: %w", err)
	}

	req, err := http.NewRequest("POST", c.ServerURL+"/api/agent/metrics", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return &authError{code: resp.StatusCode}
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("servidor retornou %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

func (c *Client) doRequest(body []byte) error {
	req, err := http.NewRequest("POST", c.ServerURL+"/api/agent/checkin", bytes.NewReader(body))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.APIKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return &authError{code: resp.StatusCode}
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("servidor retornou %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		UpdateAvailable bool `json:"updateAvailable"`
		UpdateMetadata  *struct {
			Version string `json:"version"`
			URL     string `json:"url"`
			SHA256  string `json:"sha256"`
		} `json:"updateMetadata"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err == nil {
		if result.UpdateAvailable && result.UpdateMetadata != nil {
			if result.UpdateMetadata.SHA256 == "" {
				log.Printf("[WARN] Atualizacao (v%s) sem hash SHA-256 no payload do servidor - update abortado por seguranca.", result.UpdateMetadata.Version)
			} else {
				log.Printf("[INFO] Atualizacao detectada (v%s). Acionando Updater...", result.UpdateMetadata.Version)
				go triggerAutoUpdate(result.UpdateMetadata.URL, result.UpdateMetadata.SHA256)
			}
		}
	}

	return nil
}

func triggerAutoUpdate(downloadUrl, expectedSHA256 string) {
	updater.RunAsync(downloadUrl, expectedSHA256)
}

type authError struct {
	code int
}

func (e *authError) Error() string {
	return fmt.Sprintf("auth error HTTP %d", e.code)
}

func isAuthError(err error) bool {
	_, ok := err.(*authError)
	return ok
}
