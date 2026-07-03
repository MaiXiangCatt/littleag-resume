# VegaResume — Home Page 详细 PRD v3.0

> 原始来源：`docs/designAndPrd/home_page_prd_v3.md`

**文档状态**: 草稿  
**创建日期**: 2026-06-30  
**所属模块**: 落地页 / Home Page  
**上游文档**: `docs/designAndPrd/resume_mvp_prd_v2.md`  
**变更说明**: v3.0 将 Header 改为全局共享组件（slot 注入页面特色按钮）；移除原生 HTML 组件描述，统一使用 shadcn/ui + Tailwind CSS

---

## 1. 背景与目标

### 1.1 背景

Home Page 是用户进入 VegaResume 的第一个页面，承担品牌认知、功能传达、用户转化三重职责。MVP 阶段对应路由 `/`，未登录用户默认落地此页，已登录用户访问 `/` 时直接跳转 `/console`。

### 1.2 页面目标

| 指标 | 目标值 |
|------|--------|
| 用户在 10 s 内理解产品核心价值 | ✅ 验收标准 |
| 点击「立即开始」→ 注册完成 → 跳转 Console 全链路可用 | ✅ 验收标准 |
| LCP（最大内容绘制） | ≤ 2.5 s（桌面 Fast 3G） |
| 移动端 375 px 宽度无横向滚动条 | ✅ 验收标准 |

---

## 2. 用户故事

```
作为一个正在求职的候选人，
我希望在首页快速了解 VegaResume 能为我做什么、是否免费，
以便决定是否注册并开始制作简历。
```

---

## 3. 页面整体结构

```
┌─────────────────────────────────────┐
│  全局组件：AppHeader（sticky）        │
│  slot: actions=<登录按钮>            │
├─────────────────────────────────────┤
│  模块 1：Hero Section               │
│  （视口高度，左文字右预览图两栏布局）  │
├─────────────────────────────────────┤
│  模块 2：Features Section           │
│  （3 列特性卡片）                    │
├─────────────────────────────────────┤
│  模块 3：Footer                     │
└─────────────────────────────────────┘
```

路由守卫逻辑（在 `pages/home/hooks/useHomeGuard.ts` 中实现）：

```
访问 /
  ├── 已登录 → redirect /console
  └── 未登录 → 渲染 Home Page
```

---

## 4. 全局组件 — AppHeader

> AppHeader 是全项目共用的顶栏组件，位于 `shared/components/AppHeader/`。
> 各页面通过 `actions` prop 注入页面专属按钮区域，AppHeader 自身不感知具体页面。

### 4.1 视觉规格

- **高度**：64 px（桌面）/ 56 px（移动）
- **位置**：`sticky top-0 z-50`（Tailwind）
- **背景**：初始透明；页面滚动超过 80 px 后切换为白色背景 + 细底部阴影，过渡 200 ms

### 4.2 组件接口（Props）

```typescript
interface AppHeaderProps {
  /** 右侧页面专属操作区，由各页面自行传入 */
  actions?: ReactNode
}
```

### 4.3 固定内容（所有页面一致）

| 区域 | 内容 | 行为 |
|------|------|------|
| Logo（左侧） | VegaResume 图标 + 文字，使用品牌色 | 点击跳转 `/` |
| 用户区（右侧固定区） | 见下方登录态说明 | — |
| 页面 actions 插槽（用户区左侧） | 由各页面传入，Home Page 传登录按钮 | — |

### 4.4 用户区状态（全局共享，读取 `shared/store/auth.store`）

**未登录状态**：用户区不渲染任何内容（登录按钮由 Home Page 通过 `actions` 传入，其他页面各自决定）

**已登录状态**：

- 展示用户头像（Avatar，32 px 圆形，shadcn/ui `Avatar` 组件）
- 点击 → shadcn/ui `DropdownMenu`，选项：
  - "进入控制台" → 跳转 `/console`
  - "退出登录" → 调用 `useAuth` hook 中的 `logout()`，清空 JWT，留在当前页

### 4.5 Home Page 传入的 actions

```tsx
// pages/home/index.tsx
<AppHeader
  actions={
    <Button variant="outline" onClick={openLoginModal}>
      登录
    </Button>
  }
/>
```

仅在未登录状态下展示（由 `useHomeGuard` 或父组件控制渲染）。

### 4.6 响应式

| 断点 | 变化 |
|------|------|
| ≥ 768 px | Logo 图标 + 文字；actions 区完整展示 |
| < 768 px | Logo 仅图标；actions 区照常展示（登录按钮保留） |

---

## 5. 模块 1 — Hero Section

### 5.1 视觉规格

- **高度**：`min-h-screen`（Tailwind），最小 600 px
- **布局**：桌面两栏（左文字约 50% + 右预览图约 50%）；移动单栏（文字在上，预览图在下）
- **背景**：纯白（`bg-white`），右侧预览区域有品牌紫色大圆形装饰背景（`absolute`，不参与布局流）

### 5.2 左栏 — 文字区

#### 品类标签（Badge）

位于主标题上方，shadcn/ui `Badge` 组件，浅紫色背景 + 深紫色文字：

```
✦ 100% 免费 · 无水印
```

#### 主标题（H1）

```
轻松制作
让你脱颖而出的简历
```

- Tailwind：`text-5xl font-bold leading-tight`（桌面）/ `text-3xl`（移动）
- "脱颖而出的简历"部分使用品牌紫色高亮（`text-primary`）

#### 副标题

```
几分钟生成专业简历，提供现代模板与清晰排版，
帮助你更高效地完成求职准备。
```

- Tailwind：`text-lg text-muted-foreground`（桌面）/ `text-base`（移动）

#### CTA 按钮组

使用 shadcn/ui `Button` 组件：

- **主按钮**："立即开始 →"（`variant="default"`，品牌紫色，`size="lg"`，带 Sparkles 图标）
  - 点击 → 调用 `useAuthModal` hook 打开弹窗，默认激活「注册」Tab
- **次按钮**："查看示例"（`variant="outline"`，`size="lg"`，带文档图标）
  - 点击 → 跳转模板预览页（MVP 阶段见 OQ-02）

#### 底部免责小字

```
✓ 永久免费，无需注册。
```

- Tailwind：`text-sm text-muted-foreground`

### 5.3 右栏 — 产品预览图

- 内容：简历编辑器界面截图（含头像区域、各信息模块），`rounded-xl shadow-xl`
- 背景：品牌紫色大圆形装饰，`absolute`，`z-0`；预览图 `relative z-10`
- 图片懒加载，显式声明尺寸防 CLS；WebP 格式，宽度 ≤ 800 px
- MVP 阶段可先用占位区块（aspect-ratio 3:4，`bg-muted rounded-xl`）

### 5.4 响应式

| 断点 | 布局变化 |
|------|--------|
| ≥ 1024 px | 两栏，左文字右图片，`items-center` |
| 768 px – 1023 px | 两栏，图片缩小至 45% |
| < 768 px | 单栏，文字在上，图片在下，图片宽度 `w-[90%] mx-auto` |

---

## 6. 模块 2 — Features Section

### 6.1 视觉规格

- **内边距**：`py-20 px-6`（桌面）/ `py-14 px-4`（移动）
- **背景**：`bg-muted`，与 Hero Section 白色背景形成分隔
- **无独立 Section 大标题**（依据设计稿，卡片直接呈现）

### 6.2 三张特性卡片

| # | 图标（lucide-react） | 标题 | 描述 |
|---|------|------|------|
| 1 | `FileText` | **100% 免费** | 免费创建并下载简历，无隐藏费用，无订阅限制。 |
| 2 | `Droplets` | **无水印** | 导出的简历干净专业，全程不添加任何水印。 |
| 3 | `LayoutTemplate` | **现代模板** | 提供美观且适合求职场景的模板，易于自定义。 |

### 6.3 卡片样式

使用 shadcn/ui `Card` 组件：

- 卡片：`bg-white rounded-xl p-6`，无 border（浅灰背景下自然分离）
- 图标容器：`w-12 h-12 bg-muted rounded-lg flex items-center justify-center`
- 悬停：`hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200`

### 6.4 布局网格

| 断点 | 列数 |
|------|------|
| ≥ 768 px | `grid grid-cols-3 gap-6` |
| < 768 px | `grid grid-cols-1 gap-4` |

---

## 7. 模块 3 — Footer

### 7.1 内容

- **左**："© 2026 VegaResume. 基于 MIT 协议开源。"
- **右**：GitHub 图标（lucide-react `Github`）链接 → `https://github.com/MaiXiangCatt/vega-resume`（新标签打开）

### 7.2 视觉规格

- **高度**：`h-16`，`bg-muted`
- **布局**：`flex items-center justify-between px-6`
- **文字**：`text-sm text-muted-foreground`

---

## 8. 模块 4 — 登录/注册弹窗（AuthModal）

> **组件归属**：`pages/home/components/AuthModal/`（仅 Home Page 使用，暂不提升至 shared）

### 8.1 触发时机

| 触发来源 | 默认激活 Tab |
|---------|------------|
| AppHeader actions 中的「登录」按钮 | 登录 |
| Hero Section「立即开始」按钮 | 注册 |

### 8.2 弹窗外观

使用 shadcn/ui `Dialog` 组件：

- **宽度**：`max-w-md w-full`（桌面）/ 移动端底部抽屉（`Sheet` 组件，见 OQ-03）
- **关闭方式**：点击遮罩 / 右上角 × 按钮 / 按 `Esc` 键（Dialog 默认行为）
- **动画**：shadcn/ui 内置 fade-in + scale，无需额外配置

### 8.3 Tab 切换

使用 shadcn/ui `Tabs` 组件，包含「登录」「注册」两个 Tab：

- Tab 切换不关闭弹窗
- 弹窗打开时焦点自动移入第一个表单字段（Dialog 内置 focus trap）

### 8.4 Tab — 登录

#### 表单字段（shadcn/ui Form + react-hook-form + zod）

| 字段 | 组件 | 校验规则 |
|------|------|---------|
| 邮箱 | `FormField` + `Input`（shadcn/ui） | 非空；合法邮箱格式 |
| 密码 | `FormField` + `Input`（shadcn/ui，`type="password"`） | 非空；最少 8 位 |

#### 行为

1. 点击「登录」按钮 → `useAuth` hook 调用 `authService.login()`
2. **成功**：存储 JWT，关闭弹窗，跳转 `/console`
3. **失败（401）**：表单顶部展示 shadcn/ui `Alert`（destructive variant）"邮箱或密码不正确。"
4. **失败（网络错误）**：同上，提示"服务异常，请稍后重试。"
5. 字段失焦触发 zod 校验，错误信息通过 `FormMessage` 展示在字段下方

#### 底部切换文字

"还没有账号？**立即注册**" → 切换到「注册」Tab

### 8.5 Tab — 注册

#### 表单字段（shadcn/ui Form + react-hook-form + zod）

| 字段 | 组件 | 校验规则 |
|------|------|---------|
| 邮箱 | `FormField` + `Input` | 非空；合法邮箱格式；后端 409 时 `setError` 显示"该邮箱已注册" |
| 密码 | `FormField` + `Input`（password） | 非空；最少 8 位；含至少 1 个数字或特殊字符 |
| 确认密码 | `FormField` + `Input`（password） | 与密码字段值相同（zod `refine` 校验） |

#### 行为

1. 点击「创建账号」按钮 → `useAuth` hook 调用 `authService.register()`
2. **成功**：自动登录（后端同时返回 JWT），存储 token，关闭弹窗，跳转 `/console`
3. **失败（409）**：调用 `form.setError('email', { message: '该邮箱已注册，请直接登录。' })`
4. **失败（其他）**：表单顶部展示 `Alert`（destructive variant）

#### 底部切换文字

"已有账号？**去登录**" → 切换到「登录」Tab

### 8.6 Loading 状态

- 提交按钮：`disabled` + shadcn/ui `Button` 内嵌 `Loader2`（lucide-react）旋转图标 + 文字"登录中…"/"注册中…"
- 防止重复提交（hook 层用 `isLoading` 状态守卫）

---

## 9. 非功能性需求

### 9.1 性能

| 指标 | 目标 |
|------|------|
| LCP | ≤ 2.5 s（桌面 Fast 3G） |
| CLS | ≤ 0.1 |
| 首屏 JS Bundle | ≤ 150 KB（gzipped） |
| 图片 | WebP 格式，懒加载，Hero 图显式声明尺寸防 CLS |

### 9.2 响应式断点

| 名称 | 范围 | 说明 |
|------|------|------|
| mobile | < 768 px | 单栏布局，弹窗为底部抽屉（Sheet） |
| tablet | 768 px – 1023 px | 两栏布局（部分压缩） |
| desktop | ≥ 1024 px | 完整布局 |

### 9.3 浏览器兼容性

- Chrome 最新两个大版本
- Firefox 最新两个大版本
- Safari 16+
- Edge 最新两个大版本

---

## 10. 前端实现规范

### 10.1 UI 组件库约束

- **所有 UI 组件必须使用 shadcn/ui**，禁止使用原生 HTML 表单元素（`<input>`、`<button>` 等）直接渲染到页面
- 样式使用 **Tailwind CSS utility class**，禁止内联 style 和独立 CSS 文件（除非 Tailwind 无法实现）
- 图标统一使用 **lucide-react**

### 10.2 五层架构约束

前端代码严格遵守以下越层禁止规则：

| 层级 | 职责 | 禁止 |
|------|------|------|
| **components/**（UI 组件） | 视图渲染 + 用户事件传递 | 禁止直接调用 `services`；禁止直接修改 `store`；只能通过 `hooks` 桥接或派发 |
| **hooks/**（自定义 Hook） | 编排 `services` 与 `store`；处理页面级副作用与业务流程 | — |
| **services/**（业务逻辑） | 纯业务逻辑与 API 请求封装，无 UI 依赖 | 必须能在 Node.js / 测试环境中独立运行 |
| **store/**（全局状态） | 全局状态定义（Zustand）；暴露基础 state 和纯粹 action | 禁止包含复杂业务逻辑 |
| **models/**（类型与纯函数） | TS 类型定义 + 纯函数（数据转换、格式化） | 绝对禁止任何副作用 |

### 10.3 目录归属原则

- **页面专属**的 components、hooks、services、store、models 全部内聚到 `pages/<page-name>/` 下
- **多页面共用**的才提升到 `src/shared/` 对应子目录

### 10.4 Home Page 完整目录结构

```
apps/web/src/
├── shared/                                  # 全局共用（多页面复用才放这里）
│   ├── components/
│   │   └── AppHeader/
│   │       ├── AppHeader.tsx                # 全局顶栏，接收 actions prop
│   │       ├── UserAvatarMenu.tsx           # 已登录用户头像 + 下拉菜单
│   │       └── AppHeader.test.tsx
│   ├── hooks/
│   │   └── useAuth.ts                       # 登录态读取（从 auth.store）、logout
│   ├── services/
│   │   └── http.client.ts                   # fetch/axios 封装，统一 base URL + token 注入
│   ├── store/
│   │   └── auth.store.ts                    # JWT 存储、全局登录态（Console/Editor 也需要）
│   └── models/
│       ├── api.model.ts                     # ApiResponse<T> 等通用类型
│       └── auth.model.ts                    # AuthUser、LoginPayload、RegisterPayload
│
└── pages/
    └── home/
        ├── index.tsx                         # 页面入口，组合各模块
        ├── components/                       # Home Page 专属 UI 组件
        │   ├── HeroSection/
        │   │   ├── HeroSection.tsx
        │   │   └── HeroSection.test.tsx
        │   ├── FeaturesSection/
        │   │   ├── FeaturesSection.tsx
        │   │   └── FeatureCard.tsx
        │   ├── Footer/
        │   │   └── Footer.tsx
        │   └── AuthModal/
        │       ├── AuthModal.tsx             # Dialog 容器 + Tabs 切换
        │       ├── LoginForm.tsx             # 登录 Tab 表单
        │       ├── RegisterForm.tsx          # 注册 Tab 表单
        │       └── AuthModal.test.tsx
        ├── hooks/                            # Home Page 专属 hooks
        │   ├── useHomeGuard.ts               # 路由守卫：已登录 → redirect /console
        │   ├── useAuthModal.ts               # 弹窗 open/close + 默认 Tab 状态
        │   └── useAuthForm.ts                # 表单提交、loading、错误处理
        └── services/                         # Home Page 专属服务
            └── auth.service.ts               # login / register API 调用（依赖 http.client）
```

> **说明**：`auth.store` 和 `auth.model` 因 Console、Editor 页面也需要读取登录态，直接放在 `shared/` 下。`AppHeader` 作为全局组件同理。`AuthModal` 和表单逻辑仅 Home Page 使用，内聚在 `pages/home/` 下。

---

## 11. API 接口依赖

| 接口 | Method | Path | 用途 |
|------|--------|------|------|
| 登录 | POST | `/api/auth/login` | 邮箱密码登录，返回 JWT |
| 注册 | POST | `/api/auth/register` | 创建账号，返回 JWT |

**Request / Response 格式**

```typescript
// POST /api/auth/login
// Request
{ email: string; password: string }
// Response 200
{ token: string; user: AuthUser }
// Response 401
{ message: string }

// POST /api/auth/register
// Request
{ email: string; password: string }
// Response 201
{ token: string; user: AuthUser }
// Response 409
{ message: string }

// AuthUser（定义于 shared/models/auth.model.ts）
interface AuthUser {
  id: string
  email: string
}
```

---

## 12. 验收标准

- [ ] **AC-01** 未登录用户访问 `/` 正常渲染 Home Page，不跳转
- [ ] **AC-02** 已登录用户访问 `/` 自动跳转 `/console`
- [ ] **AC-03** AppHeader 在页面滚动 80 px 后出现白色背景与阴影
- [ ] **AC-04** Hero Badge"✦ 100% 免费 · 无水印"正常展示，主标题高亮文字颜色正确
- [ ] **AC-05** 点击「立即开始」打开弹窗且默认激活「注册」Tab；点击「登录」默认激活「登录」Tab
- [ ] **AC-06** 注册成功后自动跳转 `/console`；刷新 Console 页面登录态保持
- [ ] **AC-07** 表单字段失焦触发 zod 校验，`FormMessage` 错误信息展示在字段下方
- [ ] **AC-08** 移动端（375 px）无横向滚动条，弹窗以底部抽屉（Sheet）样式展示
- [ ] **AC-09** 弹窗支持 Esc 关闭 + 焦点循环（Dialog 内置 focus trap）
- [ ] **AC-10** LCP ≤ 2.5 s（Lighthouse 桌面 Fast 3G 模式）
- [ ] **AC-11** Features Section 展示 3 张卡片（100% 免费 / 无水印 / 现代模板），内容与设计稿一致
- [ ] **AC-12** Hero 底部小字"✓ 永久免费，无需注册。"可见
- [ ] **AC-13** AppHeader 已登录态展示用户头像，点击下拉菜单可退出登录

---

## 13. 待定事项

| # | 问题 | 负责人 | 截止 |
|---|------|--------|------|
| OQ-01 | Hero 右侧是用静态截图还是动态 Demo？ | 设计 | 开发前确认 |
| OQ-02 | 「查看示例」次按钮点击目标是模板列表页还是跳转 Console？ | 产品 | 开发前确认 |
| OQ-03 | 移动端弹窗是 shadcn/ui `Sheet`（底部抽屉）还是全屏 `Dialog`？ | 设计 | 开发前确认 |

---

*文档版本：v3.0 | 最后更新：2026-06-30*
