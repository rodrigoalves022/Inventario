package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"inventario-agent/internal/config"
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

	return nil
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
