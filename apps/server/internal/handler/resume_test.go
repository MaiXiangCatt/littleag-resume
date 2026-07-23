package handler_test

import (
	"bytes"
	"image"
	"image/jpeg"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/vega-resume/server/internal/service"
)

func registerAccessToken(t *testing.T, router http.Handler, username, email string) string {
	t.Helper()
	response := performJSON(router, http.MethodPost, "/api/auth/register", `{
		"username": "`+username+`",
		"email": "`+email+`",
		"password": "password1",
		"confirmPassword": "password1"
	}`)
	if response.Code != http.StatusOK {
		t.Fatalf("register status=%d body=%s", response.Code, response.Body.String())
	}
	return decodeEnvelope(t, response)["data"].(map[string]any)["accessToken"].(string)
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
