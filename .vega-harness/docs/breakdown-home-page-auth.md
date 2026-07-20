# Home Page Auth 模块拆解

## 输入产物

- PRD：`.vega-harness/docs/prd-home-page-auth.md`
- Brainstorm：`.vega-harness/docs/brainstorm-home-page-auth.md`
- Tech Design：`.vega-harness/docs/tech-design-home-page-auth.md`
- 统一响应规范：`docs/designAndPrd/api_response_and_error_codes.md`

## 拆解原则

- 以已批准技术设计的 Breakdown 建议为基础。
- 先拆共享基础和契约，再拆后端、前端认证壳层、首页 UI，最后做集成。
- 模块边界按主要写入路径划分，避免两个模块竞争同一窄目录或具体文件。
- 共享依赖、生成配置、错误码和全局样式归入 foundation 模块。
- 顶层路由、Vite proxy、端到端串联归入 integration 模块。
- 不在 breakdown 阶段生成 OpenSpec、不写实现代码、不写测试。

## 模块总览

| 模块名 | 职责 | 依赖 | Size |
| --- | --- | --- | --- |
| `contract-tooling-foundation` | OpenAPI、错误码、生成配置、前端依赖和基础样式工具链 | 无 | M |
| `server-auth-core` | 后端 Gin Auth API、数据库、服务层、Token、限流 | `contract-tooling-foundation` | M |
| `web-auth-shell` | 前端认证状态、HTTP client、AuthModal、Console 占位 | `contract-tooling-foundation` | M |
| `home-page-ui` | 首页展示层和共享 Header | `contract-tooling-foundation` | M |
| `integration-auth-flow` | 顶层路由、前后端联调、Cookie/dev proxy、端到端验证 | 前四个模块 | S |

## 模块详情

### contract-tooling-foundation

- Description:
  - 建立契约优先基础，包含 OpenAPI、错误码、生成配置、前端依赖和基础样式工具链。
  - 不实现业务 handler、service、React 页面或认证流程。
- Scope:
  - 创建或更新 `contracts/openapi/openapi.yaml`。
  - 为 `register/login/me/refresh/logout` 定义 schema、paths、统一 `BaseResponse`。
  - 更新 `docs/designAndPrd/api_response_and_error_codes.md`，加入 `101007-101010`。
  - 修正 `Makefile generate` 的契约路径。
  - 补齐前端依赖和 API 生成脚本。
  - 配置前端生成 client 输出目录。
  - 配置 Go oapi-codegen 输出目录。
  - 建立基础 Tailwind/shadcn/ui 所需全局样式入口。
- Non-goals:
  - 不写后端认证业务逻辑。
  - 不写 AuthModal、Home Page 或 Console 组件。
  - 不写端到端联调。
- Affected paths:
  - `contracts/openapi/openapi.yaml`
  - `openspec/`
  - `Makefile`
  - `docs/designAndPrd/api_response_and_error_codes.md`
  - `apps/web/package.json`
  - `apps/web/orval.config.ts`
  - `apps/web/src/shared/api/generated/`
  - `apps/server/oapi-codegen.yaml`
  - `apps/server/internal/generated/`
  - `apps/web/src/index.css`
- Dependencies:
  - 无
- Acceptance:
  - OpenAPI 覆盖五个认证接口和 `BaseResponse`。
  - 错误码文档包含 `101007 ErrUsernameExists`、`101008 ErrUsernameFormatInvalid`、`101009 ErrAccountLocked`、`101010 ErrRefreshTokenInvalid`。
  - `make generate` 能从 `contracts/openapi/openapi.yaml` 生成前后端接口。
  - 生成目录只由该模块维护，后续模块只消费生成物。
- Suggested checks:
  - `make spec-check`
  - `make generate`
  - `make lint-web`
  - `make build-web`
- Size:
  - M

### server-auth-core

- Description:
  - 实现后端认证核心：Gin 路由、统一响应、GORM migration、repository/service/handler、JWT/bcrypt、Refresh Token 轮换、全局 IP 限流和账号失败锁定。
  - 不修改前端 UI 或顶层前端路由。
- Scope:
  - 启动 Gin server 并注册 `/api/auth/*`。
  - 新增 users 和 refresh_tokens GORM migration。
  - 实现 `internal/model`、`internal/repository`、`internal/service`、`internal/handler`、`internal/middleware`。
  - 使用 GORM + PostgreSQL driver 连接 PostgreSQL。
  - 实现 bcrypt、Access Token、Refresh Token hash 存储与轮换。
  - 实现账号维度失败 5 次锁定 15 分钟。
  - 实现全局 IP 内存限流。
- Non-goals:
  - 不修改 OpenAPI 契约 shape。
  - 不写前端请求、store 或页面。
  - 不实现账号删除接口。
- Affected paths:
  - `apps/server/go.mod`
  - `apps/server/cmd/api/main.go`
  - `apps/server/config.yaml`
  - `apps/server/internal/model/`
  - `apps/server/internal/repository/`
  - `apps/server/internal/service/`
  - `apps/server/internal/handler/`
  - `apps/server/internal/middleware/rate_limit.go`
- Dependencies:
  - `contract-tooling-foundation`
- Acceptance:
  - `POST /api/auth/register` 写入 PostgreSQL，密码为 bcrypt hash。
  - `POST /api/auth/login` 正确签发 Access Token 和 Refresh Cookie。
  - `GET /api/auth/me` 只接受 Access Token。
  - `POST /api/auth/refresh` 轮换 Refresh Token，旧 token 失效。
  - `POST /api/auth/logout` 失效当前 Refresh Token 并清 Cookie。
  - 重复 email、重复 username、弱密码、无效 token、账号锁定均返回统一响应和数字错误码。
- Suggested checks:
  - `make test-server`
  - `make lint-server`
  - `make build-server`
- Size:
  - M

### web-auth-shell

- Description:
  - 实现前端认证壳层：认证模型、内存 store、HTTP client、生成 client 包装、AuthModal、Console 占位和认证 hooks。
  - 不实现 Home Page 展示组件和顶层路由挂载。
- Scope:
  - 定义 `AuthUser`、`ApiError`、表单模型和错误码映射。
  - 实现 `auth.store`，Access Token 仅内存保存。
  - 实现 `http.client`，处理 `Authorization`、`credentials: include`、统一响应、refresh 单次重试。
  - 实现 `auth.service`，消费生成 client。
  - 实现 `useAuth`、`useAuthBootstrap`、`useHomeGuard`。
  - 实现 AuthModal、LoginForm、RegisterForm。
  - 实现最小 Console 页面。
- Non-goals:
  - 不修改 `main.tsx`、`App.tsx` 或 `vite.config.ts`。
  - 不实现 AppHeader、Hero、Features、Footer。
  - 不修改 OpenAPI 或生成配置。
- Affected paths:
  - `apps/web/src/shared/auth/model/`
  - `apps/web/src/shared/auth/store/`
  - `apps/web/src/shared/auth/hooks/useAuth.ts`
  - `apps/web/src/shared/auth/hooks/useAuthBootstrap.ts`
  - `apps/web/src/shared/auth/hooks/useHomeGuard.ts`
  - `apps/web/src/shared/http/http.client.ts`
  - `apps/web/src/shared/auth/api/auth.service.ts`
  - `apps/web/src/pages/console/ui/`
  - `apps/web/src/pages/home/ui/components/AuthModal/`
- Dependencies:
  - `contract-tooling-foundation`
- Acceptance:
  - AuthModal 注册表单包含 username、email、password、confirmPassword，并完成前端校验。
  - 登录表单包含 email、password，并完成错误码映射。
  - refresh 成功时更新内存 Access Token；失败时清空会话。
  - logout 调用后端并清空前端状态。
  - Console 占位能显示当前用户基础信息。
- Suggested checks:
  - `make test-web`
  - `make lint-web`
  - `make build-web`
- Size:
  - M

### home-page-ui

- Description:
  - 实现首页展示层与共享 Header。
  - 通过 props/callback 暴露登录、注册和查看示例触发点，不处理认证业务。
- Scope:
  - 实现 AppHeader sticky、actions slot、已登录用户展示入口。
  - 实现 Hero、占位预览卡片、示例区域、Features、Footer。
  - 保证移动端 375px 无横向滚动。
  - 保证「查看示例」定位到页面内占位示例预览。
- Non-goals:
  - 不实现 AuthModal 表单。
  - 不写认证 store、service 或 refresh 逻辑。
  - 不修改顶层路由。
- Affected paths:
  - `apps/web/src/shared/layout/AppHeader/`
  - `apps/web/src/pages/home/ui/HomePage.tsx`
  - `apps/web/src/pages/home/ui/components/HeroSection/`
  - `apps/web/src/pages/home/ui/components/FeaturesSection/`
  - `apps/web/src/pages/home/ui/components/Footer/`
  - `apps/web/src/pages/home/ui/components/ExamplePreview/`
- Dependencies:
  - `contract-tooling-foundation`
- Acceptance:
  - 首页展示 PRD 指定文案、CTA、Features 和 Footer。
  - Header 滚动 80px 后背景与阴影变化。
  - Hero 使用占位预览卡片。
  - 375px 宽度无横向滚动。
  - HomePage 能通过传入回调触发登录、注册和查看示例。
- Suggested checks:
  - `make test-web`
  - `make lint-web`
  - `make build-web`
- Size:
  - M

### integration-auth-flow

- Description:
  - 串联前四个模块：顶层路由、Home/Auth/Console 联动、Vite proxy 或 CORS、Cookie 行为、端到端验证和 Makefile 验证。
  - 不新增核心认证业务逻辑。
- Scope:
  - 修改前端顶层入口挂载 Router 和 app shell。
  - 连接 HomePage、AuthModal、Auth store、Console guard。
  - 配置本地 dev proxy 或 CORS credentials 策略。
  - 补充集成测试或 e2e 测试覆盖注册、登录、刷新、登出。
  - 运行并修正 Makefile 验证入口。
- Non-goals:
  - 不修改 OpenAPI 契约 shape。
  - 不实现新的后端业务规则。
  - 不重构 Home UI 或 AuthModal 内部实现。
- Affected paths:
  - `apps/web/src/main.tsx`
  - `apps/web/src/app/App.tsx`
  - `apps/web/vite.config.ts`
  - `apps/web/e2e/`
  - `apps/web/src/**/*.integration.test.tsx`
- Dependencies:
  - `contract-tooling-foundation`
  - `server-auth-core`
  - `web-auth-shell`
  - `home-page-ui`
- Acceptance:
  - 未登录访问 `/` 渲染首页。
  - 注册成功进入 `/console`。
  - 登录成功进入 `/console`。
  - 刷新后可通过 refresh token 恢复登录态。
  - 登出后服务端清 Cookie，前端回到未登录。
  - 已登录访问 `/` 跳转 `/console`。
- Suggested checks:
  - `make test-web`
  - `make test-server`
  - `make e2e`
  - `make lint`
  - `make build`
- Size:
  - S

## 并行计划

串行前置：

1. `contract-tooling-foundation` 必须最先完成，因为它提供 OpenAPI、生成物、前端依赖和基础工具链。

可并行：

- `server-auth-core`、`web-auth-shell`、`home-page-ui` 可在 foundation 完成后并行推进。
- `server-auth-core` 消费 Go 生成物和契约。
- `web-auth-shell` 消费前端生成 client 和基础依赖。
- `home-page-ui` 只依赖前端基础样式和 UI 工具链。

串行收尾：

1. `integration-auth-flow` 最后执行，负责顶层路由、Cookie/dev proxy、前后端联调和完整链路验证。

## 路径重叠校验

- `contract-tooling-foundation` 与 `server-auth-core`：
  - foundation 写 `apps/server/internal/generated/` 和 `apps/server/oapi-codegen.yaml`。
  - server 写 `apps/server/internal/model/`、`repository/`、`service/`、`handler/`、`middleware/`。
  - 主要路径不重叠；server 只消费 generated。
- `contract-tooling-foundation` 与 `web-auth-shell`：
  - foundation 写 `apps/web/package.json`、`apps/web/orval.config.ts`、`apps/web/src/shared/api/generated/`、`apps/web/src/index.css`。
  - web auth 写 `models/`、`store/`、`hooks/`、`services/http.client.ts`、`services/auth.service.ts`、AuthModal 和 Console。
  - 主要路径不重叠；web auth 只消费 generated 和依赖。
- `contract-tooling-foundation` 与 `home-page-ui`：
  - foundation 写基础工具链与全局样式。
  - home UI 写 `ui/shared/AppHeader/` 与 `ui/pages/home/` 展示组件。
  - 主要路径不重叠。
- `contract-tooling-foundation` 与 `integration-auth-flow`：
  - foundation 写生成与基础配置。
  - integration 写 `main.tsx`、`ui/App.tsx`、`vite.config.ts`、e2e/integration tests。
  - 主要路径不重叠。
- `server-auth-core` 与 `web-auth-shell`：
  - server 写 `apps/server/`，web auth 写 `apps/web/src/`。
  - 路径不重叠。
- `server-auth-core` 与 `home-page-ui`：
  - server 写 `apps/server/`，home UI 写 `apps/web/src/pages/home/ui/`，共享能力写 `apps/web/src/shared/`。
  - 路径不重叠。
- `server-auth-core` 与 `integration-auth-flow`：
  - server 写后端业务目录。
  - integration 写前端顶层路由、Vite proxy 和集成测试。
  - 可能通过联调发现后端缺陷，但不竞争主要代码路径。
- `web-auth-shell` 与 `home-page-ui`：
  - web auth 写 AuthModal、认证 hooks/store/services 和 Console。
  - home UI 写 AppHeader、Hero、Features、Footer、ExamplePreview。
  - 两者均位于 `apps/web/src/`，但窄目录不同；HomePage 只通过 props/callback 集成 AuthModal 触发点，最终串联由 integration 完成。
- `web-auth-shell` 与 `integration-auth-flow`：
  - web auth 不修改 `main.tsx`、`ui/App.tsx`、`vite.config.ts`。
  - integration 只消费 auth hooks/store/services，不改内部业务逻辑。
- `home-page-ui` 与 `integration-auth-flow`：
  - home UI 不修改顶层路由。
  - integration 只把 HomePage 接入 Router 和 AuthModal 回调，不改 Home UI 内部组件。

结论：所有模块都有明确写入路径边界，未发现需要合并的大路径冲突。

## 风险与开放项

- `contract-tooling-foundation` 边界较宽，但它集中处理共享基础，能避免后续模块反复修改依赖和生成配置。
- `server-auth-core` 涉及数据库与 token 并发，需要在后续 OpenSpec/实现阶段重点覆盖 refresh token 轮换测试。
- `web-auth-shell` 与 `home-page-ui` 都落在前端，但通过 AuthModal 与 Home 展示目录分离，并由 integration 负责最终接线。
- `integration-auth-flow` 可能暴露前序模块接口不一致问题，应保留为最后模块。
