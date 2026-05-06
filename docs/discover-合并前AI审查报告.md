# 发现模块 — 合并前 AI 审查报告

**审查日期**: 2026-03-06
**最后更新**: 2026-03-07（修复状态跟踪）
**审查范围**: `discovery` 分支 vs `develop`，后端 9 文件 (+806/-113)，前端 34 文件 (+2916/-564)
**审查工具**: Claude Opus 4.6 代码审查（含 nestjs-code-review / vue-code-review 技能）
**测试验证**: 后端 5 e2e 用例通过、前端 6 e2e 用例通过

---

## 审查总览

| 严重级别 | 后端 | 前端 | 合计 | 已修复 |
|---------|------|------|------|-------|
| 🔴 严重（阻塞合并） | 1 | 1 | **2** | 2 ✅ |
| 🟠 中等（建议修复） | 3 | 5 | **8** | 7 ✅ |
| 🟡 低（可后续优化） | 2 | 4 | **6** | 2 ✅ |
| 🟢 正面模式 | 6 | 5 | **11** | — |

**结论**: 2 个严重问题已全部修复，8 个中等问题已修复 7 个（M2 部分改善）。剩余 4 个低优先级问题待后续迭代处理。代码整体质量良好，并发安全加固显著提升了系统健壮性。

---

## 🔴 严重问题（阻塞合并）

### S1. `trending` 排序可被非 published 活动干扰 — ✅ 已修复

**位置**: `backend/src/modules/event/event.service.ts` — `findAll()` 中 sortBy=trending 分支
**严重性**: 严重
**修复日期**: 2026-03-07

当调用方显式传 `status=draft` 或其他非 published 状态时，trending 子查询会基于门票销量排序草稿活动。虽然公开查询默认限制 `published`，但内部调用（如管理端）可能传入其他 status，此时 trending 排序的子查询 `SUM(ticket.soldCount)` 未限制票的活动状态，可能关联到已删除活动的票务数据。

**修复方式**: `findAll()` 现在强制添加 `event.status = 'published'` 和 `event.visibility = 'public'` 条件，trending 子查询 `WHERE ticket.eventId = event.id` 在父查询已过滤的上下文中执行，确保只统计已发布活动的门票销量。

---

### S2. `DiscoverView.vue` 单文件近 980 行，违反单一职责 — ✅ 已修复

**位置**: `frontend/src/views/discover/DiscoverView.vue`
**严重性**: 严重（架构层面）
**修复日期**: 2026-03-07

单文件包含 12+ 响应式变量、5 个 load 函数、搜索防抖、URL 同步、localStorage 操作、城市探索、分类浏览、热门/本地活动等逻辑。任何一处修改都可能影响其他功能，测试和维护成本高。

**修复方式**: 已按建议拆分为三个 composable，DiscoverView.vue 从 ~980 行缩减至 **244 行**：
- `useDiscoverFilters()` (217 行) — 筛选状态管理 + 路由参数双向绑定 + `syncRouteQuery()` + `applyRouteQuery()` + `watchFilters()`
- `useDiscoverSearch()` (174 行) — 350ms 搜索防抖 + AbortController 请求取消 + `loadBrowseEvents()` + `scheduleSearch()` + `runSearchImmediately()`
- `useRecentSearches()` — localStorage 搜索历史（已有，复用）

---

## 🟠 中等问题（建议修复）

### M1. 城市匹配使用 LIKE 而非 ILIKE — ✅ 已修复

**位置**: `backend/src/modules/event/event.service.ts` — `findAll()` 中 city 筛选

**问题**: 城市筛选使用 `LIKE`（大小写敏感），但城市探索聚合使用 `ILIKE`（大小写不敏感）。同一城市名可能因大小写不同得到不一致的结果，尤其对英文城市名（如 "San Francisco" vs "san francisco"）。

**修复方式**: 已统一使用 `ILIKE`，并配合 `ESCAPE '\\'` 子句确保特殊字符正确转义。

---

### M2. `CommunityDetailView` 订阅操作无乐观回滚 — ⚠ 部分改善

**位置**: `frontend/src/views/community/CommunityDetailView.vue`

**问题**: 订阅按钮点击后先修改本地状态 `isSubscribed` 和 `subscriberCount`，再发起 API 调用。如果 API 失败，虽然有 toast.error 但计数和状态未回滚，页面显示与服务端不一致。

**当前状态**: 改为 **API 成功后** 再更新本地状态（非乐观更新），但 catch 块增加了智能恢复逻辑：识别"已订阅"/"未订阅"等幂等错误并修正本地状态，其他错误显示 toast.error。整体行为已合理，但仍直接修改 `category.value.subscriberCount`（见 L6）。

---

### M3. `CommunityDetailView` catch 块使用 `void error` 吞掉异常 — ✅ 已修复

**位置**: `frontend/src/views/community/CommunityDetailView.vue`

**问题**: `catch { void error }` 既不记录日志也不提供用户反馈，调试困难。

**修复方式**: 已替换为 `console.error('加载社区详情失败', error)` 日志输出，以及 `toast.error(message)` 用户反馈。

---

### M4. `EventDetailView` 的 `getRegisteredCount()` 每次渲染重新计算 — ✅ 已修复

**位置**: `frontend/src/views/event/EventDetailView.vue`

**问题**: `getRegisteredCount()` 是普通函数，模板中每次渲染都会遍历 tickets 数组求和。应使用 `computed` 缓存。

**修复方式**: 已改为 `const registeredCount = computed(() => event.value?.tickets?.reduce((total, item) => total + item.soldCount, 0) ?? 0)`。

---

### M5. 前端 `loadInitialData` 多个 load 函数重复 Promise.all + try/catch 模式 — ✅ 已修复

**位置**: `frontend/src/views/discover/DiscoverView.vue`

**问题**: `loadInitialData()`、`loadBrowseEvents()`、`loadCommunityData()` 均重复相似的 "设置 loading → Promise.all → catch → finally" 模式，违反 DRY。

**修复方式**: 随 S2 拆分一并解决。加载逻辑提取到 `useDiscoverSearch` composable 中的 `loadBrowseEvents()` 方法，统一管理 loading 状态和错误处理。

---

### M6. `escapeLike()` 转义但未声明 ESCAPE 子句 — ✅ 已修复

**位置**: `backend/src/modules/event/event.service.ts:escapeLike()`

**问题**: `escapeLike()` 使用反斜杠转义 `%_\` 字符，但 PostgreSQL LIKE 默认不识别反斜杠作为转义符（取决于 `standard_conforming_strings` 配置）。

**修复方式**: 已改用 `ILIKE` 并在 SQL 中声明 `ESCAPE '\\'`，同时解决了大小写和转义两个问题。

---

### M7. `promoteWaitlisted` 递补时门票增量未检查门票容量 — ✅ 已修复

**位置**: `backend/src/modules/registration/registration.service.ts:promoteWaitlisted()`

**问题**: 候补递补时批量将 waitlisted → approved，并递增对应门票的 soldCount。但未检查递补后 soldCount 是否超过门票 quantity。在极端场景下（如管理员同时手动增加了 approved 报名），可能导致超卖。

**修复方式**: 递补前使用悲观锁锁住门票行，并通过 `Math.min(count, lockedTicket.quantity - lockedTicket.soldCount)` 计算安全递补数量，防止超卖。

---

### M8. 后端 `frontendBaseUrl` 改为 ConfigService 但无默认值文档 — ✅ 已修复

**位置**: `backend/src/modules/event/event.service.ts` — `get frontendBaseUrl()`

**问题**: 从 `process.env.FRONTEND_URL` 改为 `configService.get('FRONTEND_URL')`，落地值 `'http://localhost:5173'`。但 `.env.example` 或文档中未记录此环境变量，部署时易遗漏。

**修复方式**: 已在 `backend/.env.example` 中添加 `FRONTEND_URL` 配置项。

---

## 🟡 低优先级问题

### L1. `DiscoverView.vue` 的 `suppressDebouncedWatch` 标志位增加认知复杂度 — ✅ 已修复

**位置**: `frontend/src/composables/useDiscoverFilters.ts`

**说明**: 使用布尔标志位防止批量更新筛选参数时触发多次 watcher，逻辑正确但增加了维护者的理解成本。

**修复方式**: 随 S2 拆分一并解决。标志位提取到 `useDiscoverFilters` composable 中作为 `suppressWatch` 内部状态，封装在 `watchFilters()` 方法内，外部调用者无需关心抑制逻辑。

---

### L2. `CalendarsDiscoverView` 和 `CategoryDiscoverView` 分页未使用路由参数 — ✅ 已修复

**位置**: `frontend/src/views/discover/CalendarsDiscoverView.vue`、`CategoryDiscoverView.vue`

**说明**: DiscoverView 做到了筛选参数与 URL 同步，但这两个页面的分页状态仅在组件内部，刷新回到第一页。

**修复方式**: 两个视图均已实现 `syncRouteQuery()` 方法，将分页 page、搜索 keyword 等参数同步到 URL query string，刷新不丢失状态。

---

### L3. `void query` 占位符未清理 — 待处理

**位置**: `backend/src/modules/event/event.service.ts:getMyRegisteredEvents()`

**说明**: `void query` 仅为避免 lint 警告。方法签名保留了参数但不使用，方法体直接 `Promise.resolve` 返回空。已有 TODO 注释标注需通过 registration 表 JOIN events 实现真实查询。

---

### L4. `EventDetailView` 的 `loadRelatedEvents` 嵌套在 `fetchEvent` 内 — 待处理

**位置**: `frontend/src/views/event/EventDetailView.vue`

**说明**: `fetchEvent()` 内部顺序调用 `loadRelatedEvents()`，形成嵌套异步。建议使用 `Promise.all` 并行加载主活动数据和相关推荐。

---

### L5. 前端 admin 类型定义从 `types/index.ts` 拆分到 `types/admin.ts` — 待处理

**位置**: `frontend/src/types/index.ts`、`frontend/src/types/admin.ts`

**说明**: 拆分本身合理，但 `AdminEvent` 的 `location: string | null` 单字段与后端的 `locationType + locationName + locationAddress` 三字段不对应，后续对接管理端时需核对。

---

### L6. `CommunityDetailView` 直接修改 props 传入的 category 对象 — 待处理

**位置**: `frontend/src/views/community/CommunityDetailView.vue`

**说明**: `category.value.subscriberCount += 1` 直接修改了 API 返回的对象引用。在 Vue 的响应式系统中可正常工作，但违反了"不修改 API 返回值"的纯函数原则。建议使用独立的 `subscriberCount` ref。

---

## 🟢 正面模式（值得保持）

### 后端

| 模式 | 位置 | 说明 |
|------|------|------|
| 悲观锁全面覆盖 | `registration.service.ts` 全部写操作 | 报名/取消/审核/递补均在事务内使用 `pessimistic_write` |
| 候补递补事务内化 | `cancel()` → `promoteWaitlisted(manager)` | 取消与递补在同一事务内，消除竞态窗口 |
| 分类计数事务原子更新 | `publish/cancel/delete` | `GREATEST("eventCount" - 1, 0)` 防止负数 |
| 城市聚合单条 SQL | `getDiscoverCityRegions()` | SUM(CASE WHEN ILIKE) 避免 N+1 |
| 状态默认安全 | `findAll()` 无 status 时默认 published | 防止草稿/取消活动泄露到公开查询 |
| 确认信封权限加固 | `getConfirmation(id, userId)` | 从公开改为 JWT + 本人/创建者校验 |

### 前端

| 模式 | 位置 | 说明 |
|------|------|------|
| Composable 职责拆分 | `useDiscoverFilters` + `useDiscoverSearch` | DiscoverView 从 ~980 行拆至 244 行，筛选/搜索/渲染三者解耦 |
| AbortController 请求取消 | `useDiscoverSearch`、`lib/events.ts` | 防止旧请求结果覆盖新结果 |
| 筛选参数 URL 同步 | `useDiscoverFilters` route.query 双向绑定 | 刷新不丢失筛选、可分享搜索结果，CalendarsDiscoverView/CategoryDiscoverView 也已统一 |
| API 调用提取到 lib 层 | `EventDetailView.vue` 重构 | 移除内联 `http.post/get/delete`，统一到 `lib/events.ts` + `lib/payments.ts` |
| 搜索防抖 + 请求取消组合 | `useDiscoverSearch` 350ms 防抖 | 减少无效请求，配合 AbortController 双重保护 |
| E2E 测试 Mock 抽离 | `e2e/helpers/discover-mocks.ts` | Mock 逻辑独立于测试用例，降低维护成本 |

---

## 修复状态总览

### ✅ 已修复（11/16）

| 编号 | 问题 | 修复方式 |
|------|------|---------|
| S1 | trending 子查询未限制活动状态 | 父查询强制 published + public 过滤 |
| S2 | DiscoverView 980行单文件 | 拆分为 3 个 composable，主文件 244 行 |
| M1 | LIKE → ILIKE | 统一 ILIKE + ESCAPE '\\\\' |
| M3 | catch 块吞掉异常 | console.error + toast.error |
| M4 | getRegisteredCount → computed | 改为 computed 属性 |
| M5 | 多个 load 函数 DRY 违反 | 随 composable 拆分一并解决 |
| M6 | escapeLike ESCAPE 子句 | ILIKE + ESCAPE '\\\\' |
| M7 | 递补时门票容量检查 | 悲观锁 + Math.min 安全计算 |
| M8 | 环境变量文档 | .env.example 已添加 FRONTEND_URL |
| L1 | suppressDebouncedWatch 认知复杂度 | 封装到 composable 内部 |
| L2 | 分页未使用路由参数 | syncRouteQuery() 统一 URL 分页 |

### ⚠ 部分改善（1/16）

| 编号 | 问题 | 当前状态 |
|------|------|---------|
| M2 | 订阅操作乐观回滚 | 改为 API 成功后更新 + 智能错误恢复，但仍直接修改 category 对象 |

### 待处理（4/16）

| 编号 | 问题 | 优先级 |
|------|------|-------|
| L3 | `void query` 占位符 | 等 getMyRegisteredEvents 实现时清理 |
| L4 | loadRelatedEvents 嵌套异步 | 低，可后续优化 |
| L5 | admin 类型与后端字段不对应 | 对接管理端时需核对 |
| L6 | 直接修改 category 对象引用 | 低，建议使用独立 ref |

---

## 编译与 Lint 检查

| 检查项 | 结果 |
|--------|------|
| `backend npm run build` | ✅ 通过 |
| `backend npm run lint:check` | ✅ 通过 |
| `frontend npm run build` | ✅ 通过 |
| `frontend npm run lint:check` | ✅ 通过 |
| `backend e2e (event-discover-query)` | ✅ 5/5 通过 |
| `frontend e2e (discover-*)` | ✅ 6/6 通过 |

---

## 分支提交记录

### 后端

| Commit | 说明 |
|--------|------|
| `6c8de24` | feat(event): 支持发现页活动筛选查询并补充 e2e 用例 |
| `eb46ea5` | docs(discover): 新增发现模块架构文档 |
| `1372fc7` | feat(event,registration): 并发安全加固与发现页查询优化 |
| `4b6970a` | fix(event,registration): 事务原子性保证与安全防护增强 |

### 前端

| Commit | 说明 |
|--------|------|
| `0451b3b` | refactor(admin): 管理端独立信息架构，脱离 AppLayout 布局 |
| `90849c7` | feat(discovery): 重构发现页并接入社区详情链路 |
| `3199be8` | feat(discovery): 完善发现页筛选路由与分类日历视图 |
| `4da4dbf` | fix(discovery): 修复社区详情页重复按钮与 TabsContent 渲染 bug |
| `f18841d` | refactor(event): 活动详情页 API 调用规范化与类型安全增强 |
| `72000ba` | fix(event): route.params.id 使用 String() 替代 as string 类型断言 |
| `335fc0c` | fix(router): 日历路由统一至 /discover/calendars，旧路径 redirect 兼容 |
