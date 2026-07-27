package handler

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/middleware"
	"github.com/vega-resume/server/internal/model"
	pdfservice "github.com/vega-resume/server/internal/pdf"
	"github.com/vega-resume/server/internal/service"
)

const (
	maxImportBodyBytes      int64 = 2 << 20
	maxResumeWriteBodyBytes int64 = service.MaxResumeContentBytes + (64 << 10)
	maxCreateBodyBytes      int64 = 16 << 10
)

// PdfRenderer prints the page at url into PDF bytes.
type PdfRenderer interface {
	Render(ctx context.Context, url string) ([]byte, error)
}

type ResumeHandlerConfig struct {
	Resumes     *service.ResumeService
	Renderer    PdfRenderer
	PrintTokens *service.PrintTokenService
	WebBaseURL  string
}

type ResumeHandler struct {
	resumes     *service.ResumeService
	renderer    PdfRenderer
	printTokens *service.PrintTokenService
	webBaseURL  string
}

func NewResumeHandler(cfg ResumeHandlerConfig) *ResumeHandler {
	return &ResumeHandler{
		resumes:     cfg.Resumes,
		renderer:    cfg.Renderer,
		printTokens: cfg.PrintTokens,
		webBaseURL:  strings.TrimRight(cfg.WebBaseURL, "/"),
	}
}

func (h *ResumeHandler) ListResumes(c *gin.Context, params generated.ListResumesParams) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	page, pageSize := 1, 6
	query, sortValue := "", "updated_desc"
	var status model.ResumeStatus
	if params.Query != nil {
		query = *params.Query
	}
	if params.Status != nil {
		status = model.ResumeStatus(*params.Status)
	}
	if params.Sort != nil {
		sortValue = string(*params.Sort)
	}
	if params.Page != nil {
		page = *params.Page
	}
	if params.PageSize != nil {
		pageSize = int(*params.PageSize)
	}
	items, total, err := h.resumes.List(c.Request.Context(), userID, service.ListResumesInput{
		Query: query, Status: status, Sort: sortValue, Page: page, PageSize: pageSize,
	})
	if err != nil {
		writeError(c, err)
		return
	}
	summaries := make([]generated.ResumeSummary, 0, len(items))
	for i := range items {
		summaries = append(summaries, resumeSummary(&items[i]))
	}
	c.JSON(http.StatusOK, model.OK(generated.ResumeListPayload{
		Items: summaries, Page: page, PageSize: generated.ResumeListPayloadPageSize(pageSize), Total: total,
	}))
}

func (h *ResumeHandler) CreateResume(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	var body generated.CreateResumeJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxCreateBodyBytes); err != nil && !errors.Is(err, io.EOF) {
		writeError(c, model.ErrInvalidParam)
		return
	}
	title := ""
	if body.Title != nil {
		title = *body.Title
	}
	resume, err := h.resumes.Create(c.Request.Context(), userID, title)
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func (h *ResumeHandler) ImportResume(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	var body generated.ImportResumeJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxImportBodyBytes); err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(c, model.ErrFileTooLarge)
		} else {
			writeError(c, model.ErrResumeInvalidSchema)
		}
		return
	}
	content, err := contentMap(body.Content)
	if err != nil {
		writeError(c, model.ErrResumeInvalidSchema)
		return
	}
	resume, err := h.resumes.Import(c.Request.Context(), userID, service.ImportResumeInput{
		Version: int(body.Version), Title: body.Title, TemplateID: templateIDString(body.TemplateId), Content: content, Avatar: body.Avatar,
	})
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func (h *ResumeHandler) GetResumeStats(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	stats, err := h.resumes.Stats(c.Request.Context(), userID)
	if err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.OK(generated.ResumeStats{
		Total: stats.Total, Draft: stats.Draft, Completed: stats.Completed, Exported: stats.Exported,
	}))
}

func (h *ResumeHandler) GetResume(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	resume, err := h.resumes.Get(c.Request.Context(), userID, uuid.UUID(resumeID))
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func (h *ResumeHandler) UpdateResume(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	var body generated.UpdateResumeJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxResumeWriteBodyBytes); err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}
	var status *model.ResumeStatus
	if body.Status != nil {
		value := model.ResumeStatus(*body.Status)
		status = &value
	}
	resume, err := h.resumes.Update(c.Request.Context(), userID, uuid.UUID(resumeID), service.UpdateResumeInput{
		ExpectedRevision: body.ExpectedRevision, Title: body.Title, Status: status, TemplateID: body.TemplateId,
		Content: generatedContentMap(body.Content),
	})
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func (h *ResumeHandler) ReplaceResumeImport(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	var body generated.ReplaceResumeImportJSONRequestBody
	if err := bindJSONWithLimit(c, &body, maxImportBodyBytes); err != nil {
		writeError(c, model.ErrResumeInvalidSchema)
		return
	}
	content, err := contentMap(body.Content)
	if err != nil {
		writeError(c, model.ErrResumeInvalidSchema)
		return
	}
	resume, err := h.resumes.ReplaceImport(c.Request.Context(), userID, uuid.UUID(resumeID), service.ImportResumeInput{
		Version: int(body.Version), Title: body.Title, TemplateID: replaceTemplateIDString(body.TemplateId),
		Content: content, Avatar: body.Avatar, ExpectedRevision: &body.ExpectedRevision,
	})
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func (h *ResumeHandler) ExportResumePdf(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentVerifiedUserID(c)
	if !ok {
		return
	}
	resume, err := h.resumes.Get(c.Request.Context(), userID, uuid.UUID(resumeID))
	if err != nil {
		writeError(c, err)
		return
	}
	token, err := h.printTokens.Issue(userID, uuid.UUID(resumeID))
	if err != nil {
		writeError(c, err)
		return
	}
	printURL := fmt.Sprintf("%s/print/resumes/%s#token=%s", h.webBaseURL, uuid.UUID(resumeID), url.QueryEscape(token))
	data, err := h.renderer.Render(c.Request.Context(), printURL)
	if err != nil {
		log.Printf("render resume pdf %s: %v", resumeID, err)
		if errors.Is(err, pdfservice.ErrBusy) {
			writeError(c, model.ErrPdfBusy)
			return
		}
		writeError(c, model.ErrPdfRenderFailed)
		return
	}
	if _, err := h.resumes.RecordExport(c.Request.Context(), userID, uuid.UUID(resumeID)); err != nil {
		writeError(c, err)
		return
	}
	c.Header("Content-Disposition", "attachment; filename*=UTF-8''"+url.PathEscape(resume.Title)+".pdf")
	c.Data(http.StatusOK, "application/pdf", data)
}

func (h *ResumeHandler) GetResumePrintData(c *gin.Context, resumeID generated.ResumeId, params generated.GetResumePrintDataParams) {
	userID, tokenResumeID, err := h.printTokens.Consume(params.XPrintToken)
	if err != nil {
		writeError(c, err)
		return
	}
	if tokenResumeID != uuid.UUID(resumeID) {
		writeError(c, model.ErrTokenInvalid)
		return
	}
	resume, err := h.resumes.Get(c.Request.Context(), userID, tokenResumeID)
	if err != nil {
		writeError(c, err)
		return
	}
	detail, err := resumeDetail(resume)
	if err != nil {
		writeError(c, model.ErrInternalServer)
		return
	}
	payload := generated.ResumePrintPayload{Resume: detail}
	if resume.AvatarKey != nil {
		avatar, avatarErr := h.resumes.GetAvatar(c.Request.Context(), userID, tokenResumeID)
		if avatarErr != nil {
			writeError(c, avatarErr)
			return
		}
		dataURL := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(avatar)
		payload.AvatarDataUrl = &dataURL
	}
	c.JSON(http.StatusOK, model.OK(payload))
}

func (h *ResumeHandler) PutResumeAvatar(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	mediaType, _, mediaTypeErr := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if mediaTypeErr != nil || mediaType != "image/jpeg" {
		writeError(c, model.ErrAvatarInvalid)
		return
	}
	data, err := io.ReadAll(io.LimitReader(c.Request.Body, service.MaxAvatarBytes+1))
	if err != nil {
		writeError(c, model.ErrInvalidParam)
		return
	}
	if len(data) > service.MaxAvatarBytes {
		writeError(c, model.ErrFileTooLarge)
		return
	}
	resume, err := h.resumes.PutAvatar(c.Request.Context(), userID, uuid.UUID(resumeID), data)
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func (h *ResumeHandler) GetResumeAvatar(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	data, err := h.resumes.GetAvatar(c.Request.Context(), userID, uuid.UUID(resumeID))
	if err != nil {
		writeError(c, err)
		return
	}
	c.Header("Cache-Control", "private, max-age=300")
	c.Data(http.StatusOK, "image/jpeg", data)
}

func (h *ResumeHandler) DeleteResumeAvatar(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	resume, err := h.resumes.DeleteAvatar(c.Request.Context(), userID, uuid.UUID(resumeID))
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func (h *ResumeHandler) DeleteResume(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	if err := h.resumes.Delete(c.Request.Context(), userID, uuid.UUID(resumeID)); err != nil {
		writeError(c, err)
		return
	}
	c.JSON(http.StatusOK, model.OK[any](nil))
}

func (h *ResumeHandler) CopyResume(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	resume, err := h.resumes.Copy(c.Request.Context(), userID, uuid.UUID(resumeID))
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
}

func currentUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, ok := middleware.CurrentUserID(c)
	if !ok {
		writeError(c, model.ErrUnauthorized)
	}
	return userID, ok
}

func currentVerifiedUserID(c *gin.Context) (uuid.UUID, bool) {
	user, ok := middleware.CurrentUser(c)
	if !ok {
		writeError(c, model.ErrUnauthorized)
		return uuid.Nil, false
	}
	if !user.EmailVerified {
		writeError(c, model.ErrEmailNotVerified)
		return uuid.Nil, false
	}
	userID, err := uuid.Parse(user.ID)
	if err != nil {
		writeError(c, model.ErrUnauthorized)
		return uuid.Nil, false
	}
	return userID, true
}

func resumeSummary(resume *model.Resume) generated.ResumeSummary {
	return generated.ResumeSummary{
		Id: resume.ID, Title: resume.Title, Status: generated.ResumeStatus(resume.Status),
		TemplateId: resume.TemplateID, Revision: resume.Revision, HasAvatar: resume.AvatarKey != nil, ExportCount: resume.ExportCount,
		CreatedAt: resume.CreatedAt, UpdatedAt: resume.UpdatedAt,
	}
}

func resumeDetail(resume *model.Resume) (generated.ResumeDetail, error) {
	content := generated.ResumeContent{}
	if len(resume.ContentJSON) > 0 {
		if err := json.Unmarshal(resume.ContentJSON, &content); err != nil {
			return generated.ResumeDetail{}, err
		}
	}
	summary := resumeSummary(resume)
	return generated.ResumeDetail{
		Id: summary.Id, Title: summary.Title, Status: summary.Status, TemplateId: summary.TemplateId,
		Revision: summary.Revision, HasAvatar: summary.HasAvatar, ExportCount: summary.ExportCount, CreatedAt: summary.CreatedAt, UpdatedAt: summary.UpdatedAt,
		ContentVersion: generated.ResumeDetailContentVersion(resume.ContentVersion), Content: content,
	}, nil
}

func contentMap(content generated.ResumeContent) (map[string]any, error) {
	data, err := json.Marshal(content)
	if err != nil {
		return nil, err
	}
	value := map[string]any{}
	if err := json.Unmarshal(data, &value); err != nil {
		return nil, err
	}
	return value, nil
}

func generatedContentMap(content *generated.ResumeContent) *map[string]any {
	if content == nil {
		return nil
	}
	value, err := contentMap(*content)
	if err != nil {
		return nil
	}
	return &value
}

func templateIDString(value *generated.ImportResumeRequestTemplateId) *string {
	if value == nil {
		return nil
	}
	text := string(*value)
	return &text
}

func replaceTemplateIDString(value *generated.ReplaceResumeImportJSONBodyTemplateId) *string {
	if value == nil {
		return nil
	}
	text := string(*value)
	return &text
}

func writeResume(c *gin.Context, resume *model.Resume) {
	detail, err := resumeDetail(resume)
	if err != nil {
		writeError(c, model.ErrInternalServer)
		return
	}
	c.JSON(http.StatusOK, model.OK(detail))
}
