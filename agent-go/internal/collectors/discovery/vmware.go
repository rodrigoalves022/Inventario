package discovery

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

type VMwareProduct struct {
	Tipo    string // TypeESXi ou TypeVCenter
	Version string // ex: "VMware ESXi 7.0.3 build-18644231"
}

var (
	apiTypeRegex  = regexp.MustCompile(`(?s)<(?:\w+:)?apiType>(.*?)</(?:\w+:)?apiType>`)
	fullNameRegex = regexp.MustCompile(`(?s)<(?:\w+:)?fullName>(.*?)</(?:\w+:)?fullName>`)
)

const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25">
<soapenv:Body><vim25:RetrieveServiceContent>
<vim25:_this type="ServiceInstance">ServiceInstance</vim25:_this>
</vim25:RetrieveServiceContent></soapenv:Body></soapenv:Envelope>`

// queryVMware faz uma consulta SOAP rapida e passiva na porta 443 do host alvo.
// Certificados autoassinados (padrao no ESXi) sao aceitos via InsecureSkipVerify.
func queryVMware(ip string, timeout time.Duration) *VMwareProduct {
	tr := &http.Transport{
		TLSClientConfig:   &tls.Config{InsecureSkipVerify: true},
		DisableKeepAlives: true,
	}
	client := &http.Client{
		Transport: tr,
		Timeout:   timeout,
	}

	url := fmt.Sprintf("https://%s/sdk", ip)
	req, err := http.NewRequest("POST", url, bytes.NewBufferString(soapBody))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "text/xml; charset=utf-8")

	resp, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if err != nil {
		return nil
	}

	return parseVMwareXML(body)
}

// parseVMwareXML extrai apiType e fullName do XML de resposta SOAP do VMware vSphere.
func parseVMwareXML(body []byte) *VMwareProduct {
	apiTypeMatch := apiTypeRegex.FindSubmatch(body)
	if len(apiTypeMatch) < 2 {
		return nil
	}

	apiType := strings.TrimSpace(string(apiTypeMatch[1]))
	version := ""
	if fullNameMatch := fullNameRegex.FindSubmatch(body); len(fullNameMatch) >= 2 {
		version = strings.TrimSpace(string(fullNameMatch[1]))
	}

	switch apiType {
	case "HostAgent":
		if version == "" {
			version = "VMware ESXi"
		}
		return &VMwareProduct{
			Tipo:    TypeESXi,
			Version: version,
		}
	case "VirtualCenter":
		if version == "" {
			version = "VMware vCenter Server"
		}
		return &VMwareProduct{
			Tipo:    TypeVCenter,
			Version: version,
		}
	}

	return nil
}
