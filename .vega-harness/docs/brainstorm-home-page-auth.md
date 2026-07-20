# Home Page Auth Brainstorm

## 背景与问题

VegaResume 需要把当前 Vite 示例页替换为真实首页，并打通从首页转化到注册、登录、进入控制台的 MVP 链路。原首页 PRD 只覆盖前端落地页和 AuthModal；本需求已扩大为 Full workflow，纳入前端 Home Page、最小 Console、后端登录/注册 API、OpenAPI 契约，以及前后端接口生成同步。

当前仓库状态仍是初始骨架：前端为 Vite 示例，后端为 Go Hello World，OpenAPI 目录为空。因此本需求需要先形成跨前端、后端、契约的业务设计，后续再进入技术设计、模块拆解、OpenSpec 和实现。

## 目标与非目标

目标：

- 未登录用户访问 `/` 时看到 VegaResume Home Page。
- 点击「立即开始」打开注册 Dialog，注册成功后进入最小占位 `/console`。
- 点击 Header「登录」打开登录 Dialog，登录成功后进入 `/console`。
- 已登录用户访问 `/` 自动跳转 `/console`。
- 后端提供真实 PostgreSQL 持久化、bcrypt 密码校验、Access/Refresh 双 Token 鉴权。
- OpenAPI 覆盖认证接口，并通过生成同步前后端接口。
- 所有 API 使用统一响应结构 `{ code, message, data }` 和数字错误码。

非目标：

- 不实现简历编辑器、模板列表、头像上传、邮件验证、找回密码或完整 Console 业务内容。
- 不实现账号注销或删除账号接口；`deleted_at` 仅作为预留字段和唯一性语义的一部分。
- 不实现多实例共享限流或分布式防爆破。
- 不把后续技术选型、数据库索引细节、token claims、cookie 属性和生成配置在 brainstorm 阶段固定为实现方案；这些留给 `vega-tech-design`。

## 用户与核心场景

目标用户是正在求职、需要快速了解产品并制作简历的候选人。

核心场景：

- 未登录用户打开首页，在 10 秒内理解 VegaResume 的价值和免费特性。
- 用户点击「立即开始」，填写 username、email、password 和 confirmPassword 完成注册。
- 注册成功后系统自动进入 Console，占位页面作为后续简历工作台落点。
- 已有账号用户点击「登录」，填写 email 和 password 登录。
- 已登录用户刷新页面或访问受保护页面时，系统通过 refresh token 恢复会话。
- 用户退出登录时，服务端失效 refresh token，前端清空认证状态。

## 已确认需求

首页：

- Home Page 包含 sticky AppHeader、Hero、占位预览卡片、Features、Footer。
- Hero 右侧使用占位预览卡片，不使用静态截图或动态 Demo。
- 「查看示例」按钮定位到首页内占位示例预览，不跳转新页面。
- PC 和移动端登录/注册都统一使用 Dialog，不使用移动端 Sheet。
- 移动端 375px 宽度不得出现横向滚动。

认证表单：

- 注册表单字段为 `username`、`email`、`password`、`confirmPassword`。
- 登录表单字段为 `email`、`password`。
- username 规则：2-32 位，允许中文、字母、数字、下划线。
- email 合法且大小写不敏感唯一。
- password 至少 8 位，并包含数字或特殊字符。
- confirmPassword 必须与 password 一致。

用户模型：

- 用户表包含 `id` 或 `uuid`、`username`、`email`、`password_hash`、`created_at`、`updated_at`、`deleted_at`。
- 注册要求 username 和 email 在未软删除用户中唯一。
- email 唯一性大小写不敏感。
- username 唯一性大小写敏感，`User` 和 `user` 是不同 username。
- 软删除后释放 email 和 username，允许重新注册，但本次不实现删除接口。
- AuthUser 最小返回字段为 `id` 和 `email`；username 是否随接口返回留给技术设计结合前端展示需要决定。

鉴权：

- 使用双 Token。
- Access Token 有效期 15 分钟，前端仅内存保存，通过 `Authorization: Bearer <token>` 使用。
- Refresh Token 有效期 7 天，后端持久化，前端通过 HttpOnly Cookie 携带。
- 每次刷新 Access Token 时也轮换 Refresh Token，并失效旧 Refresh Token。
- `/me` 只接受 Access Token。
- `/logout` 需要服务端失效当前 Refresh Token，并清空 Cookie。

限流与防爆破：

- Gin 全局 IP 内存限流覆盖所有 API。
- 登录接口额外按账号维度记录失败次数。
- 同一账号连续登录失败 5 次后锁定 15 分钟。
- 登录成功清空该账号失败计数。
- 内存限流和失败计数在服务重启后清空，多实例不共享。

统一响应：

- 遵循 `docs/designAndPrd/api_response_and_error_codes.md`。
- 所有 API 响应均使用 `BaseResponse`：`{ code, message, data }`。
- 成功响应 `code=0`，`message=""`。
- 错误响应使用 6 位数字业务码。
- 既有认证错误码包括：
  - `101001`：邮箱已注册
  - `101002`：邮箱或密码不正确
  - `101003`：Token 已过期，请重新登录
  - `101004`：Token 无效或已被篡改
  - `101005`：密码强度不足
  - `101006`：邮箱格式不正确
- 新增 username 已存在、username 格式错误、账号锁定、refresh token 失效等错误码时，后续 OpenSpec/技术设计必须同步更新错误码文档。

## 方案比较与最终选择

### 方案 A：契约优先完整 Auth MVP

OpenAPI 定义 `register/login/me/refresh/logout`，后端使用 Gin、PostgreSQL、bcrypt 和双 Token 实现真实认证链路，前端通过生成 client 对接 Home Page、AuthModal 和最小 Console。

收益：

- 满足用户要求的前后端同时落地和 OpenAPI 同步。
- 主链路可真实验证，不依赖 mock。
- 后续 Console、Editor 等页面可以复用认证能力。

代价：

- 范围跨前端、后端、数据库和契约，需要 Full workflow 的技术设计与模块拆解。
- 需要补齐生成、测试和本地数据库相关约束。

### 方案 B：分层收敛方案

先只完成后端 Auth 与 OpenAPI，首页 UI 放到后续需求。

收益是风险更低、后端链路更聚焦；代价是不满足首页转化链路，用户无法从首页完成注册进入 Console。

### 方案 C：前端优先方案

先完成首页和 AuthModal，后端 Auth 只保留契约。

收益是页面交付更快；代价是不满足真实后端、PostgreSQL 和 token 链路要求。

最终选择：方案 A。它与本需求已确认范围一致，也是 Full workflow 的合理边界。

## 设计说明

前端边界：

- `apps/web/src` 按五层约束组织：展示层、hooks、services、store、models。
- 展示层负责 Home Page、AuthModal、Console 占位和 AppHeader 渲染。
- hooks 负责表单提交流程、登录态恢复、路由守卫和 token 刷新编排。
- services 封装生成的 OpenAPI client 与请求/错误转换。
- store 保存内存 Access Token、当前用户和认证状态。
- models 放 `AuthUser`、表单模型和纯校验/映射类型。
- AppHeader 作为共享组件；AuthModal 仍归 Home Page 专属；Console 只做最小占位。

后端边界：

- `apps/server` 建立 Gin API，并按 handler/service/repository/model 分层。
- handler 只负责请求解析、响应封装和错误映射。
- service 负责注册、登录、刷新、登出和 `/me` 的业务规则。
- repository 负责 users 和 refresh_tokens 的 PostgreSQL 读写。
- model 定义领域对象、DTO、统一响应和错误码。
- 密码只存 bcrypt hash，不返回 password hash。

契约边界：

- OpenAPI 是前后端唯一接口桥梁。
- OpenAPI 需要覆盖：
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
- 所有响应都使用 `BaseResponse` 封装。
- `make generate` 后，前端 TS client 和 Go stub 应与契约一致。
- 详细字段、索引、token claims、cookie 属性和生成配置由 `vega-tech-design` 决定。

## 业务规则与边界情况

注册：

- 前端先做 zod 校验；后端仍必须执行同等校验。
- email 重复返回邮箱已注册错误码。
- username 重复返回新增 username 已存在错误码。
- password 不满足强度返回 `101005`。
- email 不合法返回 `101006`。
- username 不合法返回新增 username 格式错误码。

登录：

- 账号维度失败计数建议以后端规范化 email 为 key。
- 登录成功清空失败计数。
- 邮箱不存在或密码错误统一返回 `101002`，避免泄露账号是否存在。
- 连续失败 5 次后锁定 15 分钟，返回新增账号锁定错误码。

刷新：

- `/refresh` 依赖 HttpOnly Cookie 中的 Refresh Token。
- Refresh Token 有效时签发新的 Access Token 和 Refresh Token。
- 旧 Refresh Token 必须失效。
- Refresh Token 失效、过期或已被轮换后再次使用时返回明确错误码，并要求前端退出登录。

退出：

- `/logout` 使用 Cookie 中的 Refresh Token 定位当前会话。
- 服务端失效当前 Refresh Token。
- 响应需要清除 Refresh Cookie。
- 前端收到成功响应后清空内存 Access Token 和用户状态。

会话恢复：

- 应用启动或访问受保护页面时，如果内存没有 Access Token，先调用 `/refresh`。
- `/refresh` 成功后再调用 `/me` 获取当前用户。
- `/refresh` 失败则保持未登录状态。

已知边界：

- 内存限流和失败计数不支持多实例共享。
- 服务重启后内存限流和失败计数清空。
- 删除账号接口不在本次范围内。
- Console 页面只提供登录成功落点和最小可见状态。

## 验收标准

前端：

- 未登录用户访问 `/` 正常渲染 Home Page。
- 已登录用户访问 `/` 自动跳转 `/console`。
- Header 滚动超过 80px 后出现白色背景与阴影。
- Hero Badge、主标题高亮、Features 三张卡片和 Footer 内容按 PRD 展示。
- Hero 右侧展示占位预览卡片。
- 「查看示例」定位到首页内占位示例预览。
- 点击「立即开始」打开 AuthModal 并默认注册 Tab。
- 点击「登录」打开 AuthModal 并默认登录 Tab。
- 注册表单包含 username、email、password、confirmPassword。
- 登录/注册字段失焦或提交时展示校验错误。
- 移动端 375px 无横向滚动，PC 和移动端均使用 Dialog。
- 注册或登录成功后跳转最小占位 `/console`。

后端：

- 注册成功写入 PostgreSQL users 表。
- password 使用 bcrypt hash 存储，不保存明文。
- 重复 email 返回统一响应和邮箱已注册错误码。
- 重复 username 返回统一响应和 username 已存在错误码。
- 登录成功签发 Access Token，并通过 Cookie 设置 Refresh Token。
- 错误密码累计 5 次后账号锁定 15 分钟。
- `/me` 对有效 Access Token 返回当前用户。
- `/me` 对缺失、过期或无效 Access Token 返回统一认证错误。
- `/refresh` 成功轮换 Access Token 和 Refresh Token，并失效旧 Refresh Token。
- `/logout` 失效当前 Refresh Token 并清除 Cookie。

契约：

- OpenAPI 覆盖 `register/login/me/refresh/logout`。
- 认证接口响应均使用 `BaseResponse`。
- `make generate` 后前端 client 与 Go stub 和契约一致。
- 新增错误码同步记录到错误码文档。

验证入口：

- `make spec-check`
- `make generate`
- `make test-web`
- `make test-server`
- `make build`

如果现有 Makefile 目标或包脚本尚未补齐，后续实现阶段需要让这些入口可运行，或在对应阶段明确记录不能运行的原因。

## 风险、依赖与开放项

风险：

- 当前仓库是初始骨架，Full workflow 后续需要补齐前端依赖、后端 Gin/PostgreSQL 依赖、OpenAPI 生成配置和测试基础设施。
- 双 Token 与 Refresh Token 轮换需要谨慎处理旧 token 失效、并发刷新和 Cookie 属性。
- 内存限流只适合单进程 MVP，不适合多实例部署。

依赖：

- PostgreSQL 开发环境。
- bcrypt、JWT、Gin、OpenAPI 生成工具、前端表单和 UI 依赖。
- `docs/designAndPrd/api_response_and_error_codes.md` 作为统一响应和数字错误码规范。

开放项：

- `id` 字段最终命名为 `id` 还是 `uuid`，由技术设计结合数据库和 OpenAPI 命名一致性决定。
- 是否在 AuthUser 中返回 username，由技术设计结合 Header 和 Console 展示需要决定。
- Cookie 的 `SameSite`、`Secure`、`Path`、过期时间和本地开发策略由技术设计决定。
- 登录失败计数 key、全局 IP 限流阈值和时间窗口由技术设计决定。
- Refresh Token 表结构、哈希存储策略和轮换并发处理由技术设计决定。

## 决策记录

- 2026-07-02：需求切换为 `home-page-auth`，workflow 使用 Full。
- 2026-07-02：Hero 右侧使用占位预览卡片。
- 2026-07-02：「查看示例」定位到首页内占位示例预览。
- 2026-07-02：PC 和移动端统一使用 Dialog。
- 2026-07-02：后端使用真实 PostgreSQL 持久化、bcrypt 和 JWT。
- 2026-07-02：统一响应采用 `{ code, message, data }` 和数字错误码，参考 `docs/designAndPrd/api_response_and_error_codes.md`。
- 2026-07-02：增加 `/me`、`/refresh`、`/logout`。
- 2026-07-02：采用 Access Token 15 分钟内存保存、Refresh Token 7 天 HttpOnly Cookie 保存并服务端持久化。
- 2026-07-02：每次刷新 Access Token 时也轮换 Refresh Token。
- 2026-07-02：`/me` 只接受 Access Token。
- 2026-07-02：新增最小占位 Console 页面。
- 2026-07-02：用户表预留 `deleted_at`，但不实现删除账号接口。
- 2026-07-02：Gin 全局 IP 内存限流，登录接口增加账号维度失败计数，失败 5 次锁定 15 分钟。
- 2026-07-02：最终方案选择契约优先完整 Auth MVP。
