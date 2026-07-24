package handler_test

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vega-resume/server/internal/model"
	pdfservice "github.com/vega-resume/server/internal/pdf"
	"github.com/vega-resume/server/internal/repository"
	"github.com/vega-resume/server/internal/service"
)

var errAny = errors.New("renderer boom")

func registerAccessToken(t *testing.T, router http.Handler, username, email string) string {
	t.Helper()
	testVerificationCodes.Delete(email)
	response := performJSON(router, http.MethodPost, "/api/auth/register", `{
		"username": "`+username+`",
		"email": "`+email+`",
		"password": "password1",
		"confirmPassword": "password1"
	}`)
	if response.Code != http.StatusOK {
		t.Fatalf("register status=%d body=%s", response.Code, response.Body.String())
	}
	code, ok := testVerificationCodes.Load(email)
	if !ok {
		t.Fatalf("verification code was not sent to %s", email)
	}
	confirmed := performJSON(router, http.MethodPost, "/api/auth/email-verification/confirm", `{
		"email": "`+email+`",
		"code": "`+code.(string)+`"
	}`)
	if confirmed.Code != http.StatusOK {
		t.Fatalf("confirm status=%d body=%s", confirmed.Code, confirmed.Body.String())
	}
	return decodeEnvelope(t, confirmed)["data"].(map[string]any)["accessToken"].(string)
}

func performAuthorizedJSON(router http.Handler, token, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if body != "" {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}

func TestResumeHandlersLifecycleAndStats(t *testing.T) {
	router := newTestRouter(t)
	token := registerAccessToken(t, router, "resume-user", "resume@example.com")

	created := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	if created.Code != http.StatusOK {
		t.Fatalf("create status=%d body=%s", created.Code, created.Body.String())
	}
	createdData := decodeEnvelope(t, created)["data"].(map[string]any)
	resumeID := createdData["id"].(string)
	if createdData["status"] != "draft" {
		t.Fatalf("new resume should be draft: %+v", createdData)
	}

	updated := performAuthorizedJSON(router, token, http.MethodPatch, "/api/resumes/"+resumeID, `{"expectedRevision":1,"title":"控制台简历","status":"completed"}`)
	if updated.Code != http.StatusOK {
		t.Fatalf("update status=%d body=%s", updated.Code, updated.Body.String())
	}

	copied := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes/"+resumeID+"/copy", "")
	if copied.Code != http.StatusOK {
		t.Fatalf("copy status=%d body=%s", copied.Code, copied.Body.String())
	}

	list := performAuthorizedJSON(router, token, http.MethodGet, "/api/resumes?status=draft&page=1&pageSize=6&sort=updated_desc", "")
	if list.Code != http.StatusOK {
		t.Fatalf("list status=%d body=%s", list.Code, list.Body.String())
	}
	listData := decodeEnvelope(t, list)["data"].(map[string]any)
	if listData["total"] != float64(1) {
		t.Fatalf("unexpected filtered list: %+v", listData)
	}

	stats := performAuthorizedJSON(router, token, http.MethodGet, "/api/resumes/stats", "")
	statsData := decodeEnvelope(t, stats)["data"].(map[string]any)
	if statsData["total"] != float64(2) || statsData["draft"] != float64(1) || statsData["completed"] != float64(1) {
		t.Fatalf("unexpected stats: %+v", statsData)
	}

	deleted := performAuthorizedJSON(router, token, http.MethodDelete, "/api/resumes/"+resumeID, "")
	if deleted.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", deleted.Code, deleted.Body.String())
	}
}

func TestResumeHandlersRequireAuthenticationAndIsolateOwners(t *testing.T) {
	router := newTestRouter(t)
	unauthorized := performJSON(router, http.MethodGet, "/api/resumes", "")
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("expected unauthorized list, got %d body=%s", unauthorized.Code, unauthorized.Body.String())
	}

	ownerToken := registerAccessToken(t, router, "owner-user", "owner@example.com")
	otherToken := registerAccessToken(t, router, "other-user", "other@example.com")
	created := performAuthorizedJSON(router, ownerToken, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	read := performAuthorizedJSON(router, otherToken, http.MethodGet, "/api/resumes/"+resumeID, "")
	if read.Code != http.StatusNotFound {
		t.Fatalf("cross-owner read should look missing, got %d body=%s", read.Code, read.Body.String())
	}
}

func TestResumeAvatarAcceptsFiveBySevenJPEG(t *testing.T) {
	router := newTestRouter(t)
	token := registerAccessToken(t, router, "avatar-user", "avatar@example.com")
	created := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	var avatar bytes.Buffer
	if err := jpeg.Encode(
		&avatar,
		image.NewRGBA(image.Rect(0, 0, service.AvatarWidth, service.AvatarHeight)),
		&jpeg.Options{Quality: 82},
	); err != nil {
		t.Fatalf("encode avatar: %v", err)
	}
	request := httptest.NewRequest(
		http.MethodPut,
		"/api/resumes/"+resumeID+"/avatar",
		bytes.NewReader(avatar.Bytes()),
	)
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "image/jpeg; name=avatar.jpg")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("upload avatar status=%d body=%s", response.Code, response.Body.String())
	}
}

func TestExportResumePdfReturnsPdfAndRecordsExport(t *testing.T) {
	renderer := &stubRenderer{data: []byte("%PDF-1.7 stub")}
	router := newTestRouterWithRenderer(t, renderer)
	token := registerAccessToken(t, router, "export-user", "export@example.com")
	created := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	exported := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes/"+resumeID+"/export/pdf", "")
	if exported.Code != http.StatusOK {
		t.Fatalf("export status=%d body=%s", exported.Code, exported.Body.String())
	}
	if got := exported.Header().Get("Content-Type"); got != "application/pdf" {
		t.Fatalf("content type = %q", got)
	}
	if !strings.HasPrefix(exported.Body.String(), "%PDF") {
		t.Fatalf("body is not pdf: %q", exported.Body.String())
	}
	if got := exported.Header().Get("Content-Disposition"); !strings.Contains(got, ".pdf") {
		t.Fatalf("content disposition = %q", got)
	}
	if !strings.HasPrefix(renderer.gotURL, "http://web.test/print/resumes/"+resumeID+"#token=") {
		t.Fatalf("renderer url = %q", renderer.gotURL)
	}
	if strings.Contains(renderer.gotURL, "?") {
		t.Fatalf("print token must not be sent in a query string: %q", renderer.gotURL)
	}

	stats := performAuthorizedJSON(router, token, http.MethodGet, "/api/resumes/stats", "")
	statsData := decodeEnvelope(t, stats)["data"].(map[string]any)
	if statsData["exported"] != float64(1) {
		t.Fatalf("export not recorded: %+v", statsData)
	}
}

func TestExportResumePdfRejectsUnauthorizedAndForeignResumes(t *testing.T) {
	router := newTestRouter(t)
	ownerToken := registerAccessToken(t, router, "pdf-owner", "pdf-owner@example.com")
	otherToken := registerAccessToken(t, router, "pdf-other", "pdf-other@example.com")
	created := performAuthorizedJSON(router, ownerToken, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	anonymous := performJSON(router, http.MethodPost, "/api/resumes/"+resumeID+"/export/pdf", "")
	if anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous export status=%d", anonymous.Code)
	}
	foreign := performAuthorizedJSON(router, otherToken, http.MethodPost, "/api/resumes/"+resumeID+"/export/pdf", "")
	if foreign.Code != http.StatusNotFound {
		t.Fatalf("foreign export status=%d body=%s", foreign.Code, foreign.Body.String())
	}
}

func TestExportResumePdfMapsRendererFailure(t *testing.T) {
	router := newTestRouterWithRenderer(t, &stubRenderer{err: errAny})
	token := registerAccessToken(t, router, "fail-user", "fail@example.com")
	created := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	exported := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes/"+resumeID+"/export/pdf", "")
	if exported.Code != http.StatusInternalServerError {
		t.Fatalf("export status=%d body=%s", exported.Code, exported.Body.String())
	}
	if code := decodeEnvelope(t, exported)["code"]; code != float64(106001) {
		t.Fatalf("error code = %v", code)
	}

	stats := performAuthorizedJSON(router, token, http.MethodGet, "/api/resumes/stats", "")
	if statsData := decodeEnvelope(t, stats)["data"].(map[string]any); statsData["exported"] != float64(0) {
		t.Fatalf("failed export must not be recorded: %+v", statsData)
	}
}

func TestExportResumePdfRejectsQuicklyWhenRendererIsBusy(t *testing.T) {
	router := newTestRouterWithRenderer(t, &stubRenderer{err: pdfservice.ErrBusy})
	token := registerAccessToken(t, router, "busy-user", "busy@example.com")
	created := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	exported := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes/"+resumeID+"/export/pdf", "")
	if exported.Code != http.StatusServiceUnavailable {
		t.Fatalf("export status=%d body=%s", exported.Code, exported.Body.String())
	}
	if code := decodeEnvelope(t, exported)["code"]; code != float64(model.ErrPdfBusy.Code) {
		t.Fatalf("error code = %v", code)
	}
}

type failingExportStore struct {
	*repository.MemoryStore
}

func (s *failingExportStore) IncrementResumeExport(
	_ context.Context,
	_, _ uuid.UUID,
	_ time.Time,
) error {
	return errAny
}

func TestExportResumePdfFailsWhenExportCannotBeRecorded(t *testing.T) {
	renderer := &stubRenderer{data: []byte("%PDF-stub")}
	store := &failingExportStore{MemoryStore: repository.NewMemoryStore()}
	router := newTestRouterWithStoreAndRenderer(t, store, renderer)
	token := registerAccessToken(t, router, "record-fail-user", "record-fail@example.com")
	created := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	exported := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes/"+resumeID+"/export/pdf", "")
	if exported.Code != http.StatusInternalServerError {
		t.Fatalf("export status=%d body=%s", exported.Code, exported.Body.String())
	}
	if code := decodeEnvelope(t, exported)["code"]; code != float64(200002) {
		t.Fatalf("error code = %v", code)
	}
}

func TestGetResumePrintDataAuthorizedByPrintToken(t *testing.T) {
	renderer := &stubRenderer{data: []byte("%PDF-stub")}
	router := newTestRouterWithRenderer(t, renderer)
	token := registerAccessToken(t, router, "print-user", "print@example.com")
	created := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	resumeID := decodeEnvelope(t, created)["data"].(map[string]any)["id"].(string)

	performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes/"+resumeID+"/export/pdf", "")
	printToken := renderer.gotURL[strings.Index(renderer.gotURL, "#token=")+len("#token="):]
	printPath := "/api/resumes/" + resumeID + "/print"

	printed := performPrintJSON(router, printPath, printToken)
	if printed.Code != http.StatusOK {
		t.Fatalf("print data status=%d body=%s", printed.Code, printed.Body.String())
	}
	printData := decodeEnvelope(t, printed)["data"].(map[string]any)
	resume := printData["resume"].(map[string]any)
	if resume["id"] != resumeID {
		t.Fatalf("unexpected print resume: %+v", resume)
	}

	reused := performPrintJSON(router, printPath, printToken)
	if reused.Code != http.StatusUnauthorized {
		t.Fatalf("reused token status=%d body=%s", reused.Code, reused.Body.String())
	}

	invalid := performPrintJSON(router, printPath, "not-a-token")
	if invalid.Code != http.StatusUnauthorized {
		t.Fatalf("invalid token status=%d", invalid.Code)
	}
}

func TestGetResumePrintDataRejectsTokenForOtherResume(t *testing.T) {
	renderer := &stubRenderer{data: []byte("%PDF-stub")}
	router := newTestRouterWithRenderer(t, renderer)
	token := registerAccessToken(t, router, "swap-user", "swap@example.com")
	first := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	firstID := decodeEnvelope(t, first)["data"].(map[string]any)["id"].(string)
	second := performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes", `{}`)
	secondID := decodeEnvelope(t, second)["data"].(map[string]any)["id"].(string)

	performAuthorizedJSON(router, token, http.MethodPost, "/api/resumes/"+firstID+"/export/pdf", "")
	firstToken := renderer.gotURL[strings.Index(renderer.gotURL, "#token=")+len("#token="):]

	swapped := performPrintJSON(router, "/api/resumes/"+secondID+"/print", firstToken)
	if swapped.Code != http.StatusUnauthorized {
		t.Fatalf("token for other resume status=%d body=%s", swapped.Code, swapped.Body.String())
	}
}

func performPrintJSON(router http.Handler, path, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodGet, path, nil)
	request.Header.Set("X-Print-Token", token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}
