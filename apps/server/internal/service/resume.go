package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
)

const (
	DefaultResumeTitle  = "未命名简历"
	MaxResumeTitleRunes = 80
)

type ResumeService struct {
	resumes repository.ResumeRepository
	now     func() time.Time
}

type ResumeServiceConfig struct {
	Resumes repository.ResumeRepository
	Now     func() time.Time
}

type ListResumesInput struct {
	Query    string
	Status   model.ResumeStatus
	Sort     string
	Page     int
	PageSize int
}

type UpdateResumeInput struct {
	Title      *string
	Status     *model.ResumeStatus
	TemplateID *string
	Content    *map[string]any
}

func NewResumeService(config ResumeServiceConfig) *ResumeService {
	if config.Now == nil {
		config.Now = func() time.Time { return time.Now().UTC() }
	}
	return &ResumeService{resumes: config.Resumes, now: config.Now}
}

func (s *ResumeService) Create(ctx context.Context, userID uuid.UUID, title string) (*model.Resume, error) {
	if strings.TrimSpace(title) == "" {
		title = DefaultResumeTitle
	}
	validatedTitle, err := validateResumeTitle(title)
	if err != nil {
		return nil, err
	}
	now := s.now()
	resume := &model.Resume{
		ID:             uuid.New(),
		UserID:         userID,
		Title:          validatedTitle,
		Status:         model.ResumeStatusDraft,
		ContentVersion: 1,
		ContentJSON:    model.JSONDocument("{}"),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.resumes.CreateResume(ctx, resume); err != nil {
		return nil, model.ErrDBError
	}
	return resume, nil
}

func (s *ResumeService) Import(ctx context.Context, userID uuid.UUID, version int, title string, content map[string]any) (*model.Resume, error) {
	if version != 1 || content == nil {
		return nil, model.ErrResumeInvalidSchema
	}
	validatedTitle, err := validateResumeTitle(title)
	if err != nil {
		return nil, model.ErrResumeInvalidSchema
	}
	contentJSON, err := json.Marshal(content)
	if err != nil {
		return nil, model.ErrResumeInvalidSchema
	}
	now := s.now()
	resume := &model.Resume{
		ID:             uuid.New(),
		UserID:         userID,
		Title:          validatedTitle,
		Status:         model.ResumeStatusDraft,
		ContentVersion: version,
		ContentJSON:    model.JSONDocument(contentJSON),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.resumes.CreateResume(ctx, resume); err != nil {
		return nil, model.ErrDBError
	}
	return resume, nil
}

func (s *ResumeService) Get(ctx context.Context, userID, resumeID uuid.UUID) (*model.Resume, error) {
	resume, err := s.resumes.FindResumeByID(ctx, userID, resumeID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil, model.ErrResumeNotFound
	}
	if err != nil {
		return nil, model.ErrDBError
	}
	return resume, nil
}

func (s *ResumeService) List(ctx context.Context, userID uuid.UUID, input ListResumesInput) ([]model.Resume, int, error) {
	if input.Page < 1 || !validPageSize(input.PageSize) || !validSort(input.Sort) || !validResumeStatus(input.Status, true) {
		return nil, 0, model.ErrInvalidParam
	}
	if utf8.RuneCountInString(input.Query) > MaxResumeTitleRunes {
		return nil, 0, model.ErrInvalidParam
	}
	items, total, err := s.resumes.ListResumes(ctx, userID, repository.ResumeListOptions{
		Query:  strings.TrimSpace(input.Query),
		Status: input.Status,
		Sort:   input.Sort,
		Offset: (input.Page - 1) * input.PageSize,
		Limit:  input.PageSize,
	})
	if err != nil {
		return nil, 0, model.ErrDBError
	}
	return items, total, nil
}

func (s *ResumeService) Update(ctx context.Context, userID, resumeID uuid.UUID, input UpdateResumeInput) (*model.Resume, error) {
	if input.Title == nil && input.Status == nil && input.TemplateID == nil && input.Content == nil {
		return nil, model.ErrInvalidParam
	}
	resume, err := s.Get(ctx, userID, resumeID)
	if err != nil {
		return nil, err
	}
	if input.Title != nil {
		resume.Title, err = validateResumeTitle(*input.Title)
		if err != nil {
			return nil, err
		}
	}
	if input.Status != nil {
		if !validResumeStatus(*input.Status, false) {
			return nil, model.ErrInvalidParam
		}
		resume.Status = *input.Status
	}
	if input.TemplateID != nil {
		templateID := strings.TrimSpace(*input.TemplateID)
		if utf8.RuneCountInString(templateID) > 80 {
			return nil, model.ErrInvalidParam
		}
		if templateID == "" {
			resume.TemplateID = nil
		} else {
			resume.TemplateID = &templateID
		}
	}
	if input.Content != nil {
		content, marshalErr := json.Marshal(*input.Content)
		if marshalErr != nil {
			return nil, model.ErrResumeInvalidSchema
		}
		resume.ContentJSON = model.JSONDocument(content)
	}
	resume.UpdatedAt = s.now()
	if err := s.resumes.UpdateResume(ctx, resume); errors.Is(err, repository.ErrNotFound) {
		return nil, model.ErrResumeNotFound
	} else if err != nil {
		return nil, model.ErrDBError
	}
	return resume, nil
}

func (s *ResumeService) Copy(ctx context.Context, userID, resumeID uuid.UUID) (*model.Resume, error) {
	source, err := s.Get(ctx, userID, resumeID)
	if err != nil {
		return nil, err
	}
	now := s.now()
	copy := &model.Resume{
		ID:             uuid.New(),
		UserID:         userID,
		Title:          copyTitle(source.Title),
		Status:         model.ResumeStatusDraft,
		TemplateID:     source.TemplateID,
		ContentVersion: source.ContentVersion,
		ContentJSON:    append(model.JSONDocument(nil), source.ContentJSON...),
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := s.resumes.CreateResume(ctx, copy); err != nil {
		return nil, model.ErrDBError
	}
	return copy, nil
}

func (s *ResumeService) Delete(ctx context.Context, userID, resumeID uuid.UUID) error {
	if err := s.resumes.DeleteResume(ctx, userID, resumeID); errors.Is(err, repository.ErrNotFound) {
		return model.ErrResumeNotFound
	} else if err != nil {
		return model.ErrDBError
	}
	return nil
}

func (s *ResumeService) Stats(ctx context.Context, userID uuid.UUID) (repository.ResumeStats, error) {
	stats, err := s.resumes.GetResumeStats(ctx, userID)
	if err != nil {
		return repository.ResumeStats{}, model.ErrDBError
	}
	return stats, nil
}

func validateResumeTitle(title string) (string, error) {
	trimmed := strings.TrimSpace(title)
	if trimmed == "" || utf8.RuneCountInString(trimmed) > MaxResumeTitleRunes {
		return "", model.ErrInvalidParam
	}
	return trimmed, nil
}

func validPageSize(value int) bool {
	return value == 6 || value == 12 || value == 24
}

func validSort(value string) bool {
	return value == "updated_desc" || value == "updated_asc" || value == "created_desc" || value == "title_asc"
}

func validResumeStatus(status model.ResumeStatus, optional bool) bool {
	return optional && status == "" || status == model.ResumeStatusDraft || status == model.ResumeStatusCompleted
}

func copyTitle(title string) string {
	const suffix = " - 副本"
	limit := MaxResumeTitleRunes - utf8.RuneCountInString(suffix)
	runes := []rune(strings.TrimSpace(title))
	if len(runes) > limit {
		runes = runes[:limit]
	}
	return string(runes) + suffix
}
