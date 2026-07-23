package service

import (
	"fmt"
	"math"
	"strings"
)

const (
	DefaultTemplateID = "modern-editorial"
	ContentVersionV2  = 2
)

var validTemplateIDs = map[string]struct{}{
	"modern-editorial":     {},
	"classic-professional": {},
}

func DefaultResumeContent() map[string]any {
	return map[string]any{
		"profile": map[string]any{
			"fullName": "", "targetRole": "", "phone": "", "email": "", "location": "",
			"links": []any{},
		},
		"sections": []any{
			map[string]any{"id": "summary", "type": "summary", "title": "个人简介", "enabled": true, "text": ""},
			map[string]any{"id": "work", "type": "work", "title": "工作经历", "enabled": true, "items": []any{}},
			map[string]any{"id": "education", "type": "education", "title": "教育背景", "enabled": true, "items": []any{}},
			map[string]any{"id": "project", "type": "project", "title": "项目经历", "enabled": true, "items": []any{}},
			map[string]any{"id": "skills", "type": "skills", "title": "技能", "enabled": true, "items": []any{}},
			map[string]any{"id": "awards", "type": "awards", "title": "奖项荣誉", "enabled": false, "items": []any{}},
		},
		"formatting": map[string]any{
			"nameFontSizePx": 20, "sectionTitleFontSizePx": 16, "entryTitleFontSizePx": 14,
			"bodyFontSizePx": 14, "lineHeightRatio": 1.5,
			"pageMarginPx": map[string]any{"top": 33, "right": 33, "bottom": 33, "left": 33},
			"sectionGapPx": 8, "accentColor": "plum",
		},
	}
}

func ValidateResumeContent(content map[string]any) error {
	if content == nil || len(content) != 3 {
		return fmt.Errorf("content must contain profile, sections and formatting")
	}
	profile, ok := content["profile"].(map[string]any)
	if !ok || !validateProfile(profile) {
		return fmt.Errorf("invalid profile")
	}
	sections, ok := content["sections"].([]any)
	if !ok || len(sections) > 64 || !validateSections(sections) {
		return fmt.Errorf("invalid sections")
	}
	formatting, ok := content["formatting"].(map[string]any)
	if !ok || !validateFormatting(formatting) {
		return fmt.Errorf("invalid formatting")
	}
	return nil
}

func validateProfile(profile map[string]any) bool {
	allowed := map[string]bool{"fullName": true, "targetRole": true, "phone": true, "email": true, "location": true, "links": true}
	if !onlyAllowed(profile, allowed) {
		return false
	}
	for _, key := range []string{"fullName", "targetRole", "phone", "email", "location"} {
		if _, ok := profile[key].(string); !ok {
			return false
		}
	}
	links, ok := profile["links"].([]any)
	if !ok || len(links) > 20 {
		return false
	}
	for _, raw := range links {
		link, ok := raw.(map[string]any)
		if !ok || !stringFields(link, []string{"id", "label", "url"}, nil) {
			return false
		}
	}
	return true
}

func validateFormatting(formatting map[string]any) bool {
	allowed := map[string]bool{
		"nameFontSizePx": true, "sectionTitleFontSizePx": true, "entryTitleFontSizePx": true,
		"bodyFontSizePx": true, "lineHeightRatio": true, "pageMarginPx": true,
		"sectionGapPx": true, "accentColor": true,
	}
	if !onlyAllowed(formatting, allowed) ||
		!integerBetween(formatting["nameFontSizePx"], 12, 48) ||
		!integerBetween(formatting["sectionTitleFontSizePx"], 10, 32) ||
		!integerBetween(formatting["entryTitleFontSizePx"], 8, 28) ||
		!integerBetween(formatting["bodyFontSizePx"], 8, 24) ||
		!numberBetween(formatting["lineHeightRatio"], 1, 2.5) ||
		!integerBetween(formatting["sectionGapPx"], 0, 64) ||
		!oneOf(formatting["accentColor"], "plum", "navy", "teal", "rust", "charcoal") {
		return false
	}
	margins, ok := formatting["pageMarginPx"].(map[string]any)
	if !ok || !onlyAllowed(margins, map[string]bool{"top": true, "right": true, "bottom": true, "left": true}) {
		return false
	}
	for _, key := range []string{"top", "right", "bottom", "left"} {
		if !integerBetween(margins[key], 0, 160) {
			return false
		}
	}
	return true
}

func validateSections(sections []any) bool {
	ids := map[string]bool{}
	builtins := map[string]bool{}
	for _, raw := range sections {
		section, ok := raw.(map[string]any)
		if !ok {
			return false
		}
		id, idOK := section["id"].(string)
		typeName, typeOK := section["type"].(string)
		title, titleOK := section["title"].(string)
		_, enabledOK := section["enabled"].(bool)
		if !idOK || !typeOK || !titleOK || !enabledOK || strings.TrimSpace(id) == "" || strings.TrimSpace(title) == "" || ids[id] {
			return false
		}
		ids[id] = true
		switch typeName {
		case "summary":
			if builtins[typeName] || id != "summary" || !stringFields(section, []string{"id", "type", "title", "text"}, []string{"enabled"}) {
				return false
			}
			builtins[typeName] = true
		case "work", "education", "project", "skills", "awards":
			if builtins[typeName] || id != typeName || !validateItemSection(section, typeName) {
				return false
			}
			builtins[typeName] = true
		case "custom":
			if !validateItemSection(section, typeName) {
				return false
			}
		default:
			return false
		}
	}
	return true
}

func validateItemSection(section map[string]any, typeName string) bool {
	items, ok := section["items"].([]any)
	if !ok || len(items) > 100 || !stringFields(section, []string{"id", "type", "title"}, []string{"enabled", "items"}) {
		return false
	}
	allowed := map[string]bool{"id": true}
	switch typeName {
	case "skills":
		allowed["name"], allowed["level"] = true, true
	case "awards":
		allowed["title"], allowed["issuer"], allowed["date"], allowed["description"] = true, true, true, true
	case "education":
		for _, key := range []string{"school", "major", "degree", "startDate", "endDate", "description"} {
			allowed[key] = true
		}
	case "work":
		for _, key := range []string{"company", "role", "location", "startDate", "endDate", "isCurrent", "description"} {
			allowed[key] = true
		}
	case "project":
		for _, key := range []string{"name", "role", "startDate", "endDate", "isCurrent", "description"} {
			allowed[key] = true
		}
	case "custom":
		for _, key := range []string{"title", "subtitle", "location", "startDate", "endDate", "isCurrent", "description"} {
			allowed[key] = true
		}
	}
	for _, raw := range items {
		item, ok := raw.(map[string]any)
		if !ok || !onlyAllowed(item, allowed) {
			return false
		}
		if id, ok := item["id"].(string); !ok || id == "" {
			return false
		}
		for key, value := range item {
			if key == "id" {
				continue
			}
			if key == "isCurrent" {
				if _, ok := value.(bool); !ok {
					return false
				}
				continue
			}
			if _, ok := value.(string); !ok {
				return false
			}
		}
	}
	return true
}

func ValidTemplateID(templateID string) bool {
	_, ok := validTemplateIDs[templateID]
	return ok
}

func onlyAllowed(values map[string]any, allowed map[string]bool) bool {
	for key := range values {
		if !allowed[key] {
			return false
		}
	}
	return true
}

func stringFields(values map[string]any, stringsRequired []string, otherRequired []string) bool {
	allowed := map[string]bool{}
	for _, key := range stringsRequired {
		allowed[key] = true
		if _, ok := values[key].(string); !ok {
			return false
		}
	}
	for _, key := range otherRequired {
		allowed[key] = true
		if _, ok := values[key]; !ok {
			return false
		}
	}
	return onlyAllowed(values, allowed)
}

func oneOf(value any, choices ...string) bool {
	text, ok := value.(string)
	if !ok {
		return false
	}
	for _, choice := range choices {
		if text == choice {
			return true
		}
	}
	return false
}

func integerBetween(value any, minimum, maximum float64) bool {
	number, ok := numericValue(value)
	return ok && math.Trunc(number) == number && number >= minimum && number <= maximum
}

func numberBetween(value any, minimum, maximum float64) bool {
	number, ok := numericValue(value)
	return ok && number >= minimum && number <= maximum
}

func numericValue(value any) (float64, bool) {
	switch number := value.(type) {
	case int:
		return float64(number), true
	case int64:
		return float64(number), true
	case float64:
		return number, true
	default:
		return 0, false
	}
}
