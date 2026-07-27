# ==========================================
# LittleAgResume - 顶层任务编排
# 命令分类：环境/契约/静态/测试/构建/部署/工具
# ==========================================

.PHONY: \
	help install clean \
	spec-check generate \
	format format-check lint lint-web lint-server lint-cli \
	test test-web test-server test-cli tdd-check e2e \
	build build-web build-server build-cli storybook docker-build deploy deploy-check backup smoke \
	dev-web dev-server db-up db-down \
	archive vega-build vega-link
.DEFAULT_GOAL := help

help: ## 列出所有可用命令
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---- 环境与初始化 ----
install:           ## 安装所有依赖（JS + Go）
	pnpm install
	cd apps/server && go mod download
	cd packages/vega-cli && pnpm link --global

clean:             ## 清理所有构建产物与缓存
	pnpm -r clean || true
	cd apps/server && go clean -cache

# ---- 契约与生成 ----
spec-check:        ## 检查 OpenSpec 变更与 OpenAPI 契约一致性
	pnpm --filter web spec:check
generate:          ## 从 OpenAPI 契约生成 TS client 与 Go stub
	pnpm --filter web gen:api
	cd apps/server && go tool oapi-codegen -config oapi-codegen.yaml ../../contracts/openapi/openapi.yaml

# ---- 静态检查 ----
format:             ## 使用 Prettier 格式化 Web App
	pnpm --filter web format
format-check:       ## 检查 Web App 的 Prettier 格式
	pnpm --filter web format:check
lint: lint-web lint-server lint-cli  ## 全量 lint
lint-web:          ## ESLint + Prettier
	pnpm --filter web lint
lint-server:       ## go vet
	$(MAKE) -C apps/server lint
lint-cli:          ## CLI 自身 lint
	pnpm --filter @vega-resume/vega-cli lint

# ---- 测试 ----
test: test-web test-server test-cli  ## 全量单元测试
test-web:          ## Vitest + RTL
	pnpm --filter web test
test-server:       ## Go test
	$(MAKE) -C apps/server test
test-cli:          ## CLI 单元测试
	pnpm --filter @vega-resume/vega-cli test
tdd-check:         ## 综合执行所有测试层，返回 red/green 状态
	@$(MAKE) test || (echo "TDD: RED" && exit 1)
	@echo "TDD: GREEN"
e2e:               ## Playwright 全链路 E2E
	pnpm --filter web e2e

# ---- 构建与部署 ----
build: build-web build-server build-cli  ## 全栈构建
build-web:         ## 构建前端
	pnpm --filter web build
build-server:      ## 构建后端
	$(MAKE) -C apps/server build
build-cli:         ## 构建 vega CLI
	pnpm --filter @vega-resume/vega-cli build
storybook:         ## 启动 Storybook UI 隔离开发环境
	pnpm --filter web storybook
docker-build:      ## Docker 镜像构建
	docker compose --env-file .env.prod -f deploy/docker-compose.yml build
deploy-check:      ## 只校验生产 Compose，不输出展开后的密钥
	docker compose --env-file .env.prod -f deploy/docker-compose.yml config --quiet
deploy:            ## 部署到自有服务器
	docker compose --env-file .env.prod -f deploy/docker-compose.yml up -d --build
backup:            ## 备份生产 PostgreSQL 与头像到 BACKUP_DIR
	./scripts/backup-production.sh
smoke:             ## 部署后冒烟测试
	curl --fail --silent --show-error http://127.0.0.1:8080/ >/dev/null
	docker compose --env-file .env.prod -f deploy/docker-compose.yml ps

# ---- 开发环境 ----
dev-web:           ## 启动前端开发服务器
	pnpm --filter web dev
dev-server:        ## 启动后端开发服务器
	cd apps/server && go run ./cmd/api
db-up:             ## 启动 PostgreSQL (Docker)
	docker compose -f deploy/docker-compose.dev.yml up -d postgres
db-down:           ## 停止 PostgreSQL
	docker compose -f deploy/docker-compose.dev.yml down

# ---- 归档 ----
archive:           ## 归档已完成需求，同步 docs 与规则文件
	vega archive

# ---- vega CLI ----
vega-build:        ## 构建 vega CLI
	pnpm --filter @vega-resume/vega-cli build
vega-link:         ## 本地全局链接 vega
	cd packages/vega-cli && pnpm link --global
