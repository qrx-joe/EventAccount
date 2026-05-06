# 网站首页模块（Landing Page）

## 模块职责

网站首页及其子页面，纯前端模块，负责向访客展示产品价值主张，提供协议/帮助等信息页，并根据用户登录状态提供差异化的行动引导（CTA）。

## 架构设计

### 后端

本模块无直接后端文件。依赖以下接口：

| 依赖接口 | 来源模块 | 用途 |
|----------|----------|------|
| `GET /api/users/me` | 用户模块（`UserAccountController`） | 路由守卫中判断登录状态 |
| `GET /api/agreements/:type` | 协议模块（`AgreementController`） | AgreementView 加载用户条款/隐私政策 |

### 前端

#### 页面组件

| 文件 | 行数 | 职责 |
|------|------|------|
| `views/landing/LandingView.vue` | 13 | 首页容器，组合子组件 |
| `views/landing/AboutView.vue` | 37 | 关于页面（`/about`） |
| `views/landing/FeaturesView.vue` | 21 | 功能亮点页（`/features`），复用 LandingFeatures |
| `views/landing/HelpView.vue` | 35 | 帮助中心（`/help`） |
| `views/landing/AgreementView.vue` | 121 | 协议展示页（`/terms`、`/privacy`），Markdown 渲染 + DOMPurify 消毒 |

#### 子组件

| 文件 | 行数 | 职责 |
|------|------|------|
| `components/LandingNav.vue` | 27 | 固定顶部导航栏，auth-aware CTA |
| `components/LandingHero.vue` | 97 | 主视觉区域，auth-aware CTA + 入场动画 |
| `components/LandingFeatures.vue` | 42 | 三列特性卡片（静态内容） |
| `components/LandingCta.vue` | 21 | 底部号召区域 |
| `components/LandingFooter.vue` | 32 | 页脚版权信息 + 导航链接 |

#### 基础设施

| 文件 | 相关职责 |
|------|---------|
| `router/index.ts` | `/`、`/about`、`/features`、`/help`、`/terms`、`/privacy` 路由配置，scrollBehavior 锚点平滑滚动 |
| `stores/auth.ts` | Pinia 认证 Store，提供 `isLoggedIn` 计算属性 |
| `lib/auth.ts` | 认证 API 封装，`getMe()` 请求 `/api/users/me` |
| `lib/agreements.ts` | 协议 API 封装，`getAgreement(type)` 请求协议内容 |

## 核心功能

### 1. 认证状态感知 CTA

- **设计**: LandingNav 和 LandingHero 均引用 `useAuthStore()`，根据 `auth.isLoggedIn` 切换按钮文案和跳转目标
- **已登录**: 按钮文案为"进入平台"，跳转 `/users`
- **未登录**: 按钮文案为"登录/创建你的第一个活动"，跳转 `/login` 或 `/register`
- **无闪烁保证**: 路由守卫 `beforeEach` 在首次导航时调用 `auth.ensureSessionChecked()`，通过 `GET /api/users/me` 判断 Cookie 会话是否有效，在组件挂载前完成

### 2. 访客引导路径

| 入口 | 未登录跳转 | 已登录跳转 |
|------|-----------|-----------|
| 导航栏 CTA | `/login` | `/users` |
| Hero 主 CTA | `/register` | `/users` |
| Hero 次 CTA | `/login` | — |
| 底部 CTA | `/register` | `/register` |

### 3. 协议展示

- **路由复用**: `/terms` 和 `/privacy` 使用同一个 `AgreementView.vue`，通过 `props` 传入 `agreementType` 和 `pageTitle`
- **Markdown 渲染**: 使用 `marked` 解析 + `DOMPurify.sanitize()` 消毒，安全使用 `v-html`
- **SEO**: 动态设置 `document.title` 和 meta description，组件卸载时恢复原值

### 4. 子页面导航

- 所有子页面（About/Features/Help/Agreement）顶部提供"返回首页"按钮
- Footer 提供关于、帮助、用户条款、隐私政策四个导航链接
- `scrollBehavior` 支持锚点平滑滚动

### 5. 404 兜底

- **路由配置**: `/:pathMatch(.*)*` 重定向到 `/`，所有未匹配路径回到首页

## 接口文档

本模块无独立接口。依赖的认证和协议接口见 Swagger：`/api/docs`
