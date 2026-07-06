# Home Page Auth 质量验证报告

## 验证范围

- Requirement: `home-page-auth`
- OpenSpec change: `openspec/changes/home-page-auth`
- Modules: `contract-tooling-foundation`, `server-auth-core`, `web-auth-shell`, `home-page-ui`, `integration-auth-flow`
- Verified diff: 后端数据库层从 `database/sql` + SQL migration 文件调整为 GORM + `AutoMigrate` + GORM repository；同步更新 OpenSpec、tech design、breakdown 文档。

## 命令结果

| Command | Result | Notes |
| --- | --- | --- |
| `npx ctx7@latest library GORM ...` | Pass | 选用 `/websites/gorm_io` 官方文档源。 |
| `npx ctx7@latest docs /websites/gorm_io ...` | Pass | 覆盖 GORM CRUD、`AutoMigrate` 和 transaction 用法。 |
| `go test ./internal/repository` | Pass | 新增 GORM migration/repository 测试先因缺依赖失败，补齐实现后通过。 |
| `make test-server` | Pass | Go 后端全部测试通过。 |
| `make lint-server` | Pass | `go vet ./...` 通过。 |
| `make build-server` | Pass | 后端 API 构建通过。 |
| `openspec validate home-page-auth --strict --json` | Pass | change valid；PostHog 遥测 flush DNS 失败不影响命令退出与 JSON 主体。 |
| `openspec instructions apply --change home-page-auth --json` | Pass | 35/35 tasks complete，state `all_done`。 |
| `vega verify --json` | Pass | Vega 状态文件完整。 |
| `make spec-check` | Pass | OpenAPI 契约与生成配置一致。 |
| `make lint` | Pass | Web lint、server vet、CLI lint 目标通过；CLI 包当前无 lint script。 |
| `make test` | Pass | Web 8 files/25 tests、server tests、CLI 15 tests 通过。 |
| `make build` | Pass | Web、server、CLI 构建通过。 |

## 问题清单

| Severity | Area | File | Finding | Resolution |
| --- | --- | --- | --- | --- |
| Medium | Persistence | `apps/server/internal/repository/postgres.go` | 原实现使用 `database/sql` 和独立 SQL migration 文件，不符合最新要求。 | 已替换为 GORM store、`AutoMigrate` 和 GORM migration helper，并删除旧 SQL 文件。 |
| Low | Docs | `.vega-harness/docs/*`, `openspec/changes/home-page-auth/*` | 设计文档仍描述 SQL migration 和 `database/sql`。 | 已同步改为 GORM 方案。 |

## 反退化检查

- Security: Refresh Token 仍只存 hash；GORM 迁移没有引入明文 token 或日志泄漏。
- Architecture: handler/service/repository/model 分层保持不变；服务层仍依赖 repository 接口，数据库实现细节收敛在 repository。
- Complexity: GORM store 单文件承担连接、迁移和仓储实现，规模仍可控；无跨模块重构。
- Dead code: 删除 `apps/server/migrations/001_auth.sql`，代码中无 `database/sql`、pgx stdlib 或 `NewPostgresStore` 引用。
- Test quality: 新增测试验证 GORM schema/index migration 和真实 GORM repository 行为，不只断言 mock。
- Contract/docs: OpenAPI shape 未变；OpenSpec strict validation 和 spec-check 通过。

## 结论

- Result: Pass
- Remaining follow-ups: 生产环境如果需要可审计的历史迁移版本，应在后续需求中引入 GORM-compatible migration versioning；当前 MVP 按用户要求统一为 GORM `AutoMigrate`。
