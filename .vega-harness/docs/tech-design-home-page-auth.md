# Home Page Auth 技术设计

## 背景与输入

本技术设计服务 Vega Full workflow 需求 `home-page-auth`，基于以下已批准输入：

- PRD：`.vega-harness/docs/prd-home-page-auth.md`
- Brainstorm：`.vega-harness/docs/brainstorm-home-page-auth.md`
- 统一响应规范：`docs/designAndPrd/api_response_and_error_codes.md`
- 仓库约束：`AGENTS.md`、`CLAUDE.md`、`Makefile`

需求目标是把当前 Vite 示例页替换为 VegaResume 首页，并完成真实认证 MVP：前端 Home Page、AuthModal、最小 Console、OpenAPI 契约、Go/Gin 后端、PostgreSQL 持久化、bcrypt 密码、Access/Refresh 双 Token、接口生成同步。

## 现有架构与约束

当前代码事实：

- 前端入口在 `apps/web/src/main.tsx` 和 `apps/web/src/App.tsx`，目前仍是 Vite 示例。
- 前端依赖仅包含 `react`、`react-dom` 和 Vite/TypeScript/ESLint 基础依赖，尚未接入 React Router、Zustand、Tailwind、shadcn/ui、表单、zod 或 OpenAPI client 生成。
- 后端入口在 `apps/server/cmd/api/main.go`，目前只输出 Hello World。
- 后端 `apps/server/go.mod` 是独立 Go module，不得在 `apps/server/` 下添加 `package.json`。
- `contracts/openapi/` 目前只有 `.gitkeep`。
- `Makefile` 是命令入口；当前 `generate` 目标引用 `../../contracts/openapi.yaml`，而仓库结构要求契约位于 `contracts/openapi/`，后续需要统一到 `contracts/openapi/openapi.yaml`。
- `openspec/config.yaml` 当前使用 `schema: spec-driven`。

仓库约束：

- API 变更必须走 OpenSpec 与 OpenAPI。
- OpenAPI 是 JS 与 Go 的唯一桥梁。
- 后续实现必须 TDD，优先使用 Makefile 目标：`make spec-check`、`make generate`、`make test-web`、`make test-server`、`make build`。
- 前端遵守五层架构：展示层、hooks、services、store、models。
- 后端遵守 handler、service、repository、model 分层。

## 技术目标与非目标

目标：

- 建立 `contracts/openapi/openapi.yaml` 作为本需求的 OpenAPI 3.1 契约路径。
- 通过 OpenAPI 描述 `register/login/me/refresh/logout` 五个认证接口。
- 修正或补齐生成配置，使 `make generate` 能从同一契约生成前端 client 和 Go stub。
- 前端新增首页、AuthModal、最小 Console、认证 store、认证 hooks 和 API service。
- 后端新增 Gin API、统一响应、错误码、认证 handler/service/repository/model。
- PostgreSQL 持久化 users 和 refresh_tokens。
- Access Token 15 分钟内存保存；Refresh Token 7 天 HttpOnly Cookie 保存并服务端存 hash。
- `/refresh` 每次成功都轮换 Refresh Token。
- 登录失败账号维度 5 次锁定 15 分钟；Gin 全局 IP 内存限流。

非目标：

- 不实现简历编辑器、模板列表、头像上传、邮件验证、找回密码、账号删除接口或完整 Console 业务。
- 不实现多实例共享限流。
- 不引入 sqlc 等额外数据库代码生成工具。
- 不在 tech_design 阶段创建 OpenSpec change、写实现代码、写测试或登记模块。

## 方案比较与最终选择

### 方案 A：契约优先 + 轻量分层实现

OpenAPI 放在 `contracts/openapi/openapi.yaml`，同步修正 Makefile/generator 配置。前端使用生成 client，加轻量 `fetch` wrapper 和认证 store；后端使用 Gin、`database/sql`、pgx driver、手写 repository、SQL migration；Refresh Token 只持久化 hash。

收益：

- 贴合当前空骨架，依赖数量可控。
- 保持契约优先，符合 `CLAUDE.md`。
- 前端、后端、契约、集成可以在 breakdown 阶段清晰拆分。
- 手写 repository 对当前简单数据模型更直接，回滚成本低。

代价：

- repository SQL 需要手写测试覆盖。
- OpenAPI 生成配置需要一次性补齐。

### 方案 B：生成优先 + 强类型后端

OpenAPI + oapi-codegen 生成 server interface，数据库使用 sqlc 生成 query 层。

收益是类型更强；代价是当前仓库初始阶段需要同时集成 OpenAPI 生成、sqlc、migration 和前端生成，工具链复杂度高。

### 方案 C：快速手写 API + 后补契约

先手写前后端接口和数据库，再补 OpenAPI。

收益是短期实现快；代价是违反契约驱动约束，前后端接口 shape 容易漂移。

最终选择：方案 A。

## 总体架构

请求链路：

```text
Home/AuthModal/Console UI
  -> hooks/useAuth*, useHomeGuard
  -> services/http.client + generated OpenAPI client
  -> /api/auth/*
  -> Gin router
  -> auth handler
  -> auth service
  -> user/session repositories
  -> PostgreSQL
```

认证状态链路：

```text
register/login
  -> response data.accessToken
  -> auth store memory state
  -> Set-Cookie refresh_token HttpOnly

app bootstrap/protected route
  -> if access token missing, POST /api/auth/refresh with credentials
  -> store new access token
  -> GET /api/auth/me

logout
  -> POST /api/auth/logout with refresh cookie
  -> server revokes refresh token and clears cookie
  -> frontend clears memory state
```

## 前端设计

### 目录结构

采用 `CLAUDE.md` 的五层架构命名，落在 `apps/web/src/`：

```text
apps/web/src/
├── ui/
│   ├── App.tsx
│   ├── shared/AppHeader/
│   ├── pages/home/
│   └── pages/console/
├── hooks/
│   ├── useAuth.ts
│   ├── useAuthBootstrap.ts
│   └── useHomeGuard.ts
├── services/
│   ├── generated/
│   ├── http.client.ts
│   └── auth.service.ts
├── store/
│   └── auth.store.ts
├── models/
│   ├── api.model.ts
│   └── auth.model.ts
└── main.tsx
```

说明：

- PRD 中的 `pages/home/components` 可以映射到 `ui/pages/home/components`，避免与五层架构冲突。
- `AppHeader` 是跨页面共享 UI，放 `ui/shared/AppHeader/`。
- AuthModal 仅 Home Page 使用，放 `ui/pages/home/components/AuthModal/`。
- 最小 Console 页面放 `ui/pages/console/ConsolePage.tsx`。

### 依赖与配置

后续实现需要在 `apps/web/package.json` 补齐：

- 路由：`react-router-dom`
- 状态：`zustand`
- 表单：`react-hook-form`、`zod`、`@hookform/resolvers`
- UI 与样式：`tailwindcss`、`shadcn/ui` 所需 Radix 组件、`lucide-react`、`class-variance-authority`、`clsx`、`tailwind-merge`
- API 生成：`orval` 或仓库约定生成工具
- 测试：`vitest`、`@testing-library/react`、`@testing-library/user-event`、`jsdom`，必要时补 Playwright 配置

`main.tsx` 应挂载 Router，并在根组件执行认证恢复。`App.tsx` 不再承载 Vite 示例内容，而是负责路由表或应用壳层。

### 路由

最小路由：

- `/` -> `HomePage`
- `/console` -> `ConsolePage`

`HomePage` 使用 `useHomeGuard`：当认证状态为 authenticated 时跳转 `/console`；未认证或恢复失败时渲染首页。

`ConsolePage` 是受保护页面。进入时如果没有 Access Token，则先通过 `useAuthBootstrap` 调用 `/refresh`；恢复失败时跳转 `/`。

### 认证状态

`store/auth.store.ts` 保存：

- `accessToken: string | null`
- `user: AuthUser | null`
- `status: 'unknown' | 'authenticated' | 'anonymous'`
- 纯 action：`setSession(accessToken, user)`、`setAccessToken(accessToken)`、`setUser(user)`、`clearSession()`、`setStatus(status)`

Access Token 只在内存 store 保存，不写 localStorage 或 sessionStorage。

### HTTP 与刷新策略

`services/http.client.ts` 负责：

- 注入 `Authorization: Bearer <accessToken>`。
- 对 refresh/logout 请求设置 `credentials: 'include'`。
- 解析 `{ code, message, data }`。
- `code !== 0` 时抛出 `ApiError(code, message)`。
- 对 `101003`、`101004` 触发单次 refresh 重试策略，避免多个并发请求重复刷新。

建议实现一个 module-level `refreshPromise`，当多个请求同时遇到 token 过期时复用同一个 refresh promise。刷新成功后重试原请求一次；刷新失败时清空 store 并跳转 `/`。

### UI 组件

Home Page：

- `HeroSection` 展示 badge、标题、副标题、CTA、占位预览卡片和示例锚点。
- `FeaturesSection` 展示三张特性卡片。
- `Footer` 展示版权和 GitHub 链接。
- 「查看示例」定位到页面内占位示例区域。

AuthModal：

- Dialog + Tabs。
- `LoginForm`：email/password。
- `RegisterForm`：username/email/password/confirmPassword。
- 表单校验使用 zod；后端错误通过 `ApiError.code` 映射到字段错误或表单顶部 Alert。

AppHeader：

- 接收 `actions?: ReactNode`。
- 已登录时展示用户菜单；用户名可优先显示 `username`，头像可用 username 或 email 首字母。
- 退出登录调用 `useAuth().logout()`，触发 `/logout` 并清空状态。

AuthUser 前端模型：

```typescript
interface AuthUser {
  id: string
  username: string
  email: string
}
```

## 后端设计

### 目录结构

后端保持独立 Go module，新增目录：

```text
apps/server/
├── cmd/api/main.go
├── config.yaml
├── migrations/
│   └── 000001_create_auth_tables.sql
└── internal/
    ├── handler/
    ├── middleware/
    ├── service/
    ├── repository/
    └── model/
```

### 入口与路由

`apps/server/cmd/api/main.go` 负责：

- 读取配置。
- 初始化数据库连接。
- 初始化 repository/service/handler。
- 创建 Gin engine。
- 注册全局 IP 限流 middleware。
- 注册 `/api/auth/*` 路由。
- 启动 HTTP server。

认证路由：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Handler 层

`internal/handler`：

- 绑定请求 JSON。
- 读取 Access Token header 或 Refresh Cookie。
- 调用 service。
- 使用 `model.OK` / `model.Fail` 统一响应。
- 将 service 返回的 `AppError` 映射到 HTTP 状态码。

Handler 不直接访问数据库，不实现密码、token 或限流规则。

### Service 层

`internal/service/auth_service.go` 负责：

- username/email/password 校验。
- email 规范化为 lowercase，用于唯一性与登录查找。
- bcrypt hash 和 compare。
- Access Token 签发与校验。
- Refresh Token 生成、hash、存储、轮换和撤销。
- 登录失败账号维度计数与锁定。
- 注册、登录、刷新、登出、获取当前用户业务流程。

Refresh Token 原文只出现在生成和 Cookie 写入过程；数据库仅存 token hash。

### Repository 层

`internal/repository`：

- `UserRepository`：
  - `CreateUser`
  - `FindActiveByEmailNormalized`
  - `EmailExistsActive`
  - `UsernameExistsActive`
  - `FindActiveByID`
- `RefreshTokenRepository`：
  - `Create`
  - `FindActiveByHash`
  - `RevokeByID`
  - `RevokeAllForUser`（可用于安全扩展，当前 logout 只要求当前 token）

使用 `database/sql`，PostgreSQL driver 使用 pgx stdlib，例如 `github.com/jackc/pgx/v5/stdlib`。

### Model 层

`internal/model`：

- `BaseResponse[T]`、`OK`、`Fail`
- `AppError` 与错误码常量
- `User`
- `RefreshToken`
- 请求/响应 DTO

需要在 `docs/designAndPrd/api_response_and_error_codes.md` 基础上新增认证错误码：

- `101007 ErrUsernameExists`：用户名已存在
- `101008 ErrUsernameFormatInvalid`：用户名格式不正确
- `101009 ErrAccountLocked`：账号已锁定，请稍后重试
- `101010 ErrRefreshTokenInvalid`：登录状态已失效，请重新登录

## API、数据与契约

### OpenAPI 路径

本需求采用：

```text
contracts/openapi/openapi.yaml
```

后续需同步修正 `Makefile` 的 `generate` 目标，从当前 `../../contracts/openapi.yaml` 改为 `../../contracts/openapi/openapi.yaml`。

### 统一响应 schema

OpenAPI 需要定义：

- `BaseResponse`
- `AuthUser`
- `RegisterRequest`
- `LoginRequest`
- `AuthTokenResponse`
- `MeResponse`
- `EmptyResponse`

响应统一形状：

```json
{
  "code": 0,
  "message": "",
  "data": {}
}
```

错误响应 HTTP 状态码按错误语义返回，body 仍为 `BaseResponse`，`data: null`。

### 接口定义

`POST /api/auth/register`

Request：

```json
{
  "username": "张三",
  "email": "user@example.com",
  "password": "password1",
  "confirmPassword": "password1"
}
```

Response 201：

```json
{
  "code": 0,
  "message": "",
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "<uuid>",
      "username": "张三",
      "email": "user@example.com"
    }
  }
}
```

同时设置 `refresh_token` HttpOnly Cookie。

`POST /api/auth/login`

Request：

```json
{
  "email": "user@example.com",
  "password": "password1"
}
```

Response 200：同 `register`。

`GET /api/auth/me`

- Header：`Authorization: Bearer <accessToken>`
- Response 200 data：

```json
{
  "user": {
    "id": "<uuid>",
    "username": "张三",
    "email": "user@example.com"
  }
}
```

`POST /api/auth/refresh`

- Cookie：`refresh_token=<token>`
- Response 200 data：

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "<uuid>",
    "username": "张三",
    "email": "user@example.com"
  }
}
```

同时轮换并重新设置 `refresh_token` Cookie。

`POST /api/auth/logout`

- Cookie：`refresh_token=<token>`
- Response 200 data：`null` 或 `{}`，由 OpenAPI 统一为 `EmptyResponse`。
- 同时清除 `refresh_token` Cookie。

### 数据库 schema

`users`：

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX users_email_active_uidx
  ON users (email_normalized)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX users_username_active_uidx
  ON users (username)
  WHERE deleted_at IS NULL;
```

`refresh_tokens`：

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NULL,
  replaced_by_token_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_active_hash_idx
  ON refresh_tokens (token_hash)
  WHERE revoked_at IS NULL;
```

说明：

- email 原文用于展示，`email_normalized` 用于大小写不敏感唯一和登录查找。
- username 原样保存，唯一索引大小写敏感。
- 软删除释放 email 和 username 依赖 partial unique index 的 `WHERE deleted_at IS NULL`。
- Refresh Token 存 hash，不存明文。

### Token 与 Cookie

Access Token：

- JWT。
- 有效期 15 分钟。
- claims 至少包含 `sub`、`exp`、`iat`。
- 可包含 `email`、`username` 作为展示优化，但权限判断以 `sub` 为准。

Refresh Token：

- 使用密码学安全随机值。
- 有效期 7 天。
- 数据库存储 hash。
- 每次 refresh 轮换，旧 token 设置 `revoked_at` 和 `replaced_by_token_id`。

Cookie：

- 名称：`refresh_token`。
- `HttpOnly: true`。
- `Path: /api/auth`。
- `Max-Age: 7 days`。
- `SameSite: Lax`。
- 本地开发可 `Secure: false`；生产环境必须 `Secure: true`。

## 状态、错误和边界情况

### 校验

前后端均执行：

- username：2-32 位，允许中文、字母、数字、下划线。建议正则 `^[\\p{Han}A-Za-z0-9_]{2,32}$`，Go 使用支持 Unicode 的实现。
- email：合法邮箱格式，后端保存 `strings.ToLower(strings.TrimSpace(email))` 到 `email_normalized`。
- password：至少 8 位，且包含数字或特殊字符。
- confirmPassword：仅注册请求使用，必须等于 password。

### 错误码

沿用：

- `100001 ErrInvalidParam`
- `100002 ErrMissingParam`
- `100003 ErrUnauthorized`
- `100006 ErrTooManyRequests`
- `200001 ErrInternalServer`
- `200002 ErrDBError`
- `101001 ErrEmailExists`
- `101002 ErrInvalidCredential`
- `101003 ErrTokenExpired`
- `101004 ErrTokenInvalid`
- `101005 ErrPasswordTooWeak`
- `101006 ErrEmailFormatInvalid`

新增：

- `101007 ErrUsernameExists`
- `101008 ErrUsernameFormatInvalid`
- `101009 ErrAccountLocked`
- `101010 ErrRefreshTokenInvalid`

### 登录失败计数

实现位置：`internal/service` 或独立 `internal/middleware` 辅助组件，不能落在 handler。

策略：

- key 使用 `email_normalized`。
- 失败一次计数 +1。
- 第 5 次失败后设置 `locked_until = now + 15m`。
- 锁定期间登录直接返回 `ErrAccountLocked`。
- 登录成功删除该 key。
- 服务重启后清空。

### 全局 IP 限流

实现位置：`internal/middleware/rate_limit.go`。

策略：

- key 使用客户端 IP。
- 使用内存 token bucket 或固定窗口。
- 阈值建议由配置控制，例如 `AUTH_GLOBAL_RATE_LIMIT_PER_MINUTE`。
- 命中后返回 `100006 ErrTooManyRequests` 和 HTTP 429。
- 多实例不共享。

### Refresh Token 并发

同一个 Refresh Token 被并发使用时，只允许一个请求成功轮换。实现上应在事务中读取 active token，设置 `revoked_at/replaced_by_token_id`，插入新 token。后续并发请求发现旧 token 已 revoked 后返回 `ErrRefreshTokenInvalid`，前端清空会话并回到首页。

## 安全、性能与兼容性

安全：

- 密码只存 bcrypt hash。
- Refresh Token 只存 hash。
- Access Token 只保存在前端内存，不写浏览器持久化存储。
- Refresh Cookie 使用 HttpOnly。
- 认证失败不暴露邮箱是否存在。
- 登录失败锁定减少暴力尝试。

性能：

- 首页首屏使用占位预览卡片，避免额外大图下载。
- 避免把 AuthModal、表单库之外的重型依赖引入首屏关键路径；必要时 AuthModal 可懒加载。
- 数据库索引覆盖登录和唯一性检查。

兼容性：

- Cookie 的 `SameSite=Lax` 支持同站 Vite dev proxy 与生产同站部署。
- 本地开发若前后端不同端口，需要 Vite proxy 或 CORS `credentials` 配置；具体策略在实现阶段根据开发服务器配置落地。

## CLI / Harness 影响

本需求不修改 `packages/vega-cli/` 和 Vega Harness 状态机。

后续阶段只通过 CLI 正常推进：

- `vega doc set tech_design`
- `vega complete`
- breakdown 阶段由 `vega-breakdown` 登记模块

## 测试与验证策略

后端测试：

- service 层单测覆盖注册、登录、失败计数锁定、refresh 轮换、logout、`/me` token 校验。
- repository 层测试覆盖 users partial unique index、email normalized 查找、refresh token revoke/rotate。
- handler 层使用 `httptest` 覆盖 HTTP 状态码、统一响应 body、Cookie 设置/清除。

前端测试：

- Home Page 渲染、CTA 打开对应 Tab、查看示例定位、375px 布局无横向滚动。
- AuthModal 表单校验、后端错误码映射、loading 防重复提交。
- auth store 和 bootstrap flow：无 access token 时 refresh，refresh 成功后 `/me`，失败后 anonymous。
- Home guard 和 Console guard。

契约测试：

- OpenAPI schema 覆盖五个接口和 BaseResponse。
- `make generate` 生成前后端接口。
- 前端 service 使用生成 client，不手写接口 shape。

后续阶段应运行的命令：

- `make spec-check`
- `make generate`
- `make test-web`
- `make test-server`
- `make lint`
- `make build`

若当前包脚本缺失导致 Makefile 目标失败，implementation 阶段应补齐脚本或记录失败原因，并在 verification 阶段复核。

## Breakdown 建议

建议模块拆解顺序：

1. `contract-auth-api`
   - 范围：OpenSpec change、`contracts/openapi/openapi.yaml`、错误码文档更新、生成配置和 Makefile generate 路径修正。
   - 依赖：PRD、brainstorm、tech_design。
   - 输出：可生成的 OpenAPI 契约。

2. `server-auth-core`
   - 范围：Gin API、统一响应、错误码、users/refresh_tokens migration、repository/service/handler、JWT/bcrypt、refresh token 轮换、限流。
   - 依赖：`contract-auth-api` 的契约。
   - 输出：后端认证接口和测试。

3. `web-auth-shell`
   - 范围：前端依赖、路由、认证 store、http client、生成 client 接入、AuthModal 表单、错误映射、Home guard、Console 占位。
   - 依赖：`contract-auth-api` 的生成 client；可与 `server-auth-core` 局部并行，但最终需集成。
   - 输出：前端主链路和测试。

4. `home-page-ui`
   - 范围：AppHeader、Hero、占位预览卡片、Features、Footer、响应式和首页交互。
   - 依赖：前端基础依赖；与 `web-auth-shell` 可并行，但 AuthModal 触发点需要集成。
   - 输出：首页 UI 和测试。

5. `integration-auth-flow`
   - 范围：前后端联调、dev proxy/CORS、Cookie 行为、端到端注册登录刷新登出验证、Makefile 验证命令。
   - 依赖：前四个模块。
   - 输出：可验证的完整 MVP 链路。

`vega-breakdown` 阶段应根据以上建议登记模块，但本阶段不调用 `vega module add`。

## 风险、依赖与开放项

风险：

- 当前 `Makefile generate` 路径与实际 `contracts/openapi/` 目录不一致，契约模块必须先修正。
- 前端依赖缺口较大，首次引入 Tailwind/shadcn/ui/表单/Router/Zustand 需要注意配置一致性。
- 双 Token 轮换的并发处理需要事务保证。
- 内存限流和失败计数只能覆盖单进程。

依赖：

- PostgreSQL 本地开发环境。
- Go 依赖：Gin、pgx stdlib、bcrypt、JWT 库、uuid 库。
- 前端依赖：React Router、Zustand、zod、react-hook-form、shadcn/ui、lucide-react、Tailwind、OpenAPI 生成工具。
- OpenAPI 生成工具：orval 和 oapi-codegen。

开放项：

- `id` 字段在 OpenAPI 中命名为 `id`，数据库列也使用 `id UUID`；不再使用 `uuid` 作为字段名。
- AuthUser 返回 `id`、`username`、`email`。
- 全局 IP 限流默认阈值由实现阶段在配置中确定，建议先选择保守 MVP 值。
- 本地开发的 CORS/Vite proxy 由 integration 模块根据端口配置落地。
- 是否懒加载 AuthModal 由前端实现阶段结合 bundle 体积决定，不影响契约。

## 决策记录

- 2026-07-02：采用方案 A，契约优先 + 轻量分层实现。
- 2026-07-02：OpenAPI 路径定为 `contracts/openapi/openapi.yaml`。
- 2026-07-02：后端使用 Gin、`database/sql`、pgx stdlib、手写 repository。
- 2026-07-02：Refresh Token 仅存 hash。
- 2026-07-02：AuthUser 返回 `id`、`username`、`email`。
- 2026-07-02：数据库用户主键列使用 `id UUID`。
- 2026-07-02：新增认证错误码 `101007` 至 `101010`。
- 2026-07-02：Breakdown 建议拆为 contract、server、web auth、home UI、integration 五个模块。
