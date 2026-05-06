# 发现模块 — 架构文档

## 模块定位

发现模块是平台的流量入口，承载**活动探索**、**社区浏览**、**城市发现**、**分类订阅**四大能力。前端路由 `/discover`、`/discover/calendars`、`/discover/category/:slug`、`/communities/:slug`、`/event/:id`，后端复用 Event、Category、Registration 三个模块的公开接口。

本模块不是独立的 NestJS Module，而是由已有模块的查询能力组合而成。discovery 分支的核心工作是将发现页从"静态展示"升级为"可筛选、可排序、可探索"的完整入口。

## 业务能力矩阵

| 能力 | 前端入口 | 后端端点 | 安全等级 |
|------|---------|---------|---------|
| 多维活动搜索 | `/discover` 筛选栏 | `GET /events` | 公开（默认仅 published） |
| 热门活动 | `/discover` 热门板块 | `GET /events?sortBy=trending` | 公开 |
| 本地活动 | `/discover` 本地板块 | `GET /events?locationType=offline` | 公开 |
| 城市探索聚合 | `/discover` 城市板块 | `GET /events/cities` | 公开 |
| 分类浏览 | `/discover` 分类栏 | `GET /categories` | 公开 |
| 社区/分类搜索 | `/discover` 搜索栏 | `GET /categories?keyword=` | 公开 |
| 分类详情活动列表 | `/discover/category/:slug` | `GET /categories/:slug` + `GET /events` | 公开 |
| 社区日历浏览 | `/discover/calendars` | `GET /categories` | 公开 |
| 社区详情 | `/communities/:slug` | `GET /categories/:slug` + `GET /events` | 公开 |
| 分类订阅/取消 | 社区详情页 | `POST/DELETE /categories/:id/subscribe` | JWT |
| 活动报名 | `/event/:id` | `POST /events/:id/register` | JWT + 悲观锁 |
| 付费报名 | `/event/:id` | `POST /payments/create` | JWT |
| 活动分享 | `/event/:id` | `POST /events/:id/share-link` | JWT |
| 最近搜索 | `/discover` 搜索栏 | — (localStorage) | 纯前端 |

## 架构分层

```
┌───────────────────────────────────────────────────────────────┐
│  前端 (Vue 3 + Composition API)                               │
│                                                               │
│  composables/                                                 │
│  ├── useDiscoverFilters.ts (217行)  ← 筛选状态 + 路由同步     │
│  │   syncRouteQuery / applyRouteQuery / watchFilters           │
│  ├── useDiscoverSearch.ts  (174行)  ← 搜索防抖 + 请求取消     │
│  │   loadBrowseEvents / scheduleSearch / runSearchImmediately  │
│  └── useRecentSearches.ts           ← localStorage 搜索历史   │
│                                                               │
│  views/discover/                                              │
│  ├── DiscoverView.vue      (244行)  ← 发现主页（模板+组合）   │
│  │   消费三个 composable，专注渲染逻辑                          │
│  ├── CalendarsDiscoverView.vue      ← 社区日历页（分页+搜索+URL同步）│
│  ├── CategoryDiscoverView.vue       ← 分类详情活动列表（URL同步） │
│  └── components/                                              │
│      ├── DiscoverEventCard.vue      ← 发现页活动卡片           │
│      ├── CommunityCard.vue          ← 社区/分类卡片            │
│      ├── FilterSummaryBar.vue       ← 筛选条件标签栏（可单项移除）│
│      └── SectionHeader.vue          ← 板块标题 + View All 链接 │
│                                                               │
│  views/community/                                             │
│  └── CommunityDetailView.vue        ← 社区详情（列表/日历/地图）│
│                                                               │
│  views/event/                                                 │
│  └── EventDetailView.vue            ← 活动详情（报名+支付+分享）│
│      API 调用已提取到 lib/ 层                                  │
│                                                               │
│  lib/events.ts                      ← 活动 API（+AbortSignal） │
│  lib/categories.ts                  ← 分类 API（+订阅/slug查询）│
│  lib/payments.ts                    ← 支付 API                 │
│  types/index.ts                     ← 发现相关类型定义          │
│  types/admin.ts                     ← Admin 类型抽离            │
│  router/index.ts                    ← 新路由 + /calendars 重定向│
│  App.vue                            ← 动态布局支持（meta.layout）│
│  components/layout/TopNavBar.vue    ← 导航路径修正              │
├───────────────────────────────────────────────────────────────┤
│  HTTP (Axios + Cookie JWT + AbortSignal)                      │
├───────────────────────────────────────────────────────────────┤
│  后端 (NestJS)                                                │
│                                                               │
│  modules/event/                                               │
│  ├── event.controller.ts            ← 新增 GET /events/cities  │
│  ├── event.service.ts               ← 多维筛选 + 城市聚合      │
│  │   findAll() ILIKE + ESCAPE '\\' + 安全默认 published        │
│  │   publish/cancel/delete 事务化 + 分类计数原子更新             │
│  ├── event.dto.ts                   ← QueryEventDto 扩展       │
│  │   +city/dateStart/dateEnd/locationType/sortBy               │
│  │   +QueryEventCitiesDto                                     │
│  └── event.module.ts                ← 新增 CategoryEntity 导入  │
│                                                               │
│  modules/registration/                                        │
│  ├── registration-manage.controller ← getConfirmation 加权限   │
│  └── registration.service.ts        ← 悲观锁全面加固           │
│      register/cancel/approve/reject/promoteWaitlisted          │
│      全部使用事务 + pessimistic_write                           │
│      promoteWaitlisted 增加门票容量安全检查                     │
├───────────────────────────────────────────────────────────────┤
│  PostgreSQL                                                    │
└───────────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 活动多维筛选查询

- **实现位置**: `event.service.ts:findAll()`
- **设计说明**:
  - QueryBuilder 动态拼接：status、categoryId、keyword（ILIKE + `escapeLike()` 转义 + `ESCAPE '\\'`）、city（ILIKE 匹配 locationName + locationAddress）、dateStart/dateEnd、locationType
  - **安全默认值**: 未传 status 时自动加 `status = 'published'` + `visibility = 'public'`，防止草稿泄露
  - 三种排序策略：`latest`（创建时间倒序）、`upcoming`（未来活动按开始时间正序）、`trending`（门票销量子查询排序）
- **前端对应**: `useDiscoverFilters` composable 管理筛选状态 + URL 双向绑定，`useDiscoverSearch` composable 处理 350ms 防抖 + AbortController 取消旧请求

### 2. 城市探索聚合

- **实现位置**: `event.service.ts:getDiscoverCityRegions()`
- **设计说明**:
  - 预置三个区域（亚太/北美/欧洲）的城市列表常量 `CITY_REGION_PRESETS`
  - **单条 SQL 条件聚合**: 对每个城市使用 `SUM(CASE WHEN ILIKE :param THEN 1 ELSE 0 END)` 统计活动数，避免 N+1 查询
  - 使用 `select([])` 清除默认实体列，仅返回聚合数据
  - 仅统计 `published` + `offline` 的活动
- **前端对应**: 区域 Tab 切换 + 城市按钮点击自动填充搜索筛选

### 3. 活动生命周期事务化

- **实现位置**: `event.service.ts:publish()`、`cancel()`、`delete()`
- **设计说明**: 发布/取消/删除活动时，使用 `dataSource.transaction()` 原子更新 Category 的 `eventCount`
  - 发布：`increment(CategoryEntity, {id}, 'eventCount', 1)`
  - 取消/删除：`GREATEST("eventCount" - 1, 0)` 防止负数
  - 编辑增加草稿状态校验：`if (event.status !== 'draft') throw BadRequestException`

### 4. 报名并发安全加固

- **实现位置**: `registration.service.ts:register()`、`cancel()`、`approve()`、`promoteWaitlisted()`
- **设计说明**:
  - **报名**: 事务内悲观锁（`pessimistic_write`）锁住活动行 → 容量检查 → 门票名额检查 → 创建/复用记录 → soldCount++
  - **取消**: 事务内悲观锁读取报名 → 更新状态 → 门票 soldCount-- → **同一事务内**递补候补
  - **审核通过**: 事务内悲观锁检查活动容量，防止并发审批超卖
  - **候补递补**: 接受 `EntityManager` 参数在调用方事务内执行，悲观锁锁住门票行，通过 `Math.min(count, quantity - soldCount)` 计算安全递补数量防止超卖
  - **确认信封权限**: `getConfirmation()` 从公开接口改为 JWT + 本人/创建者权限校验

### 5. 前端 View All 深链

- **实现位置**: `router/index.ts`
- **新增路由**:
  - `/discover/calendars` → CalendarsDiscoverView（社区日历分页浏览）
  - `/discover/category/:slug` → CategoryDiscoverView（分类详情活动列表）
  - `/communities/:slug` → CommunityDetailView（社区详情三视图）
  - `/calendars` → 301 重定向至 `/discover/calendars`（兼容旧路径）
- **Admin 布局隔离**: `meta.layout = false` 使 Admin 区不渲染 AppLayout

### 6. 搜索历史

- **实现位置**: `useRecentSearches` composable（由 `DiscoverView.vue` 消费）
- **设计说明**: 纯前端实现，搜索关键词写入 localStorage，展示为可点击、可删除的标签。最多保存 10 条。

## 关键数据流

### 发现页搜索 → 结果展示

```
DiscoverView.vue
  │  用户输入关键词/选择筛选项
  ▼
useDiscoverFilters.watchFilters()
  │  检测筛选变化 → 通知搜索 composable
  ▼
useDiscoverSearch.scheduleSearch()
  │  350ms 防抖
  │  AbortController 取消上一次请求
  ▼
lib/events.ts:getEvents({ keyword, city, dateStart, dateEnd, locationType, sortBy, categoryId }, { signal })
  │  GET /events?keyword=...&city=...&sortBy=trending
  ▼
EventService.findAll()
  │  QueryBuilder 动态拼接 WHERE 条件（ILIKE + ESCAPE）
  │  强制 status=published + visibility=public
  │  sortBy=trending → 子查询 SUM(ticket.soldCount) 排序
  ▼
返回 { items, total } → 前端更新 browseEvents → 渲染卡片列表

同时并行：
lib/categories.ts:getCategories({ keyword }, { signal })
  │  GET /categories?keyword=...
  ▼
返回匹配的社区 → 前端更新 searchedCommunities → 渲染社区卡片
```

### 报名流程（悲观锁全链路）

```
EventDetailView.vue
  │  用户点击报名
  ▼
lib/events.ts:registerEvent(eventId, { ticketId, email, formData })
  │  POST /events/{id}/register
  ▼
RegistrationService.register()
  │  事务开始
  │  ├─ 悲观锁 EVENT 行 (pessimistic_write)
  │  ├─ 容量检查 → 满员则 waitlisted
  │  ├─ 悲观锁 TICKET 行 → 名额检查
  │  ├─ 创建/复用报名记录
  │  ├─ soldCount++ (approved 时)
  │  事务提交
  │  └─ 异步发送确认通知（事务外）
  ▼
返回 Registration → 前端更新状态
```

## 设计决策记录

### 为什么城市聚合用单条 SQL 而非多次查询？

预置城市列表共 19 个，如果每个城市单独 COUNT 需要 19 次 DB 查询。使用 `SUM(CASE WHEN ILIKE :param)` 在单条 SQL 中完成所有城市的计数，仅扫描一次 events 表，时间复杂度从 O(N) 降为 O(1)。

### 为什么筛选参数同步到 URL？

用户可以通过分享 URL 传递搜索结果页面，也可以通过浏览器后退/前进恢复之前的筛选状态。刷新不丢失已选筛选条件。

### 为什么报名取消与候补递补放在同一事务？

之前取消和递补分离（事务外调用 `promoteWaitlisted`），存在竞态窗口：取消释放名额 → 两个候补同时看到空位 → 双倍递补。改为同一事务内执行，悲观锁保证原子性。

### 为什么 `getConfirmation` 加权限？

原接口为公开（仅需 registrationId），意味着知道 ID 即可查看他人报名信息。改为 JWT + 本人/创建者校验，防止信息泄露。

### 为什么 `trending` 排序用子查询？

直接 JOIN tickets 会导致活动行重复（一个活动多张票），需要 GROUP BY 或 DISTINCT。子查询 `COALESCE(SUM(ticket.soldCount), 0)` 作为标量值避免了这个问题，且 QueryBuilder 语法更清晰。

## 模块依赖关系

```
EventModule（discovery 分支扩展）
  ├── 新增导入 CategoryEntity（分类计数事务更新）
  ├── 新增注入 DataSource（事务管理）
  ├── 新增注入 ConfigService（前端 URL 配置化，已在 .env.example 记录）
  └── 导出 EventService → 供 RegistrationModule 使用

RegistrationModule（discovery 分支加固）
  ├── register/cancel/approve/reject → 全面事务化 + 悲观锁
  ├── promoteWaitlisted → 接受 EntityManager 参数 + 门票容量安全检查
  └── getConfirmation → 新增 userId 参数 + 权限校验

CategoryModule → 独立，订阅计数原子更新
```

## 数据库关联

```
events ──→ users (creatorId, ManyToOne)
  ├──→ categories (categoryId, ManyToOne, SET NULL)
  │    eventCount 由 publish/cancel/delete 事务维护
  ├──→ event_tickets (OneToMany)
  │    soldCount 由 register/cancel/approve/promote 事务维护
  ├──→ registrations (OneToMany)
  └──→ event_registration_forms (OneToMany)

categories ──→ category_subscribers (OneToMany)
  subscriberCount 由 subscribe/unsubscribe 原子更新
```

**关键索引**: `idx_events_status_start_time`、`idx_events_location`、`idx_events_category_id`、`idx_registrations_event_status`

## 已知限制（V1）

- **城市配置硬编码**: `CITY_REGION_PRESETS` 常量，新增城市需代码变更
- **社区 = Category**: 当前"社区"由 Category 映射，无独立实体和真实创建者
- **地图视图**: V1 为地点聚合统计，未接入真实地图 SDK
- **`getMyRegisteredEvents()`**: TODO 占位，返回空列表（`void query` 占位符待清理）
- **admin 类型字段**: `AdminEvent.location: string | null` 与后端 `locationType/locationName/locationAddress` 三字段不对应，管理端对接时需核对

## 测试覆盖

| 测试文件 | 覆盖范围 | 用例数 | 状态 |
|---------|---------|-------|------|
| `backend/test/event-discover-query.e2e-spec.ts` | 组合筛选、日期范围、upcoming/trending 排序、城市聚合 | 5 | ✅ 通过 |
| `frontend/e2e/discover-search.spec.ts` | 搜索防抖、结果展示 | 2 | ✅ 通过 |
| `frontend/e2e/discover-routing.spec.ts` | 路由跳转、View All 深链 | 1 | ✅ 通过 |
| `frontend/e2e/discover-filters.spec.ts` | 筛选条件联动 | 3 | ✅ 通过 |
| `frontend/e2e/community-detail-acceptance.spec.ts` | 社区详情订阅、视图切换 | — | ✅ 通过 |
| `frontend/e2e/calendars-category-acceptance.spec.ts` | 日历页分页、分类详情 | — | ✅ 通过 |

## 接口文档

详细接口参数和返回值见 Swagger：启动后端后访问 `/api-docs`

- Tag `活动`：`GET /events`（多维筛选）、`GET /events/cities`（城市聚合）
- Tag `分类`：`GET /categories`、`GET /categories/:slug`、`POST/DELETE /categories/:id/subscribe`
- Tag `报名`：`POST /events/:id/register`、`DELETE /events/:id/register`
