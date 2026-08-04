# LittleAgResume

[![Version](https://img.shields.io/github/package-json/v/MaiXiangCatt/littleag-resume?filename=package.json&label=version&color=bf301e)](https://github.com/MaiXiangCatt/littleag-resume/releases)
[![CI](https://github.com/MaiXiangCatt/littleag-resume/actions/workflows/ci-cd.yml/badge.svg?branch=main)](https://github.com/MaiXiangCatt/littleag-resume/actions/workflows/ci-cd.yml)
[![License](https://img.shields.io/github/license/MaiXiangCatt/littleag-resume?color=2563eb)](./LICENSE)

一个开源、免费、易用的在线简历编辑器。

[在线体验](https://littleag.com)

## 功能介绍

### 本地模式（推荐）

- 无需注册，简历仅保存在当前浏览器中。
- 支持管理最多 20 份简历，以及创建、编辑、复制、重命名、删除、搜索、筛选和排序。
- 支持 JSON 导入导出、实时 PDF 预览和 PDF 下载。
- 本地数据不会自动同步到云端；可以通过 JSON 手动转移。

> 本地模式使用 IndexedDB 作为存储方案。清理浏览器数据、使用无痕模式或磁盘空间不足都可能造成数据丢失，请及时导出 JSON 备份自己的数据。

### 登录使用（不太推荐）

- 支持在云端保存和管理多份简历。
- 支持跨设备访问，数据不依赖单个浏览器。
- 注册功能目前仅小规模开放，需要邀请码。

## 本地开发

```bash
make install
make dev-web
make dev-server
```

常用检查：

```bash
make test
make lint
make build
```

## 版本与发布

LittleAgResume 使用 [Semantic Versioning](https://semver.org/)：

- 根目录 `package.json` 的 `version` 是正式产品版本的唯一来源，日常功能和修复 PR
  不需要逐个修改它。
- Git tag 和 GitHub Release 使用相同的 `vX.Y.Z`，例如 `v0.1.0`。
- `apps/web` 和 `packages/vega-cli` 的版本仅表示内部包版本，不要求和产品版本同步。
- 每次生产构建使用完整 commit SHA 识别实际部署，保证版本检测、问题定位和回滚都指向
  不可变构建。

完整发版步骤见 [版本发布指南](./docs/releasing.md)。

## FAQ

### 以后会收费吗？

永远不会收费！

### 如何获取邀请码？

暂时可以联系作者本人获取～

## License

本项目基于 [GNU General Public License v3.0](./LICENSE) 开源。
