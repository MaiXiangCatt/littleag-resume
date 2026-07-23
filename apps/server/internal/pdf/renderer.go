package pdf

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

type Config struct {
	// ExecPath points at a Chrome/Chromium binary; empty means chromedp looks
	// up the locally installed browser.
	ExecPath string
	// RemoteURL (ws://host:9222) takes precedence over ExecPath when set.
	RemoteURL   string
	Timeout     time.Duration
	Concurrency int
}

// ChromeRenderer keeps one long-lived headless browser and opens a tab per
// Render call. The browser starts lazily on first use and is recreated if it
// dies.
type ChromeRenderer struct {
	cfg Config
	sem chan struct{}

	mu            sync.Mutex
	allocCancel   context.CancelFunc
	browserCtx    context.Context
	browserCancel context.CancelFunc
}

func NewChromeRenderer(cfg Config) *ChromeRenderer {
	if cfg.Timeout <= 0 {
		cfg.Timeout = 30 * time.Second
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 2
	}
	return &ChromeRenderer{cfg: cfg, sem: make(chan struct{}, cfg.Concurrency)}
}

// Render navigates to url, waits until the page flags itself ready via
// document.body.dataset.printReady / printError, and returns the printed PDF.
func (r *ChromeRenderer) Render(ctx context.Context, url string) ([]byte, error) {
	select {
	case r.sem <- struct{}{}:
		defer func() { <-r.sem }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}

	browserCtx, err := r.ensureBrowser()
	if err != nil {
		return nil, err
	}

	tabCtx, cancelTab := chromedp.NewContext(browserCtx)
	defer cancelTab()
	tabCtx, cancelTimeout := context.WithTimeout(tabCtx, r.cfg.Timeout)
	defer cancelTimeout()
	stop := context.AfterFunc(ctx, cancelTimeout)
	defer stop()

	var buf []byte
	err = chromedp.Run(tabCtx,
		chromedp.Navigate(url),
		chromedp.Poll(
			`document.body.dataset.printReady === 'true' || document.body.dataset.printError !== undefined`,
			nil,
			chromedp.WithPollingInterval(100*time.Millisecond),
		),
		chromedp.ActionFunc(func(ctx context.Context) error {
			var pageErr string
			if err := chromedp.Evaluate(`document.body.dataset.printError || ''`, &pageErr).Do(ctx); err == nil && pageErr != "" {
				return fmt.Errorf("print page reported: %s", pageErr)
			}
			var printErr error
			buf, _, printErr = page.PrintToPDF().
				WithPrintBackground(true).
				WithPreferCSSPageSize(true).
				WithMarginTop(0).
				WithMarginRight(0).
				WithMarginBottom(0).
				WithMarginLeft(0).
				Do(ctx)
			return printErr
		}),
	)
	if err != nil {
		return nil, err
	}
	return buf, nil
}

func (r *ChromeRenderer) ensureBrowser() (context.Context, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.browserCtx != nil && r.browserCtx.Err() == nil {
		return r.browserCtx, nil
	}
	r.closeLocked()

	var allocCtx context.Context
	var allocCancel context.CancelFunc
	if r.cfg.RemoteURL != "" {
		allocCtx, allocCancel = chromedp.NewRemoteAllocator(context.Background(), r.cfg.RemoteURL)
	} else {
		opts := append([]chromedp.ExecAllocatorOption{}, chromedp.DefaultExecAllocatorOptions[:]...)
		opts = append(opts, chromedp.NoSandbox, chromedp.Flag("disable-dev-shm-usage", true))
		if r.cfg.ExecPath != "" {
			opts = append(opts, chromedp.ExecPath(r.cfg.ExecPath))
		}
		allocCtx, allocCancel = chromedp.NewExecAllocator(context.Background(), opts...)
	}
	browserCtx, browserCancel := chromedp.NewContext(allocCtx)
	if err := chromedp.Run(browserCtx); err != nil {
		browserCancel()
		allocCancel()
		return nil, fmt.Errorf("start browser: %w", err)
	}
	r.allocCancel = allocCancel
	r.browserCtx = browserCtx
	r.browserCancel = browserCancel
	return browserCtx, nil
}

func (r *ChromeRenderer) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.closeLocked()
}

func (r *ChromeRenderer) closeLocked() {
	if r.browserCancel != nil {
		r.browserCancel()
		r.browserCancel = nil
	}
	if r.allocCancel != nil {
		r.allocCancel()
		r.allocCancel = nil
	}
	r.browserCtx = nil
}
