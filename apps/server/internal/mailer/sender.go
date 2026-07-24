package mailer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const resendEndpoint = "https://api.resend.com/emails"

type VerificationSender interface {
	SendVerificationCode(ctx context.Context, recipient, code string, ttl time.Duration) error
}

type Config struct {
	Provider     string
	ResendAPIKey string
	From         string
	ProductName  string
	Client       *http.Client
}

func NewVerificationSender(config Config) (VerificationSender, error) {
	switch config.Provider {
	case "console":
		return &ConsoleSender{productName: config.ProductName}, nil
	case "resend":
		if strings.TrimSpace(config.ResendAPIKey) == "" || strings.TrimSpace(config.From) == "" {
			return nil, fmt.Errorf("resend email provider requires RESEND_API_KEY and MAIL_FROM")
		}
		client := config.Client
		if client == nil {
			client = &http.Client{Timeout: 10 * time.Second}
		}
		return &ResendSender{
			apiKey:      config.ResendAPIKey,
			from:        config.From,
			productName: config.ProductName,
			client:      client,
			endpoint:    resendEndpoint,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported EMAIL_PROVIDER %q", config.Provider)
	}
}

type ConsoleSender struct {
	productName string
}

func (s *ConsoleSender) SendVerificationCode(
	_ context.Context,
	recipient, code string,
	ttl time.Duration,
) error {
	log.Printf(
		"%s development verification code recipient=%s code=%s expires_in=%s",
		s.productName,
		recipient,
		code,
		ttl,
	)
	return nil
}

type ResendSender struct {
	apiKey      string
	from        string
	productName string
	client      *http.Client
	endpoint    string
}

type resendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

func (s *ResendSender) SendVerificationCode(
	ctx context.Context,
	recipient, code string,
	ttl time.Duration,
) error {
	minutes := int(ttl.Round(time.Minute) / time.Minute)
	if minutes < 1 {
		minutes = 1
	}
	productName := strings.TrimSpace(s.productName)
	if productName == "" {
		productName = "Resume"
	}
	requestBody, err := json.Marshal(resendEmailRequest{
		From:    s.from,
		To:      []string{recipient},
		Subject: fmt.Sprintf("%s 邮箱验证码", productName),
		HTML: fmt.Sprintf(
			`<p>你的 %s 邮箱验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">%s</p><p>验证码将在 %d 分钟后失效。如果不是你本人操作，请忽略本邮件。</p>`,
			html.EscapeString(productName),
			code,
			minutes,
		),
		Text: fmt.Sprintf(
			"你的 %s 邮箱验证码是：%s。验证码将在 %d 分钟后失效。如果不是你本人操作，请忽略本邮件。",
			productName,
			code,
			minutes,
		),
	})
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(requestBody))
	if err != nil {
		return err
	}
	request.Header.Set("Authorization", "Bearer "+s.apiKey)
	request.Header.Set("Content-Type", "application/json")

	response, err := s.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, response.Body)
		return nil
	}
	body, _ := io.ReadAll(io.LimitReader(response.Body, 4<<10))
	return fmt.Errorf("resend returned status %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
}
