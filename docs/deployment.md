# LittleAgResume 生产部署指南

本文给第一次部署自有项目的人使用。推荐的第一版架构是：

```text
浏览器
  │ HTTPS
  ▼
Caddy（宿主机，自动申请和续期证书）
  │ 127.0.0.1:8080
  ▼
web 容器（Nginx + 前端静态文件）
  ├─ /api/* ─► server 容器（Go + Chromium PDF）
  └──────────► PostgreSQL 容器
```

宿主机只需要安装 Docker Engine、Docker Compose 插件和 Caddy。Node.js、Go、Chromium 和
PostgreSQL 都由镜像提供，不需要重复安装到宿主机。

## 1. 上线前准备

- 一台 Linux 服务器，建议 Ubuntu 24.04 LTS，至少 2 核 CPU、4 GB 内存；PDF 打印会使用
  Chromium，1 GB 内存通常过于紧张。
- 域名的 `A` 记录指向服务器公网 IPv4；使用 IPv6 时再配置 `AAAA`。
- 防火墙/安全组只向公网开放 `22`、`80`、`443`，不要开放 PostgreSQL 的 `5432`。
- 按 Docker 和 Caddy 官方文档安装软件，不要使用来历不明的一键脚本。
- 在 Resend 中验证发件域名，并准备生产 API Key。

## 2. 准备代码和配置

把代码拉到服务器后，在仓库根目录执行：

```bash
cp apps/server/.env.prod.example .env.prod
mkdir -p .secrets
umask 077
openssl rand -base64 48 > .secrets/postgres_password
```

`.env.prod` 和 `.secrets/` 已被 Git 忽略。编辑 `.env.prod`，至少完成这些配置：

- `ACCESS_TOKEN_KEY`：使用 `openssl rand -hex 32` 生成。
- `EMAIL_VERIFICATION_KEY`：再次独立执行 `openssl rand -hex 32`，不能复用上一个密钥。
- `RESEND_API_KEY`：填写 Resend 的生产密钥。
- `MAIL_FROM`：填写已经验证的发件域名。
- `TRUSTED_PROXIES`：当前 Docker 网络可保留默认私网网段；后续调整网络时需要同步收窄。

不要把任何真实密钥写入 Dockerfile、Compose YAML、GitHub 仓库或聊天记录。`.env.prod` 建议
权限设为 `600`：

```bash
chmod 600 .env.prod .secrets/postgres_password
```

## 3. 第一次启动

正式 CI/CD 启用前，仍可在服务器本地构建一次作为首发版本：

```bash
make deploy-check
make docker-build
IMAGE_TAG=local make deploy
IMAGE_TAG=local docker compose --env-file .env.prod -f deploy/docker-compose.yml logs --tail=100 server
```

不要在生产终端或 CI 中直接运行 `docker compose config` 并保存输出，它会展开环境变量中的密钥；
`make deploy-check` 使用 `config --quiet`，只校验而不打印展开后的配置。

`make docker-build` 只用于首次启动或 CI/CD 故障时的本地应急构建；正常发布由 GitHub Actions
构建镜像，服务器不再编译代码。`make deploy` 会调用同一份生产部署脚本，拉取 `IMAGE_TAG`
指定的镜像；没有显式传入时会重新部署 `.deploy/current-image-tag` 中记录的上次成功版本。

数据库结构由服务端启动时自动迁移。Web 只绑定到宿主机的 `127.0.0.1:8080`，不会绕过
HTTPS 直接暴露公网。

执行 `make smoke` 可检查首页是否能够从宿主机访问。首次启动失败时，优先看上面的 `server`
日志，而不是反复重启。

## 4. 配置域名和 HTTPS

仓库提供了包含 Cloudflare 真实 IP、访问日志和基础安全响应头的
[`deploy/Caddyfile.example`](../deploy/Caddyfile.example)。首次部署可复制到宿主机：

```bash
sudo cp deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
```

检查并重载：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

模板中的 Cloudflare 网段来自 Cloudflare 官方清单。Cloudflare 可能更新网段，变更 Caddy 配置或
安全组前应重新核对
[`https://www.cloudflare.com/ips/`](https://www.cloudflare.com/ips/)。

### 阻止绕过 Cloudflare 直连源站

Caddy 的 `trusted_proxies` 只负责安全地解析真实用户 IP，不能阻止攻击者直接请求服务器公网
IP。还需要在腾讯云轻量应用服务器控制台完成：

1. 进入实例详情的**防火墙**页面。
2. 保留 SSH `22`，并把来源限制为自己的固定公网 IP（如果暂时没有固定 IP，可先保留当前
   规则，确认不会把自己锁在门外）。
3. 为 `80`、`443` 分别添加 Cloudflare 官方 IPv4 网段；实例启用了 IPv6 时再添加 IPv6 网段。
4. 先验证网站、证书续期链路和 PDF 导出正常，再删除 `80/443` 来源为 `0.0.0.0/0` 或 `::/0`
   的宽泛规则。

Cloudflare 当前有 22 个 IPv4/IPv6 网段，低于轻量应用服务器单实例 100 条防火墙规则的限制。
更省心的长期方案是 Cloudflare Tunnel：由服务器主动连接 Cloudflare，届时源站无需向公网
开放 `80/443`。

域名已正确解析且公网可访问 80/443 时，Caddy 会自动申请并续期 HTTPS 证书。随后检查：

- `https://littleag.com` 能打开。
- 注册验证码邮件能收到。
- 登录、创建简历、上传头像、自动保存均正常。
- 导出一份包含中文、Markdown、头像的 PDF，并检查版式。
- 浏览器开发者工具中没有 Mixed Content 或跨域错误。

## 5. 数据持久化和备份

Compose 的 `pgdata` 与 `avatars` 卷会在重建容器后保留，但服务器磁盘损坏或误删卷时仍会
丢失。仓库里的备份脚本会同时导出 PostgreSQL 和头像：

```bash
sudo BACKUP_DIR=/var/backups/littleag-resume make backup
sudo ls -lh /var/backups/littleag-resume
```

这个命令会生成 PostgreSQL custom-format dump、头像压缩包及 SHA-256 校验文件。它只能算本机
暂存，必须再同步到腾讯云 COS、另一台服务器或其他对象存储；与数据库放在同一块系统盘上的
备份无法抵御磁盘损坏或服务器被销毁。

可以通过 root 的 cron 每天执行一次：

```cron
17 3 * * * cd /home/ubuntu/vega-resume && BACKUP_DIR=/var/backups/littleag-resume /usr/bin/make backup >> /var/log/littleag-backup.log 2>&1
```

随后再增加 COSCLI/rclone 上传任务，并在上传成功后设置对象存储生命周期，例如保留每日备份
30 天、每月备份 12 个月。不要在备份脚本或 crontab 中写 COS SecretKey，使用权限受限的
凭据文件并设为 `600`。

至少每月做一次恢复演练；没有实际恢复过的备份不能算可靠备份。轻量应用服务器快照可以用于
系统升级前快速回滚，但实例销毁时其快照也可能一起删除，不能替代数据库的异机备份。

GitHub Actions 触发的生产部署会先调用备份脚本，再更新应用镜像。升级前仍应确认异机备份链路
正常。不要运行 `docker compose down -v`，其中 `-v` 会删除数据库和头像卷。

## 6. 日志轮转与磁盘告警

生产 Compose 已给 PostgreSQL、Go 服务和 Web 容器统一配置 Docker `local` 日志驱动：
单文件最大 20 MB、每个容器最多 5 个文件并自动压缩。更新后需要重新创建容器才能生效：

```bash
make deploy
docker inspect littleag-resume-server-1 --format '{{.HostConfig.LogConfig.Type}} {{json .HostConfig.LogConfig.Config}}'
```

容器名可能因部署目录不同而变化，可先用 `docker compose ... ps` 查看。Caddy 示例把访问日志
写到 stdout，systemd 会交给 journald 管理：

```bash
sudo journalctl -u caddy -f
IMAGE_TAG="$(<.deploy/current-image-tag)" docker compose --env-file .env.prod -f deploy/docker-compose.yml logs -f --tail=200 server web
```

磁盘告警不应该由业务进程自己实现。在腾讯云轻量应用服务器控制台进入
**实例详情 → 监控 → 设置告警**，建议至少设置：

- 系统盘使用率连续 5 分钟达到 `80%`：微信/邮件预警。
- 系统盘使用率连续 5 分钟达到 `90%`：短信或电话紧急告警。
- CPU 或内存连续 10 分钟达到 `90%`：预警。
- 实例不可达：立即告警。

首次配置后应主动把磁盘阈值临时调低做一次通知测试，再恢复正式阈值，确认告警联系人确实能
收到消息。

## 7. GitHub Actions CI/CD

仓库中的 [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) 实现以下链路：

1. Pull Request 和 `main` push 都执行 OpenAPI 生成校验、format、lint、test、build。
2. `main` 全部通过后，分别构建 Web/Server 镜像，以完整 commit SHA 为唯一 tag 推送到 GHCR。
3. `deploy_production` job 进入 GitHub `production` Environment，等待人工审批。
4. 审批后只把 Compose 和两个部署脚本同步到服务器，再通过 SSH 部署这个固定 SHA。
5. 部署前备份 PostgreSQL 和头像；部署后轮询容器状态和 `/api/healthz`。
6. 健康检查失败时切回 `.deploy/current-image-tag` 记录的上一成功镜像，并让本次 Action 保持失败，
   方便继续排查。

### 7.1 GitHub 仓库设置

在仓库 **Settings → Actions → General** 中允许 Actions 运行。**Workflow permissions**
保持较安全的 **Read repository contents and packages permissions** 即可，不需要切换成全局
**Read and write permissions**；Workflow 会只在镜像发布 job 中显式申请 `packages: write`，
其余 job 仍保持只读。然后在 **Settings → Environments** 创建 `production`：

- 配置 **Required reviewers**，选择自己作为生产审批人。
- 如果只有自己审批，不要开启 **Prevent self-review**，否则自己触发的部署无法由自己批准。
- 建议只允许 `main` 分支部署到这个 Environment。
- 在 Environment secrets 中创建以下值：

GitHub Free/Pro/Team 的 required reviewers 目前只对 public 仓库开放；private 仓库要先确认当前
套餐是否支持这条保护规则。若界面里没有 Required reviewers，不要把删除人工确认当作替代方案，
应先升级套餐或暂时保留现有手工发布步骤。

| Secret                   | 内容                                                    |
| ------------------------ | ------------------------------------------------------- |
| `PRODUCTION_HOST`        | 服务器域名或 IPv4，不带协议                             |
| `PRODUCTION_PORT`        | SSH 端口，通常是 `22`                                   |
| `PRODUCTION_USER`        | 专用部署用户，例如 `deploy`                             |
| `PRODUCTION_DEPLOY_PATH` | 服务器部署目录绝对路径，例如 `/home/deploy/vega-resume` |
| `PRODUCTION_SSH_KEY`     | 专用部署私钥的完整内容                                  |
| `PRODUCTION_KNOWN_HOSTS` | 已核对指纹的 SSH host key 记录                          |

不要把 `.env.prod`、PostgreSQL 密码、Resend Key 或 GHCR PAT 放进这些部署文件；它们继续只保留
在服务器。建议再在 **Settings → Branches → Branch protection rules** 中保护 `main`，要求
`Test, lint, and build` 检查通过后才能合并。

Workflow 使用 `GITHUB_TOKEN` 发布 GHCR 包。第一次发布后，在 GitHub 用户/组织的
**Packages** 页面确认 `littleag-resume-web` 和 `littleag-resume-server` 已关联当前仓库，并且
仓库的 Actions 对两个包都有写权限。

### 7.2 服务器一次性准备

创建一个非 root 部署用户，让它只能通过密钥登录，并允许执行 Docker。下面的用户名和目录要
与 GitHub secrets 保持一致：

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
sudo install -d -o deploy -g deploy -m 700 /home/deploy/vega-resume
```

在可信电脑上创建一把只用于这套 CD 的密钥：

```bash
ssh-keygen -t ed25519 -C "github-actions-vega-resume" -f ./vega-resume-deploy
```

把公钥内容追加到服务器 `/home/deploy/.ssh/authorized_keys` 并设为 `600`；私钥内容放入
`PRODUCTION_SSH_KEY`。通过服务器控制台或已有可信连接核对 SSH host key 指纹，再把对应的
known_hosts 行放入 `PRODUCTION_KNOWN_HOSTS`。不要在未核对指纹时直接信任 `ssh-keyscan`
结果。

若 GHCR 包是 private，在 GitHub 创建只授予 `read:packages` 的 token，并在服务器以
`deploy` 用户完成一次登录：

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

在 `PRODUCTION_DEPLOY_PATH` 中保留现有 `.env.prod` 和 `.secrets/postgres_password`。如果是
全新目录：

```bash
cd /home/deploy/vega-resume
mkdir -p .secrets
chmod 700 .secrets
# 从安全渠道写入 .env.prod 和 .secrets/postgres_password
chmod 600 .env.prod .secrets/postgres_password
```

部署用户还需要可执行 `docker compose` 和 `curl`。GitHub Actions 会自动同步
`deploy/docker-compose.yml`、`scripts/deploy-production.sh` 和备份脚本，不需要再
`git pull`。

### 7.3 首次切换与日常发布

首次切换前先手动执行一次 `make backup` 并把备份复制到异机存储。合并本次 CI/CD 变更后，
观察 Actions：质量门禁和两个镜像发布完成时，`Deploy production` 会等待审批。批准后脚本会
保存第一个成功 SHA；从第二次 CD 部署开始，失败时才能自动回滚到上一 SHA。

日常流程只需要合并到 `main`、等待 CI、检查待发布 commit，再批准 production。紧急手工回滚
可在服务器执行：

```bash
cd /home/deploy/vega-resume
IMAGE_TAG=<完整的40位成功commit SHA> make deploy
```

镜像回滚不会自动回滚数据库 schema。当前服务启动时使用 GORM `AutoMigrate`，不会删除未使用
列，但可能创建表、列、索引、约束或调整部分列类型。以后涉及不向后兼容的数据迁移时，必须使用
显式的版本化迁移和单独设计的数据库回退方案，不能只依赖旧镜像回滚。

## 8. 上线 TODO

### 必须完成

- [ ] DNS 指向服务器，安全组只开放 22/80/443。
- [ ] 安装 Docker Engine、Compose 插件与 Caddy。
- [ ] 创建 `.env.prod` 和数据库 secret，所有密钥使用生产值。
- [ ] 轮换任何曾经出现在仓库、截图或聊天中的 Resend/API 密钥。
- [ ] 启动容器并检查日志、注册、保存、头像和 PDF 全链路。
- [ ] 配置 HTTPS。
- [ ] 配置异机数据库与头像备份，并实际验证一次恢复。

### 上线后尽快完成

- [ ] 在 GitHub 配置 `production` Environment、审批人和部署 secrets。
- [ ] 给部署用户配置 SSH、Docker 与 GHCR 只读权限，完成首次 CD 切换。
- [ ] 增加服务健康检查、磁盘/内存/CPU 告警和错误日志告警。
- [ ] 给登录、注册验证码、PDF 导出分别设置更细的反向代理限流。
- [ ] 建立依赖更新、镜像漏洞扫描和密钥轮换流程。
- [ ] 准备数据库迁移和上一版本镜像的回滚演练。
