package model

import "errors"

type AppError struct {
	Code       int
	Message    string
	HTTPStatus int
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) Is(target error) bool {
	var appErr *AppError
	if !errors.As(target, &appErr) {
		return false
	}
	return e.Code == appErr.Code
}

var (
	ErrInvalidParam          = &AppError{Code: 100001, Message: "请求参数格式错误", HTTPStatus: 400}
	ErrMissingParam          = &AppError{Code: 100002, Message: "缺少必填参数", HTTPStatus: 400}
	ErrUnauthorized          = &AppError{Code: 100003, Message: "未登录或 Token 缺失", HTTPStatus: 401}
	ErrTooManyRequests       = &AppError{Code: 100006, Message: "请求过于频繁", HTTPStatus: 429}
	ErrInternalServer        = &AppError{Code: 200001, Message: "服务器内部错误", HTTPStatus: 500}
	ErrDBError               = &AppError{Code: 200002, Message: "数据库操作异常", HTTPStatus: 500}
	ErrEmailExists           = &AppError{Code: 101001, Message: "邮箱已注册", HTTPStatus: 409}
	ErrInvalidCredential     = &AppError{Code: 101002, Message: "邮箱或密码不正确", HTTPStatus: 401}
	ErrTokenExpired          = &AppError{Code: 101003, Message: "Token 已过期，请重新登录", HTTPStatus: 401}
	ErrTokenInvalid          = &AppError{Code: 101004, Message: "Token 无效或已被篡改", HTTPStatus: 401}
	ErrPasswordTooWeak       = &AppError{Code: 101005, Message: "密码强度不足", HTTPStatus: 400}
	ErrEmailFormatInvalid    = &AppError{Code: 101006, Message: "邮箱格式不正确", HTTPStatus: 400}
	ErrUsernameExists        = &AppError{Code: 101007, Message: "用户名已被使用", HTTPStatus: 409}
	ErrUsernameFormatInvalid = &AppError{Code: 101008, Message: "用户名格式不正确", HTTPStatus: 400}
	ErrAccountLocked         = &AppError{Code: 101009, Message: "账号已临时锁定", HTTPStatus: 423}
	ErrRefreshTokenInvalid   = &AppError{Code: 101010, Message: "Refresh Token 无效或已失效", HTTPStatus: 401}
)
