package handler_test

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/vega-resume/server/internal/handler"
	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/service"
)

type handlerAnalyticsStore struct {
	events int
}

func (s *handlerAnalyticsStore) RecordAnalyticsEvent(
	context.Context,
	*model.AnalyticsEvent,
	int,
) (repository.AnalyticsRecordResult, error) {
	s.events++
	return repository.AnalyticsRecordInserted, nil
}

func (*handlerAnalyticsStore) DeleteAnalyticsInstallation(context.Context, string) error {
	return nil
}

func (*handlerAnalyticsStore) CleanupAnalytics(context.Context, time.Time) error {
	return nil
}

func TestAnalyticsHandlerConfigAndStrictEventValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := &handlerAnalyticsStore{}
	analytics := service.NewAnalyticsService(service.AnalyticsServiceConfig{
		Enabled: true,
		HashKey: []byte("independent-analytics-test-key-32-bytes"),
		Store:   store,
	})
	value := handler.NewAnalyticsHandler(analytics, []string{"https://littleag.example"})

	recorder, context := analyticsContext(http.MethodGet, "/api/analytics/config", nil)
	value.GetAnalyticsConfig(context)
	if recorder.Code != http.StatusOK ||
		recorder.Body.String() != `{"consentVersion":"1","enabled":true}` {
		t.Fatalf("unexpected config response %d %s", recorder.Code, recorder.Body.String())
	}

	validBody := []byte(`{
		"installationId":"58b30f6e-ab68-4cfc-b62e-3665729e4f52",
		"eventId":"7d569f9c-d05b-4c79-8614-1ae01347d54a",
		"eventName":"resume_created",
		"mode":"local",
		"consentVersion":"1"
	}`)
	recorder, context = analyticsContext(http.MethodPost, "/api/analytics/events", validBody)
	context.Request.Header.Set("Content-Type", "application/json")
	context.Request.Header.Set("Origin", "https://littleag.example")
	value.PostAnalyticsEvent(context)
	context.Writer.WriteHeaderNow()
	if recorder.Code != http.StatusAccepted || store.events != 1 {
		t.Fatalf("valid event response=%d body=%s events=%d", recorder.Code, recorder.Body.String(), store.events)
	}

	unknownBody := append(bytes.TrimSuffix(validBody, []byte("}")), []byte(`,"resumeTitle":"secret"}`)...)
	recorder, context = analyticsContext(http.MethodPost, "/api/analytics/events", unknownBody)
	context.Request.Header.Set("Content-Type", "application/json")
	context.Request.Header.Set("Origin", "https://littleag.example")
	value.PostAnalyticsEvent(context)
	if recorder.Code != http.StatusBadRequest || store.events != 1 {
		t.Fatalf("unknown field must fail without storage: %d %s", recorder.Code, recorder.Body.String())
	}

	recorder, context = analyticsContext(http.MethodPost, "/api/analytics/events", validBody)
	context.Request.Header.Set("Content-Type", "application/json")
	context.Request.Header.Set("Origin", "https://evil.example")
	value.PostAnalyticsEvent(context)
	if recorder.Code != http.StatusBadRequest || store.events != 1 {
		t.Fatalf("unlisted origin must fail: %d %s", recorder.Code, recorder.Body.String())
	}
}

func analyticsContext(
	method string,
	path string,
	body []byte,
) (*httptest.ResponseRecorder, *gin.Context) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(method, path, bytes.NewReader(body))
	return recorder, context
}
