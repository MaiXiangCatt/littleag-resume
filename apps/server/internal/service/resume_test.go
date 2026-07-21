package service_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/service"
)

func TestResumeServiceLifecycleAndOwnership(t *testing.T) {
	ctx := context.Background()
	store := repository.NewMemoryStore()
	now := time.Date(2026, 7, 21, 10, 0, 0, 0, time.UTC)
	resumes := service.NewResumeService(service.ResumeServiceConfig{
		Resumes: store,
		Now:     func() time.Time { return now },
	})
	ownerID := uuid.New()
	otherUserID := uuid.New()

	created, err := resumes.Create(ctx, ownerID, "  产品经理简历  ")
	if err != nil {
		t.Fatalf("create resume: %v", err)
	}
	if created.Title != "产品经理简历" || created.Status != model.ResumeStatusDraft {
		t.Fatalf("unexpected created resume: %+v", created)
	}
	if _, err := resumes.Get(ctx, otherUserID, created.ID); !errors.Is(err, model.ErrResumeNotFound) {
		t.Fatalf("cross-user read must look missing, got %v", err)
	}

	completed := model.ResumeStatusCompleted
	newTitle := "高级产品经理简历"
	updated, err := resumes.Update(ctx, ownerID, created.ID, service.UpdateResumeInput{
		Title: &newTitle, Status: &completed,
	})
	if err != nil {
		t.Fatalf("update resume: %v", err)
	}
	if updated.Title != newTitle || updated.Status != completed {
		t.Fatalf("unexpected updated resume: %+v", updated)
	}

	copied, err := resumes.Copy(ctx, ownerID, created.ID)
	if err != nil {
		t.Fatalf("copy resume: %v", err)
	}
	if copied.Status != model.ResumeStatusDraft || copied.Title != newTitle+" - 副本" {
		t.Fatalf("unexpected copied resume: %+v", copied)
	}

	items, total, err := resumes.List(ctx, ownerID, service.ListResumesInput{
		Query: "高级", Status: model.ResumeStatusDraft, Sort: "title_asc", Page: 1, PageSize: 6,
	})
	if err != nil {
		t.Fatalf("list resumes: %v", err)
	}
	if total != 1 || len(items) != 1 || items[0].ID != copied.ID {
		t.Fatalf("unexpected filtered list total=%d items=%+v", total, items)
	}

	stats, err := resumes.Stats(ctx, ownerID)
	if err != nil {
		t.Fatalf("resume stats: %v", err)
	}
	if stats.Total != 2 || stats.Draft != 1 || stats.Completed != 1 {
		t.Fatalf("unexpected stats: %+v", stats)
	}

	if err := resumes.Delete(ctx, ownerID, created.ID); err != nil {
		t.Fatalf("delete resume: %v", err)
	}
	if _, err := resumes.Get(ctx, ownerID, created.ID); !errors.Is(err, model.ErrResumeNotFound) {
		t.Fatalf("deleted resume must look missing, got %v", err)
	}
}

func TestResumeServiceImportsVersionedOpaqueContent(t *testing.T) {
	store := repository.NewMemoryStore()
	resumes := service.NewResumeService(service.ResumeServiceConfig{Resumes: store})
	userID := uuid.New()

	imported, err := resumes.Import(context.Background(), userID, 1, "导入简历", map[string]any{
		"futureField": map[string]any{"nested": true},
	})
	if err != nil {
		t.Fatalf("import resume: %v", err)
	}
	if imported.ContentVersion != 1 || string(imported.ContentJSON) == "{}" {
		t.Fatalf("opaque content was not preserved: %+v", imported)
	}
	if _, err := resumes.Import(context.Background(), userID, 2, "未知版本", map[string]any{}); !errors.Is(err, model.ErrResumeInvalidSchema) {
		t.Fatalf("expected unsupported version error, got %v", err)
	}
}
