# VegaResume — API 响应规范与错误码设计

**文档状态**: 草稿  
**创建日期**: 2026-07-01  
**所属模块**: 后端通用规范  
**建议落地路径**: `docs/designAndPrd/api_response_and_error_codes.md`

---

## 1. BaseResponse 统一响应结构

所有 API 响应均使用统一的 `BaseResponse` 封装，禁止直接返回裸数据。

### 1.1 结构定义

```go
// apps/server/model/response.go

type BaseResponse[T any] struct {
    Code    int    `json:"code"`
    Message string `json:"message"`
    Data    T      `json:"data"`
}

// 成功响应（code=0，message 为空）
func OK[T any](data T) BaseResponse[T] {
    return BaseResponse[T]{Code: 0, Message: "", Data: data}
}

// 失败响应
func Fail(code int, message string) BaseResponse[any] {
    return BaseResponse[any]{Code: code, Message: message, Data: nil}
}
```

### 1.2 响应示例

**成功**

```json
{
  "code": 0,
  "message": "",
  "data": {
    "token": "eyJhbGci...",
    "user": { "id": "u_123", "email": "user@example.com" }
  }
}
```

**失败**

```json
{
  "code": 101002,
  "message": "邮箱或密码不正确",
  "data": null
}
```

---

## 2. 错误码设计原则

### 2.1 编码结构（6 位十进制）

```
  1  0  2  0  1
  ↑  ↑  ↑  ↑↑↑
  │  │  │   └── 具体错误序号（001–099）
  │  │  └────── 业务模块编号（0–9）
  │  └───────── 保留位（扩展用，固定为 0）
  └──────────── 错误大类（1=客户端，2=服务端，3=第三方依赖）
```

### 2.2 错误大类

| 大类码 | 含义 | 说明 |
|--------|------|------|
| `1` | 客户端错误 | 参数非法、认证失败、权限不足等，由调用方导致 |
| `2` | 服务端错误 | 内部异常、DB 错误等，由服务端导致 |
| `3` | 第三方依赖错误 | 外部服务（邮件、存储、PDF 引擎等）异常 |

### 2.3 业务模块编号

| 模块号 | 模块 |
|--------|------|
| `0` | 通用 / 系统 |
| `1` | 认证（Auth） |
| `2` | 用户（User） |
| `3` | 简历（Resume） |
| `4` | 模板（Template） |
| `5` | 文件 / 导出（File / Export） |
| `6`–`9` | 预留，按需扩展 |

---

## 3. 完整错误码表

### 3.1 通用错误（`100xxx` / `200xxx`）

| 错误码 | 常量名 | HTTP 状态码 | 含义 |
|--------|--------|-------------|------|
| `100001` | `ErrInvalidParam` | 400 | 请求参数格式错误 |
| `100002` | `ErrMissingParam` | 400 | 缺少必填参数 |
| `100003` | `ErrUnauthorized` | 401 | 未登录或 Token 缺失 |
| `100004` | `ErrForbidden` | 403 | 无权访问该资源 |
| `100005` | `ErrNotFound` | 404 | 资源不存在 |
| `100006` | `ErrTooManyRequests` | 429 | 请求过于频繁 |
| `200001` | `ErrInternalServer` | 500 | 服务器内部错误 |
| `200002` | `ErrDBError` | 500 | 数据库操作异常 |

### 3.2 认证模块（`101xxx`）

| 错误码 | 常量名 | HTTP 状态码 | 含义 |
|--------|--------|-------------|------|
| `101001` | `ErrEmailExists` | 409 | 邮箱已注册 |
| `101002` | `ErrInvalidCredential` | 401 | 邮箱或密码不正确 |
| `101003` | `ErrTokenExpired` | 401 | Token 已过期，请重新登录 |
| `101004` | `ErrTokenInvalid` | 401 | Token 无效或已被篡改 |
| `101005` | `ErrPasswordTooWeak` | 400 | 密码强度不足 |
| `101006` | `ErrEmailFormatInvalid` | 400 | 邮箱格式不正确 |
| `101007` | `ErrUsernameExists` | 409 | 用户名已被使用 |
| `101008` | `ErrUsernameFormatInvalid` | 400 | 用户名格式不正确 |
| `101009` | `ErrAccountLocked` | 423 | 账号已临时锁定 |
| `101010` | `ErrRefreshTokenInvalid` | 401 | Refresh Token 无效或已失效 |

### 3.3 用户模块（`102xxx`）

| 错误码 | 常量名 | HTTP 状态码 | 含义 |
|--------|--------|-------------|------|
| `102001` | `ErrUserNotFound` | 404 | 用户不存在 |
| `102002` | `ErrUserAlreadyDeleted` | 400 | 用户已被注销 |

### 3.4 简历模块（`103xxx`）

| 错误码 | 常量名 | HTTP 状态码 | 含义 |
|--------|--------|-------------|------|
| `103001` | `ErrResumeNotFound` | 404 | 简历不存在 |
| `103002` | `ErrResumeNotOwned` | 403 | 无权操作该简历 |
| `103003` | `ErrResumeLimitExceeded` | 400 | 已达到简历数量上限 |
| `103004` | `ErrResumeInvalidSchema` | 400 | 简历数据结构不合法 |

### 3.5 模板模块（`104xxx`）

| 错误码 | 常量名 | HTTP 状态码 | 含义 |
|--------|--------|-------------|------|
| `104001` | `ErrTemplateNotFound` | 404 | 模板不存在 |
| `104002` | `ErrTemplateNotPublished` | 400 | 模板未发布，暂不可用 |

### 3.6 文件 / 导出模块（`105xxx`）

| 错误码 | 常量名 | HTTP 状态码 | 含义 |
|--------|--------|-------------|------|
| `105001` | `ErrExportFailed` | 500 | PDF 导出失败 |
| `105002` | `ErrFileTooLarge` | 400 | 上传文件超过大小限制 |
| `105003` | `ErrUnsupportedFileType` | 400 | 不支持的文件类型 |

---

## 4. Go 后端实现

### 4.1 错误常量定义

```go
// apps/server/model/errors.go

type AppError struct {
    Code       int
    Message    string
    HTTPStatus int
}

var (
    // 通用
    ErrInvalidParam     = &AppError{100001, "请求参数格式错误", 400}
    ErrMissingParam     = &AppError{100002, "缺少必填参数", 400}
    ErrUnauthorized     = &AppError{100003, "未登录或 Token 缺失", 401}
    ErrForbidden        = &AppError{100004, "无权访问该资源", 403}
    ErrNotFound         = &AppError{100005, "资源不存在", 404}
    ErrTooManyRequests  = &AppError{100006, "请求过于频繁", 429}
    ErrInternalServer   = &AppError{200001, "服务器内部错误", 500}
    ErrDBError          = &AppError{200002, "数据库操作异常", 500}

    // 认证
    ErrEmailExists         = &AppError{101001, "邮箱已注册", 409}
    ErrInvalidCredential   = &AppError{101002, "邮箱或密码不正确", 401}
    ErrTokenExpired        = &AppError{101003, "Token 已过期，请重新登录", 401}
    ErrTokenInvalid        = &AppError{101004, "Token 无效或已被篡改", 401}
    ErrPasswordTooWeak     = &AppError{101005, "密码强度不足", 400}
    ErrEmailFormatInvalid  = &AppError{101006, "邮箱格式不正确", 400}
    ErrUsernameExists      = &AppError{101007, "用户名已被使用", 409}
    ErrUsernameFormatInvalid = &AppError{101008, "用户名格式不正确", 400}
    ErrAccountLocked       = &AppError{101009, "账号已临时锁定", 423}
    ErrRefreshTokenInvalid = &AppError{101010, "Refresh Token 无效或已失效", 401}

    // 用户
    ErrUserNotFound       = &AppError{102001, "用户不存在", 404}
    ErrUserAlreadyDeleted = &AppError{102002, "用户已被注销", 400}

    // 简历
    ErrResumeNotFound        = &AppError{103001, "简历不存在", 404}
    ErrResumeNotOwned        = &AppError{103002, "无权操作该简历", 403}
    ErrResumeLimitExceeded   = &AppError{103003, "已达到简历数量上限", 400}
    ErrResumeInvalidSchema   = &AppError{103004, "简历数据结构不合法", 400}

    // 模板
    ErrTemplateNotFound      = &AppError{104001, "模板不存在", 404}
    ErrTemplateNotPublished  = &AppError{104002, "模板未发布，暂不可用", 400}

    // 文件 / 导出
    ErrExportFailed          = &AppError{105001, "PDF 导出失败", 500}
    ErrFileTooLarge          = &AppError{105002, "上传文件超过大小限制", 400}
    ErrUnsupportedFileType   = &AppError{105003, "不支持的文件类型", 400}
)
```

### 4.2 Handler 层统一响应

```go
// apps/server/handler/helper.go

func ResponseOK(c *gin.Context, data any) {
    c.JSON(http.StatusOK, OK(data))
}

func ResponseError(c *gin.Context, err *AppError) {
    c.JSON(err.HTTPStatus, Fail(err.Code, err.Message))
}

// 用法示例（auth handler）
func (h *AuthHandler) Login(c *gin.Context) {
    // ...
    user, err := h.authService.Login(req.Email, req.Password)
    if err != nil {
        ResponseError(c, ErrInvalidCredential)
        return
    }
    ResponseOK(c, LoginResponse{Token: token, User: user})
}
```

---

## 5. 前端对接约定

`http.client.ts` 拦截所有响应，统一处理 `code` 字段：

```typescript
// shared/services/http.client.ts

const TOKEN_EXPIRED_CODES = [101003, 101004]

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options)
    const body: BaseResponse<T> = await res.json()

    if (body.code !== 0) {
        // Token 失效 → 自动退出登录，跳转首页
        if (TOKEN_EXPIRED_CODES.includes(body.code)) {
            useAuthStore.getState().logout()
            window.location.href = '/'
        }
        throw new ApiError(body.code, body.message)
    }

    return body.data
}

// ApiError 供 UI 层 catch 后展示错误信息
export class ApiError extends Error {
    constructor(public code: number, message: string) {
        super(message)
    }
}
```

**约定**：前端业务层统一判断 `code === 0` 表示成功，不依赖 HTTP 状态码做业务判断（HTTP 状态码仅供基础网络层感知）。

---

## 6. 扩展规则

新增错误码时遵守以下规则，保证不产生冲突：

1. **新模块**：在第 3 位取下一个未用编号（当前已用 0–5，新模块从 `6` 开始）
2. **现有模块新增错误**：在该模块的序号末尾递增（如 `103005`、`103006`）
3. **禁止复用**已废弃的错误码（标记为 `deprecated` 注释保留，不删除）
4. **新增错误码必须同步更新本文档**，并在对应的 Go 常量文件中添加注释说明适用场景

---

*文档版本：v1.0 | 最后更新：2026-07-01*
