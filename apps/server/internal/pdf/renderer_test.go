package pdf

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

func TestChromeRendererRejectsWhenAdmissionQueueIsFull(t *testing.T) {
	renderer := NewChromeRenderer(Config{Concurrency: 1, MaxQueue: 1})
	renderer.slots <- struct{}{}
	renderer.slots <- struct{}{}

	if _, err := renderer.Render(context.Background(), "http://print.test"); !errors.Is(err, ErrBusy) {
		t.Fatalf("Render() error = %v, want ErrBusy", err)
	}
}

// Requires a locally installed Chrome; opt in with PDF_CHROME_TEST=1.
func TestChromeRendererRender(t *testing.T) {
	if os.Getenv("PDF_CHROME_TEST") == "" {
		t.Skip("set PDF_CHROME_TEST=1 to run the Chrome integration test")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!doctype html><html><head><style>@page { size: A4; margin: 20px; }</style></head>` +
			`<body data-print-ready="true"><h1>打印测试</h1></body></html>`))
	}))
	defer server.Close()

	renderer := NewChromeRenderer(Config{
		ExecPath: os.Getenv("CHROME_EXEC_PATH"),
		Timeout:  30 * time.Second,
	})
	defer renderer.Close()

	data, err := renderer.Render(context.Background(), server.URL)
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if !bytes.HasPrefix(data, []byte("%PDF")) {
		t.Fatalf("output is not a PDF, first bytes: %q", data[:min(8, len(data))])
	}
}

func TestChromeRendererFailsFastOnPageError(t *testing.T) {
	if os.Getenv("PDF_CHROME_TEST") == "" {
		t.Skip("set PDF_CHROME_TEST=1 to run the Chrome integration test")
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!doctype html><html><body data-print-error="boom"></body></html>`))
	}))
	defer server.Close()

	renderer := NewChromeRenderer(Config{
		ExecPath: os.Getenv("CHROME_EXEC_PATH"),
		Timeout:  30 * time.Second,
	})
	defer renderer.Close()

	if _, err := renderer.Render(context.Background(), server.URL); err == nil {
		t.Fatal("want error from printError page, got nil")
	}
}
