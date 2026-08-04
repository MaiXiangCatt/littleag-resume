# LittleAgResume 版本发布指南

## 版本来源

正式产品版本只在根目录 `package.json` 中维护。README 的版本徽章会自动读取这个字段。

Web App 和 Vega CLI 是私有工作区包，它们的 `package.json` 版本不代表产品版本，无需跟随产品一起修改。生产镜像继续使用完整 commit SHA，不额外维护一份可变版本号。

日常功能和修复 PR 不需要修改产品版本。前端构建会同时记录产品版本和 commit SHA，
并使用 SHA 判断线上是否出现了新构建；因此连续部署多个同版本提交也不会影响版本识别。
只有准备创建 Git tag 和 GitHub Release 时，才在单独的 Release PR 中修改产品版本。

## 版本规则

LittleAgResume 使用 Semantic Versioning：

- `PATCH`：向后兼容的修复，例如 `0.1.0 → 0.1.1`。
- `MINOR`：向后兼容的新功能，例如 `0.1.1 → 0.2.0`。
- `MAJOR`：稳定版本后的破坏性变更，例如 `1.4.0 → 2.0.0`。
- `0.x` 阶段如果出现破坏性变更，提升 `MINOR`。
- 测试版本使用 `v0.2.0-beta.1` 这样的预发布标签。

## 发布流程

### 1. 确定版本并更新唯一来源

在单独的 Release PR 中执行：

```bash
pnpm pkg set version=0.1.0
```

这里使用 `pnpm pkg set`，因为它只更新 `package.json`。不要直接运行 `pnpm version`；后者会在干净的 Git 工作区中自动创建 commit 和 tag，不适合当前先审查、后发布的流程。

### 2. 验证并合入 `main`

```bash
make test
make lint
make build
git diff --check
```

提交版本变更，并通过 PR 合入 `main`：

```bash
git add package.json
git commit -m "chore: release v0.1.0"
```

等待 `main` 上的 CI 和生产部署完成，再创建 Release。不要给尚未进入 `main` 的提交打正式版本标签。

### 3. 创建 GitHub Release

1. 打开仓库的 **Releases** 页面。
2. 选择 **Draft a new release**。
3. 创建与 `package.json` 一致的 tag，例如 `v0.1.0`，目标选择刚通过 CI 的 `main` 提交。
4. Release title 使用同一个版本号。
5. 点击 **Generate release notes**，检查自动生成的内容。
6. 正式版本选择 **Set as latest release**；测试版本选择 **Pre-release**。
7. 发布 Release。

GitHub Release 建立在 Git tag 之上；tag 固定代码位置，Release 则补充发布说明和下载入口。发布后不要移动或复用已有的正式版本 tag。

## 首次发布建议

当前项目仍处于邀请制和早期迭代阶段，可以根据实际发布范围选择 `PATCH` 或 `MINOR`
版本。普通 PR 不需要提前猜测下一个版本；准备发布时统一创建 Release PR 即可。
