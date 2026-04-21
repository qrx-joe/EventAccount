# Vue 3 代码审查报告 — 网站首页模块（Landing Page）

## 审查摘要

- **审查时间**: 2026-03-01
- **审查范围**: `feature/landing-page` 分支，前端 `src/views/landing/` 目录及 `src/router/index.ts`
- **总体评分**: 4 / 5
- **发现问题数**: 7 个（严重 1 个，一般 3 个，建议 3 个）
- **严重问题已修复**: 1 个

## 编译与 Lint 检查

| 检查项 | 结果 |
|--------|------|
| `vue-tsc --noEmit`（TypeScript 类型检查） | 通过，无错误 |
| `eslint src/views/landing/ src/router/index.ts` | 通过，无警告 |

## 审查的文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `LandingView.vue` | 13 | 页面容器 |
| `LandingNav.vue` | 27 | 固定导航栏 |
| `LandingHero.vue` | 97 | 主视觉区域（含 CSS 动画） |
| `LandingFeatures.vue` | 42 | 特性卡片 |
| `LandingCta.vue` | 21 | 底部行动号召 |
| `LandingFooter.vue` | 32 | 页脚（含链接导航） |
| `AboutView.vue` | 37 | 关于页面 |
| `AgreementView.vue` | 121 | 协议展示页（用户条款/隐私政策） |
| `FeaturesView.vue` | 21 | 功能亮点独立页 |
| `HelpView.vue` | 35 | 帮助中心 |
| `router/index.ts` | 94 | 路由配置 |

---

## 严重问题（1 个，已修复）

### 1. LandingHero 未区分登录状态，已登录用户看到"注册/登录"引导

**位置**: `LandingHero.vue:24-33`

**问题描述**: `LandingNav.vue` 正确判断了登录状态，但 `LandingHero.vue` 的 CTA 按钮始终展示"创建你的第一个活动 → /register"和"已有账号，立即登录 → /login"。已登录用户看到这些文案是矛盾的。虽然路由守卫会拦截重定向，但用户体验混乱。

**修复方案**: 引入 `useAuthStore`，根据 `auth.isLoggedIn` 切换 CTA：已登录显示"进入平台 → /users"，未登录保持原有注册/登录引导。

---

## 一般问题（3 个，未修复）

### 2. LandingView 未渲染 LandingFeatures 和 LandingCta 组件

**位置**: `LandingView.vue:1-13`

**问题描述**: `LandingView` 只引入了 Nav、Hero、Footer，但 `LandingFeatures` 和 `LandingCta` 已存在却未在首页使用。首页跳过了功能介绍和行动号召板块。

**建议**: 在 Hero 和 Footer 之间加入 `LandingFeatures` 和 `LandingCta`。

### 3. LandingNav `getPlatformLink` 应为 computed 而非方法

**位置**: `LandingNav.vue:8-10`

**问题描述**: `getPlatformLink` 是纯粹依赖响应式状态的函数，每次渲染都会重新执行。应使用 `computed` 缓存结果。

**当前代码**:

```ts
const getPlatformLink = (): string => {
  return auth.isLoggedIn ? '/users' : '/login'
}
```

**建议**:

```ts
const platformLink = computed(() => auth.isLoggedIn ? '/users' : '/login')
```

### 4. AgreementView 直接操作 document.title 和 meta 标签

**位置**: `AgreementView.vue:51-78`

**问题描述**: 直接操作 DOM 修改 `document.title` 和 meta description，手动在 `onMounted` 保存旧值、`onBeforeUnmount` 恢复。方式脆弱且与 Vue 声明式理念不符。建议使用 `@vueuse/head` 或 `useTitle`。考虑到项目当前未引入这些依赖且只有一处使用，暂可接受。

---

## 优化建议（3 个）

### 5. AboutView 和 HelpView 结构高度重复，可抽取通用布局

**位置**: `AboutView.vue` / `HelpView.vue`

**说明**: 两个文件模板结构几乎相同：返回首页按钮 → 圆角卡片 → header → 内容。只有文字不同。后续如有更多静态信息页可考虑抽取 `StaticPageLayout.vue`。

### 6. FeaturesView 直接复用 LandingFeatures 组件，缺乏独立价值

**位置**: `FeaturesView.vue:1-21`

**说明**: 整个页面只是在 `LandingFeatures` 外面包了一个"返回首页"按钮。如果内容与首页完全一致，独立页面意义不大；如果将来需要更详细内容，应有独立组件。

### 7. LandingHero 的 CSS 动画 `:nth-of-type` 选择器可能不符合预期

**位置**: `LandingHero.vue:50-68`

**说明**: `:nth-of-type` 匹配的是同标签类型的兄弟元素，不是同 class 的元素。当 section 内 DOM 为 `h1 + p + p + div + Button` 时，两个 `p` 会分别匹配 `p:nth-of-type(1)` 和 `p:nth-of-type(2)`，而非整体序号。建议改用 CSS 自定义属性或 `:nth-child` 配合包裹容器。

---

## 做得好的地方

- **TypeScript 严格模式全通过**，所有组件使用 `<script setup lang="ts">`
- **AgreementView 的 v-html 安全处理到位**: `DOMPurify.sanitize()` + `marked`，eslint-disable 注释范围正确
- **路由全部使用懒加载**: `() => import(...)` 动态导入
- **LandingHero 无障碍支持**: `aria-labelledby` + `prefers-reduced-motion` 媒体查询
- **LandingFeatures 使用 `as const` 常量断言**: 类型安全且避免不必要的响应式开销
- **LandingFooter 的 v-for 使用规范**: `:key` 使用唯一值，Separator 条件渲染不与 v-for 同元素
- **组件文件命名规范**: 全部 PascalCase + 多单词，层级清晰
- **代码简洁**: 最长的 `AgreementView` 仅 121 行，所有组件均在 200 行硬性指标内

---

## 审查检查清单

| 维度 | 结果 |
|------|------|
| 编译和 Lint | ✅ 全通过 |
| 组件命名规范 | ✅ PascalCase + 多单词 |
| `<script setup>` | ✅ 全部使用 |
| TypeScript 类型 | ✅ 无 any，Props 有类型定义 |
| 模板规范 | ✅ v-for 有 key，无 v-if/v-for 同元素 |
| 性能 | ✅ 路由懒加载，静态数据 `as const` |
| 安全性 | ✅ v-html 经过 DOMPurify 消毒 |
| 架构边界 | ✅ API 走 `@/lib/agreements`，未直接调 axios |
| 无障碍 | ✅ aria-labelledby, reduced-motion |
| 登录状态感知 | ✅ 已修复 |

---

## 分支提交记录

| Commit | 说明 |
|--------|------|
| `4ee82b6` | feat: 路由配置更新 |
| `290ab8d` | feat: LandingView 容器与占位组件 |
| `2f8c2df` | feat: 固定导航栏 |
| `4cd5635` | feat: Hero 区域与 CTA |
| `eba7925` | feat: 特性卡片网格 |
| `5bf8c97` | feat: CTA 区域 |
| `463a1ff` | feat: Footer 区域 |
| `d1adeb1` | fix: 修复审查问题 — 死链接、导航偏移耦合、401 跳转 |
| `20a154b` | feat: 新增子页面（About/Help/Features/Agreement）与导航优化 |

## 结论

代码质量良好。1 个严重问题（Hero 登录状态未适配）已修复。3 个一般问题不阻塞合并但建议后续迭代时处理。3 个优化建议为低优先级。可合并。
