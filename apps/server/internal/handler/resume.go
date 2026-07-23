package handler

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/generated"
	"github.com/vega-resume/server/internal/middleware"
	"github.com/vega-resume/server/internal/model"
	"github.com/vega-resume/server/internal/service"
)

const maxImportBodyBytes = 2 << 20

type ResumeHandler struct {
	resumes *service.ResumeService
}

func NewResumeHandler(resumes *service.ResumeService) *ResumeHandler {
	return &ResumeHandler{resumes: resumes}
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
	if err := c.ShouldBindJSON(&body); err != nil && !errors.Is(err, io.EOF) {
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
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImportBodyBytes)
	var body generated.ImportResumeJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
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
	if err := c.ShouldBindJSON(&body); err != nil {
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
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImportBodyBytes)
	var body generated.ReplaceResumeImportJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
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

func (h *ResumeHandler) RecordResumeExport(c *gin.Context, resumeID generated.ResumeId) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	resume, err := h.resumes.RecordExport(c.Request.Context(), userID, uuid.UUID(resumeID))
	if err != nil {
		writeError(c, err)
		return
	}
	writeResume(c, resume)
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
