package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
)

const (
	AnalyticsConsentVersion       = "1"
	AnalyticsInstallationDayLimit = 100
)

var (
	analyticsEventNames = map[string]struct{}{
		"workspace_activated":  {},
		"resume_created":       {},
		"resume_imported":      {},
		"resume_exported_pdf":  {},
		"resume_exported_json": {},
	}
	analyticsModes = map[string]struct{}{"local": {}, "cloud": {}}
)

type AnalyticsService struct {
	enabled bool
	hashKey []byte
	now     func() time.Time
	store   repository.AnalyticsRepository
}

type AnalyticsServiceConfig struct {
	Enabled bool
	HashKey []byte
	Now     func() time.Time
	Store   repository.AnalyticsRepository
}

type RecordAnalyticsInput struct {
	InstallationID uuid.UUID
	EventID        uuid.UUID
	EventName      string
	Mode           string
	ConsentVersion string
}

func NewAnalyticsService(config AnalyticsServiceConfig) *AnalyticsService {
	if config.Now == nil {
		config.Now = func() time.Time { return time.Now().UTC() }
	}
	return &AnalyticsService{
		enabled: config.Enabled,
		hashKey: append([]byte(nil), config.HashKey...),
		now:     config.Now,
		store:   config.Store,
	}
}

func (s *AnalyticsService) Enabled() bool {
	return s.enabled
}

func (s *AnalyticsService) Record(
	ctx context.Context,
	input RecordAnalyticsInput,
) (repository.AnalyticsRecordResult, error) {
	if err := validateAnalyticsInput(input); err != nil {
		return "", err
	}
	if !s.enabled {
		return repository.AnalyticsRecordQuota, nil
	}
	event := &model.AnalyticsEvent{
		EventID:     input.EventID,
		VisitorHash: s.visitorHash(input.InstallationID),
		EventName:   input.EventName,
		Mode:        input.Mode,
		RecordedAt:  s.now(),
	}
	result, err := s.store.RecordAnalyticsEvent(ctx, event, AnalyticsInstallationDayLimit)
	if err != nil {
		return "", model.ErrDBError
	}
	return result, nil
}

func (s *AnalyticsService) Delete(ctx context.Context, installationID uuid.UUID) error {
	if installationID == uuid.Nil || installationID.Version() != 4 {
		return model.ErrInvalidParam
	}
	if !s.enabled {
		return nil
	}
	if err := s.store.DeleteAnalyticsInstallation(ctx, s.visitorHash(installationID)); err != nil {
		return model.ErrDBError
	}
	return nil
}

func (s *AnalyticsService) Cleanup(ctx context.Context) error {
	if !s.enabled {
		return nil
	}
	if err := s.store.CleanupAnalytics(ctx, s.now()); err != nil {
		return model.ErrDBError
	}
	return nil
}

func (s *AnalyticsService) visitorHash(installationID uuid.UUID) string {
	mac := hmac.New(sha256.New, s.hashKey)
	_, _ = mac.Write([]byte(installationID.String()))
	return hex.EncodeToString(mac.Sum(nil))
}

func validateAnalyticsInput(input RecordAnalyticsInput) error {
	if input.InstallationID == uuid.Nil || input.InstallationID.Version() != 4 ||
		input.EventID == uuid.Nil || input.EventID.Version() != 4 ||
		input.ConsentVersion != AnalyticsConsentVersion {
		return model.ErrInvalidParam
	}
	if _, ok := analyticsEventNames[input.EventName]; !ok {
		return model.ErrInvalidParam
	}
	if _, ok := analyticsModes[input.Mode]; !ok {
		return model.ErrInvalidParam
	}
	return nil
}
