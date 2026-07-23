package service_test

import (
	"testing"

	"github.com/vega-resume/server/internal/service"
)

func TestResumeContentV2FormattingValidation(t *testing.T) {
	content := service.DefaultResumeContent()
	if err := service.ValidateResumeContent(content); err != nil {
		t.Fatalf("default content should be valid: %v", err)
	}

	formatting := content["formatting"].(map[string]any)
	formatting["nameFontSizePx"] = 49
	if err := service.ValidateResumeContent(content); err == nil {
		t.Fatal("out-of-range name font size should be rejected")
	}

	formatting["nameFontSizePx"] = 20
	formatting["lineHeightRatio"] = 1.53
	if err := service.ValidateResumeContent(content); err != nil {
		t.Fatalf("valid decimal line height should be accepted: %v", err)
	}

	margins := formatting["pageMarginPx"].(map[string]any)
	margins["left"] = -1
	if err := service.ValidateResumeContent(content); err == nil {
		t.Fatal("negative page margin should be rejected")
	}

	margins["left"] = 33
	formatting["fontFamily"] = "source-han-serif"
	formatting["accentColor"] = "#123abc"
	if err := service.ValidateResumeContent(content); err != nil {
		t.Fatalf("supported font and custom accent should be accepted: %v", err)
	}

	formatting["accentColor"] = "#12xyz9"
	if err := service.ValidateResumeContent(content); err == nil {
		t.Fatal("invalid custom accent should be rejected")
	}
}

func TestResumeContentV2RejectsLegacyFormatting(t *testing.T) {
	content := service.DefaultResumeContent()
	content["formatting"] = map[string]any{
		"fontSize": "standard", "lineHeight": "standard", "pageMargin": "standard",
		"sectionGap": "standard", "accentColor": "plum",
	}

	if err := service.ValidateResumeContent(content); err == nil {
		t.Fatal("legacy formatting should be rejected")
	}
}
