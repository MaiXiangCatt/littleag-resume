package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/middleware"
	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/service"
)

func newTestRouter(t *testing.T) *gin.Engine {
	return newTestRouterWithRenderer(t, &stubRenderer{data: []byte("%PDF-stub")})
}

func newTestRouterWithRenderer(t *testing.T, renderer handler.PdfRenderer) *gin.Engine {
	t.Helper()

	store := repository.NewMemoryStore()
	return newTestRouterWithStoreAndRenderer(t, store, renderer)
}

type testStore interface {
	repository.UserRepository
	repository.RefreshTokenRepository
	repository.ResumeRepository
}

func newTestRouterWithStoreAndRenderer(
	t *testing.T,
	store testStore,
	renderer handler.PdfRenderer,
) *gin.Engine {
	t.Helper()

	gin.SetMode(gin.TestMode)
	auth := service.NewAuthService(service.AuthServiceConfig{
		Users:            store,
		RefreshTokens:    store,
		AccessTokenKey:   []byte("test-access-secret-with-enough-length"),
		AccessTokenTTL:   15 * time.Minute,
		RefreshTokenTTL:  7 * 24 * time.Hour,
		AccountLockLimit: 5,
		AccountLockTTL:   15 * time.Minute,
	})
	resumes := service.NewResumeService(service.ResumeServiceConfig{Resumes: store})

	router := gin.New()
	generated.RegisterHandlersWithOptions(router, handler.NewAPIHandler(
		handler.NewAuthHandler(auth),
		handler.NewResumeHandler(handler.ResumeHandlerConfig{
			Resumes:     resumes,
			Renderer:    renderer,
			PrintTokens: service.NewPrintTokenService(time.Minute),
			WebBaseURL:  "http://web.test",
		}),
	), generated.GinServerOptions{
		Middlewares:  []generated.MiddlewareFunc{middleware.Authenticate(auth)},
		ErrorHandler: handler.GeneratedErrorHandler,
	})
	return router
}

type stubRenderer struct {
	data   []byte
	err    error
	gotURL string
}

func (s *stubRenderer) Render(_ context.Context, url string) ([]byte, error) {
	s.gotURL = url
	if s.err != nil {
		return nil, s.err
	}
	return s.data, nil
}

func performJSON(router http.Handler, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func decodeEnvelope(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var payload map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v; body=%s", err, w.Body.String())
	}
	return payload
}

func TestAuthHandlersRegisterLoginMeRefreshAndLogout(t *testing.T) {
	router := newTestRouter(t)

	register := performJSON(router, http.MethodPost, "/api/auth/register", `{
		"username": "zhangsan",
		"email": "user@example.com",
		"password": "password1",
		"confirmPassword": "password1"
	}`)
	if register.Code != http.StatusOK {
		t.Fatalf("register status=%d body=%s", register.Code, register.Body.String())
	}
	if got := register.Result().Cookies(); len(got) != 1 || got[0].Name != "refresh_token" || !got[0].HttpOnly {
		t.Fatalf("expected HttpOnly refresh cookie, got %+v", got)
	}
	registerBody := decodeEnvelope(t, register)
	if registerBody["code"] != float64(0) || registerBody["message"] != "" {
		t.Fatalf("unexpected register envelope: %+v", registerBody)
	}
	accessToken := registerBody["data"].(map[string]any)["accessToken"].(string)

	meReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+accessToken)
	me := httptest.NewRecorder()
	router.ServeHTTP(me, meReq)
	if me.Code != http.StatusOK {
		t.Fatalf("me status=%d body=%s", me.Code, me.Body.String())
	}
	meBody := decodeEnvelope(t, me)
	if meBody["data"].(map[string]any)["email"] != "user@example.com" {
		t.Fatalf("unexpected me response: %+v", meBody)
	}

	login := performJSON(router, http.MethodPost, "/api/auth/login", `{
		"email": "user@example.com",
		"password": "password1"
	}`)
	if login.Code != http.StatusOK {
		t.Fatalf("login status=%d body=%s", login.Code, login.Body.String())
	}
	loginCookie := login.Result().Cookies()[0]

	refreshReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	refreshReq.AddCookie(loginCookie)
	refresh := httptest.NewRecorder()
	router.ServeHTTP(refresh, refreshReq)
	if refresh.Code != http.StatusOK {
		t.Fatalf("refresh status=%d body=%s", refresh.Code, refresh.Body.String())
	}
	if refresh.Result().Cookies()[0].Value == loginCookie.Value {
		t.Fatalf("expected rotated refresh token cookie")
	}

	logoutReq := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	logoutReq.AddCookie(refresh.Result().Cookies()[0])
	logout := httptest.NewRecorder()
	router.ServeHTTP(logout, logoutReq)
	if logout.Code != http.StatusOK {
		t.Fatalf("logout status=%d body=%s", logout.Code, logout.Body.String())
	}
	if logout.Result().Cookies()[0].MaxAge >= 0 {
		t.Fatalf("logout should clear refresh cookie, got %+v", logout.Result().Cookies()[0])
	}
}

func TestAuthHandlersErrorEnvelopeAndStatusCodes(t *testing.T) {
	router := newTestRouter(t)

	badRegister := performJSON(router, http.MethodPost, "/api/auth/register", `{
		"username": "!",
		"email": "bad@example.com",
		"password": "password1",
		"confirmPassword": "password1"
	}`)
	if badRegister.Code != http.StatusBadRequest {
		t.Fatalf("bad register status=%d body=%s", badRegister.Code, badRegister.Body.String())
	}
	body := decodeEnvelope(t, badRegister)
	if body["code"] != float64(model.ErrUsernameFormatInvalid.Code) || body["data"] != nil {
		t.Fatalf("unexpected error envelope: %+v", body)
	}

	refresh := performJSON(router, http.MethodPost, "/api/auth/refresh", `{}`)
	if refresh.Code != http.StatusUnauthorized {
		t.Fatalf("refresh status=%d body=%s", refresh.Code, refresh.Body.String())
	}
	body = decodeEnvelope(t, refresh)
	if body["code"] != float64(model.ErrRefreshTokenInvalid.Code) || body["data"] != nil {
		t.Fatalf("unexpected refresh error envelope: %+v", body)
	}
}
