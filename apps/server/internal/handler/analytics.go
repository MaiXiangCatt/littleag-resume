package handler

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/service"
)

const maxAnalyticsBodyBytes int64 = 1 << 10

type AnalyticsHandler struct {
	analytics      *service.AnalyticsService
	allowedOrigins map[string]struct{}
}

func NewAnalyticsHandler(
	analytics *service.AnalyticsService,
	allowedOrigins []string,
) *AnalyticsHandler {
	origins := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		origins[origin] = struct{}{}
	}
	return &AnalyticsHandler{analytics: analytics, allowedOrigins: origins}
}

func (h *AnalyticsHandler) GetAnalyticsConfig(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, generated.AnalyticsConfig{
		Enabled: h.analytics.Enabled(),
		ConsentVersion: generated.AnalyticsConfigConsentVersion(
			service.AnalyticsConsentVersion,
		),
	})
}

func (h *AnalyticsHandler) PostAnalyticsEvent(c *gin.Context) {
	if !h.validWriteRequest(c) {
		return
	}
	var body generated.PostAnalyticsEventJSONRequestBody
	if err := decodeStrictJSON(c, &body, maxAnalyticsBodyBytes); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}
	if body.InstallationId.Version() != 4 || body.EventId.Version() != 4 ||
		!body.EventName.Valid() || !body.Mode.Valid() || !body.ConsentVersion.Valid() {
		writeError(c, model.ErrInvalidParam)
		return
	}
	_, err := h.analytics.Record(c.Request.Context(), service.RecordAnalyticsInput{
		InstallationID: uuid.UUID(body.InstallationId),
		EventID:        uuid.UUID(body.EventId),
		EventName:      string(body.EventName),
		Mode:           string(body.Mode),
		ConsentVersion: string(body.ConsentVersion),
	})
	if err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusAccepted)
}

func (h *AnalyticsHandler) DeleteAnalyticsInstallation(c *gin.Context) {
	if !h.validWriteRequest(c) {
		return
	}
	var body generated.DeleteAnalyticsInstallationJSONRequestBody
	if err := decodeStrictJSON(c, &body, maxAnalyticsBodyBytes); err != nil ||
		body.InstallationId.Version() != 4 {
		writeError(c, model.ErrInvalidParam)
		return
	}
	if err := h.analytics.Delete(
		c.Request.Context(),
		uuid.UUID(body.InstallationId),
	); err != nil {
		writeError(c, err)
		return
	}
	c.Status(http.StatusAccepted)
}

func (h *AnalyticsHandler) validWriteRequest(c *gin.Context) bool {
	contentType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || contentType != "application/json" {
		writeError(c, model.ErrInvalidParam)
		return false
	}
	if len(h.allowedOrigins) == 0 {
		return true
	}
	origin := strings.TrimSpace(c.GetHeader("Origin"))
	if _, ok := h.allowedOrigins[origin]; !ok {
		writeError(c, model.ErrInvalidParam)
		return false
	}
	return true
}

func decodeStrictJSON(c *gin.Context, destination any, limit int64) error {
	if c.Request.ContentLength > limit {
		return &http.MaxBytesError{Limit: limit}
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("analytics request has trailing content")
	}
	return nil
}
