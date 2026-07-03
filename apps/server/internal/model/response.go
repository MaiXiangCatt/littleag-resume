package model

type BaseResponse[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    T      `json:"data"`
}

func OK[T any](data T) BaseResponse[T] {
	return BaseResponse[T]{Code: 0, Message: "", Data: data}
}

func Fail(err *AppError) BaseResponse[any] {
	return BaseResponse[any]{Code: err.Code, Message: err.Message, Data: nil}
}
