package service_test

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"os"
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
	if created.ContentVersion != 2 {
		t.Fatalf("new resumes must use content version 2, got %d", created.ContentVersion)
	}
	if _, err := resumes.Get(ctx, otherUserID, created.ID); !errors.Is(err, model.ErrResumeNotFound) {
		t.Fatalf("cross-user read must look missing, got %v", err)
	}

	completed := model.ResumeStatusCompleted
	newTitle := "高级产品经理简历"
	updated, err := resumes.Update(ctx, ownerID, created.ID, service.UpdateResumeInput{
		ExpectedRevision: created.Revision, Title: &newTitle, Status: &completed,
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

func TestResumeServiceRejectsStaleRevisionAndCountsExports(t *testing.T) {
	ctx := context.Background()
	resumes := service.NewResumeService(service.ResumeServiceConfig{Resumes: repository.NewMemoryStore()})
	userID := uuid.New()
	created, err := resumes.Create(ctx, userID, "Revision")
	if err != nil {
		t.Fatalf("create resume: %v", err)
	}
	title := "Updated"
	if _, err := resumes.Update(ctx, userID, created.ID, service.UpdateResumeInput{ExpectedRevision: created.Revision, Title: &title}); err != nil {
		t.Fatalf("first update: %v", err)
	}
	if _, err := resumes.Update(ctx, userID, created.ID, service.UpdateResumeInput{ExpectedRevision: created.Revision, Title: &title}); !errors.Is(err, model.ErrResumeConflict) {
		t.Fatalf("stale update should conflict, got %v", err)
	}
	exported, err := resumes.RecordExport(ctx, userID, created.ID)
	if err != nil || exported.ExportCount != 1 {
		t.Fatalf("record export: resume=%+v err=%v", exported, err)
	}
}

func TestResumeServiceAvatarIsolationCopyAndCleanup(t *testing.T) {
	ctx := context.Background()
	avatarDir := t.TempDir()
	resumes := service.NewResumeService(service.ResumeServiceConfig{Resumes: repository.NewMemoryStore(), AvatarDir: avatarDir})
	ownerID, otherID := uuid.New(), uuid.New()
	created, err := resumes.Create(ctx, ownerID, "Avatar")
	if err != nil {
		t.Fatalf("create resume: %v", err)
	}
	avatar := jpegAvatar(t, service.AvatarWidth, service.AvatarHeight)
	withAvatar, err := resumes.PutAvatar(ctx, ownerID, created.ID, avatar)
	if err != nil || withAvatar.AvatarKey == nil {
		t.Fatalf("put avatar: resume=%+v err=%v", withAvatar, err)
	}
	if _, err := resumes.GetAvatar(ctx, otherID, created.ID); !errors.Is(err, model.ErrResumeNotFound) {
		t.Fatalf("cross-user avatar must look missing, got %v", err)
	}
	copied, err := resumes.Copy(ctx, ownerID, created.ID)
	if err != nil || copied.AvatarKey == nil {
		t.Fatalf("copy avatar: resume=%+v err=%v", copied, err)
	}
	if copiedAvatar, err := resumes.GetAvatar(ctx, ownerID, copied.ID); err != nil || !bytes.Equal(copiedAvatar, avatar) {
		t.Fatalf("copied avatar mismatch: len=%d err=%v", len(copiedAvatar), err)
	}
	originalPath := avatarDir + "/" + *withAvatar.AvatarKey
	if err := resumes.Delete(ctx, ownerID, created.ID); err != nil {
		t.Fatalf("delete resume: %v", err)
	}
	if _, err := os.Stat(originalPath); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("avatar file should be removed, stat err=%v", err)
	}
	if _, err := resumes.PutAvatar(ctx, ownerID, copied.ID, jpegAvatar(t, 300, 300)); !errors.Is(err, model.ErrAvatarInvalid) {
		t.Fatalf("non-500x700 avatar should be rejected, got %v", err)
	}
}

func jpegAvatar(t *testing.T, width, height int) []byte {
	t.Helper()
	canvas := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			canvas.Set(x, y, color.RGBA{R: 132, G: 4, B: 119, A: 255})
		}
	}
	var output bytes.Buffer
	if err := jpeg.Encode(&output, canvas, &jpeg.Options{Quality: 82}); err != nil {
		t.Fatalf("encode avatar: %v", err)
	}
	return output.Bytes()
}

func TestResumeServiceImportsVersionedOpaqueContent(t *testing.T) {
	store := repository.NewMemoryStore()
	resumes := service.NewResumeService(service.ResumeServiceConfig{Resumes: store})
	userID := uuid.New()

	imported, err := resumes.Import(context.Background(), userID, service.ImportResumeInput{
		Version: 2, Title: "导入简历", Content: service.DefaultResumeContent(),
	})
	if err != nil {
		t.Fatalf("import resume: %v", err)
	}
	if imported.ContentVersion != 2 || string(imported.ContentJSON) == "{}" {
		t.Fatalf("opaque content was not preserved: %+v", imported)
	}
	if _, err := resumes.Import(context.Background(), userID, service.ImportResumeInput{Version: 1, Title: "旧版本", Content: service.DefaultResumeContent()}); !errors.Is(err, model.ErrResumeInvalidSchema) {
		t.Fatalf("expected unsupported version error, got %v", err)
	}
}

func TestResumeServiceRejectsLegacyResumeUpdates(t *testing.T) {
	store := repository.NewMemoryStore()
	resumes := service.NewResumeService(service.ResumeServiceConfig{Resumes: store})
	userID := uuid.New()
	legacy := &model.Resume{
		ID: uuid.New(), UserID: userID, Title: "旧简历", Status: model.ResumeStatusDraft,
		ContentVersion: 1, ContentJSON: model.JSONDocument(`{}`), Revision: 1,
	}
	if err := store.CreateResume(context.Background(), legacy); err != nil {
		t.Fatalf("create legacy resume: %v", err)
	}
	title := "不能更新"
	if _, err := resumes.Update(context.Background(), userID, legacy.ID, service.UpdateResumeInput{
		ExpectedRevision: 1,
		Title:            &title,
	}); !errors.Is(err, model.ErrResumeInvalidSchema) {
		t.Fatalf("expected legacy format error, got %v", err)
	}
}
