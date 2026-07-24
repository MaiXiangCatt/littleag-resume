package server

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestTrustedProxiesIgnoreForwardedHeadersFromUntrustedClients(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if err := router.SetTrustedProxies([]string{"127.0.0.1"}); err != nil {
		t.Fatalf("set trusted proxies: %v", err)
	}
	router.GET("/ip", func(c *gin.Context) {
		c.String(http.StatusOK, c.ClientIP())
	})

	request := httptest.NewRequest(http.MethodGet, "/ip", nil)
	request.RemoteAddr = "203.0.113.10:1234"
	request.Header.Set("X-Forwarded-For", "198.51.100.20")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Body.String() != "203.0.113.10" {
		t.Fatalf("ClientIP() = %q, want direct peer IP", response.Body.String())
	}
}

func TestTrustedProxiesAcceptForwardedHeadersFromConfiguredProxy(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	if err := router.SetTrustedProxies([]string{"127.0.0.1"}); err != nil {
		t.Fatalf("set trusted proxies: %v", err)
	}
	router.GET("/ip", func(c *gin.Context) {
		c.String(http.StatusOK, c.ClientIP())
	})

	request := httptest.NewRequest(http.MethodGet, "/ip", nil)
	request.RemoteAddr = "127.0.0.1:1234"
	request.Header.Set("X-Forwarded-For", "198.51.100.20")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Body.String() != "198.51.100.20" {
		t.Fatalf("ClientIP() = %q, want forwarded client IP", response.Body.String())
	}
}
