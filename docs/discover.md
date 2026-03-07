# 发现模块

## 模块职责

提供活动浏览、社区（分类）展示、城市探索、订阅机制等面向公众的发现与导航功能。前端首页、活动详情页、社区详情页、社区日历页、分类详情页均由本模块支撑。

## 架构设计

发现模块并非独立的 NestJS Module，而是由 Event、Category、Registration 三个模块的公开接口组合而成。

### 后端

| 文件 | 职责 |
|------|------|
| `src/modules/event/event.controller.ts` | 活动 CRUD 及发现相关路由（列表查询、城市聚合） |
| `src/modules/event/event.service.ts` | 活动查询（多维筛选、排序）、城市探索数据聚合、时间范围校验 |
| `src/modules/event/event.entity.ts` | 活动实体（含地理位置、状态、主题等字段） |
| `src/modules/event/event.dto.ts` | 查询 DTO（QueryEventDto 支持 keyword/city/dateRange/sortBy） |
| `src/modules/category/category.controller.ts` | 分类列表、slug 查询、订阅/取消订阅、订阅状态查询 |
| `src/modules/category/category.service.ts` | 分类查询、订阅计数维护、订阅状态检查 |
| `src/modules/category/category.entity.ts` | 分类实体（slug 唯一标识） |
| `src/modules/category/category-subscriber.entity.ts` | 订阅关系实体（categoryId + userId 联合唯一） |
| `src/modules/registration/registration.controller.ts` | 活动报名、取消、表单管理 |
| `src/modules/registration/registration.service.ts` | 报名逻辑（容量控制、候补晋升、表单校验） |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/views/discover/DiscoverView.vue` | 发现首页（搜索、热门活动、分类浏览、社区、城市探索） |
| `frontend/src/views/discover/CalendarsDiscoverView.vue` | 社区日历页（分类列表分页浏览） |
| `frontend/src/views/discover/CategoryDiscoverView.vue` | 分类详情页（某分类下的活动列表） |
| `frontend/src/views/event/EventDetailView.vue` | 活动详情页（信息展示、报名、分享、门票） |
| `frontend/src/views/community/CommunityDetailView.vue` | 社区详情页（分类映射，含活动列表/日历/地图三视图） |
| `frontend/src/lib/events.ts` | 活动相关 API 调用封装 |
| `frontend/src/lib/categories.ts` | 分类相关 API 调用封装（含订阅状态查询） |
| `frontend/src/composables/useRequestGuard.ts` | 请求竞态保护（序列号模式） |

## 核心功能

### 1. 活动多维查询

- **后端入口**: `event.service.ts:findAll()`（第 243 行）
- **设计**: QueryBuilder 动态拼接条件，公开接口强制 `status='published'` + `visibility='public'`，支持 categoryId、keyword（ILIKE 模糊）、city、dateRange、locationType 筛选。创建者信息排除手机号等 PII
- **排序策略**: `latest`（创建时间倒序）、`upcoming`（开始时间正序，仅未来）、`trending`（累计售票数倒序，子查询聚合 ticket.soldCount）
- **前端页面**: `DiscoverView.vue`，搜索使用 350ms 防抖 + AbortController 取消旧请求

### 2. 活动公开详情

- **后端入口**: `event.service.ts:findPublicById()`（第 159 行）
- **设计**: 通过 ID 查询活动详情，强制 `status='published'` + `visibility='public'` 条件门控，创建者信息排除手机号等 PII

### 3. 城市探索

- **后端入口**: `event.service.ts:getDiscoverCityRegions()`（第 333 行）
- **设计**: 预置三个区域（亚洲、北美洲、欧洲）的城市列表，通过 SQL 条件聚合统计每个城市的实际活动数量（`status='published'` + `visibility='public'` + `locationType='offline'`），返回带 count 的城市结构；亚洲区域覆盖中国一线与新一线核心城市，并补充东京、首尔、新加坡
- **前端**: 区域 Tab 切换 + 城市按钮选择，选中后自动触发城市筛选搜索

### 4. 分类浏览与社区详情

- **分类列表**: `category.service.ts:findAll()`（第 29 行），支持 keyword 筛选，按 sortOrder + createdAt 排序
- **slug 查询**: `category.service.ts:findBySlug()`（第 52 行），社区详情页通过 slug 加载分类信息
- **前端社区页**: 加载分类信息后，以 categoryId 查询该分类下所有 published 活动，提供列表/日历/地图三种视图

### 5. 订阅机制

- **订阅**: `category.service.ts:subscribe()`（第 74 行），插入 CategorySubscriber 记录并递增 subscriberCount
- **取消订阅**: `category.service.ts:unsubscribe()`（第 107 行），删除记录并递减 subscriberCount（最小为 0）
- **订阅状态查询**: `category.service.ts:isSubscribed()`（第 63 行），检查用户是否已订阅指定分类
- **防重复**: categoryId + userId 联合唯一约束

### 6. 活动报名

- **后端入口**: `registration.service.ts:register()`（第 46 行）
- **设计**: 校验活动状态 → 防重复 → 票种校验 → 表单字段校验 → 容量检查（满员自动候补）
- **候补晋升**: `registration.service.ts:promoteWaitlisted()`（第 616 行），取消报名时按创建时间顺序自动晋升候补
- **前端**: EventDetailView 通过 Dialog 展示报名表单，支持自定义字段（text/email/phone 等）

## 数据库关联

```
events ──→ users (creatorId, ManyToOne)
  ├──→ categories (categoryId, ManyToOne, SET NULL)
  ├──→ event_tickets (OneToMany)
  ├──→ event_co_hosts (OneToMany)
  ├──→ tags (ManyToMany via event_tags)
  ├──→ registrations (OneToMany)
  └──→ event_registration_forms (OneToMany)

categories ──→ category_subscribers (OneToMany)
  └── category_subscribers ──→ users (userId, ManyToOne)

registrations ──→ events (eventId, ManyToOne)
  ├──→ users (userId, ManyToOne)
  └──→ event_tickets (ticketId, ManyToOne, SET NULL)
```

**关键索引**:
- `idx_events_status_start_time`（status + startTime）— 活动列表查询优化
- `idx_events_location`（latitude + longitude）— 地理位置查询
- `idx_events_category_id` — 分类关联查询
- `idx_registrations_event_status`（eventId + status）— 报名状态查询

## 已知限制（V1）

- **城市探索**: 城市列表为静态预置，通过 SQL 聚合实际活动数量，但未支持动态发现新城市
- **社区实体**: 当前"社区"由 Category 实体映射，非独立实体，无真实创建者信息
- **地图视图**: V1 为地点聚合统计文本视图，未接入真实地图 SDK

## 接口文档

详细接口参数和返回值见自动生成的 API 文档：启动后端后访问 `/api-docs`
