# 活动模块 — 架构文档

## 模块职责

活动模块是平台核心业务，承载活动创建、发布、管理、票务、报名、支付、签到的全生命周期。涉及 6 个后端子模块（event、event-theme、category、tag、registration、payment）和前端活动相关的全部页面。

## 业务能力矩阵

| 能力 | 前端入口 | 后端端点 | 安全等级 |
|------|---------|---------|---------|
| 创建活动（草稿） | `/create` | `POST /events` | JWT |
| 发布活动 | 创建页自动/管理页手动 | `POST /events/:id/publish` | JWT + 创建者 |
| 编辑活动 | 管理页设置 | `PATCH /events/:id` | JWT + 创建者 + 仅草稿 |
| 取消活动 | 管理页设置 | `POST /events/:id/cancel` | JWT + 创建者 |
| 复制活动 | 管理页 | `POST /events/:id/copy` | JWT + 创建者 |
| 删除活动 | 管理页设置 | `DELETE /events/:id` | JWT + 创建者 |
| 查看活动详情 | `/event/:id` | `GET /events/:id` | 公开 |
| 活动列表查询 | `/discover` | `GET /events` | 公开（默认仅 published） |
| 我创建的活动 | `/events` | `GET /events/my/created` | JWT |
| 报名活动 | 活动详情页 | `POST /events/:id/register` | JWT + 悲观锁 |
| 取消报名 | 活动详情页 | `DELETE /events/:id/register` | JWT + 悲观锁 |
| 付费报名 | 活动详情页 | `POST /payments/create` | JWT |
| 审核报名 | 管理页嘉宾 | `PATCH /registrations/:id/approve` | JWT + 创建者 |
| 签到 | 管理页 | `POST /events/:id/check-in` | JWT + 创建者 |
| 管理票务 | 管理页 | `POST/PATCH/DELETE /events/:id/tickets` | JWT + 创建者 |
| 管理协作者 | 管理页 | `POST/DELETE /events/:id/co-hosts` | JWT + 创建者 |
| 分享/海报/QR码 | 管理页 | `POST /events/:id/share-link` 等 | JWT + 创建者或协作者 |
| 地点搜索 | 创建页 | `GET /events/locations/search` | 公开（高德 API） |

## 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│  前端 (Vue 3)                                               │
│                                                             │
│  views/event/                                               │
│  ├── CreateEventView.vue       ← 活动创建（三栏：预览+表单+主题）│
│  ├── EventDetailView.vue       ← 详情+报名+支付+分享         │
│  ├── MyEventsView.vue          ← 我的活动列表（即将/过去）     │
│  └── ManageEventLayout.vue     ← 管理页框架（注入 event）     │
│      ├── EventManageOverview   ← 管理概览仪表板               │
│      ├── EventManageGuests     ← 嘉宾/报名审核                │
│      ├── EventManageRegistration ← 报名表单配置               │
│      ├── EventManageSettings   ← 活动设置/取消/删除           │
│      ├── EventManagePosts      ← 活动动态                    │
│      └── EventManageInsights   ← 数据分析                    │
│                                                             │
│  components/                                                │
│  ├── EventCard.vue             ← 活动卡片预览                │
│  ├── CapacityModal.vue         ← 容量设置弹窗                │
│  ├── ThemeSelector.vue         ← 主题选择器                  │
│  ├── EmptyState.vue            ← 空状态提示                  │
│  ├── common/ImageUpload.vue    ← 图片上传                    │
│  └── common/LocationPicker.vue ← 地点搜索选择                │
│                                                             │
│  lib/events.ts                 ← 活动 API                   │
│  lib/manage-event.ts           ← 管理 API                   │
│  lib/my-events.ts              ← 我的活动 API                │
│  lib/themes.ts                 ← 主题 API                   │
│  lib/categories.ts             ← 分类 API                   │
│  lib/payments.ts               ← 支付 API                   │
├─────────────────────────────────────────────────────────────┤
│  后端 (NestJS)                                              │
│                                                             │
│  modules/event/                                             │
│  ├── event.controller          ← 活动 CRUD + 票务 + 协作者    │
│  │   含地点搜索（代理高德 API）                                │
│  ├── event.service (822行)     ← 核心业务 + 生命周期管理       │
│  ├── event.entity              ← 活动实体（JSONB theme 字段） │
│  ├── event-ticket.entity       ← 多层级票务                  │
│  └── event-co-host.entity      ← 协作者关系                  │
│                                                             │
│  modules/event-theme/                                       │
│  ├── event-theme.controller    ← 主题查询（公开）             │
│  ├── event-theme.service       ← 按 slug/appearance 过滤     │
│  └── event-theme.entity        ← 预设主题模板                │
│                                                             │
│  modules/category/                                          │
│  ├── category.controller       ← 分类 CRUD + 订阅            │
│  ├── category.service          ← 订阅计数原子更新             │
│  ├── category.entity           ← 分类（反规范化计数字段）      │
│  └── category-subscriber.entity← 用户订阅关系                │
│                                                             │
│  modules/tag/                                               │
│  ├── tag.controller            ← 标签查询 + 用户创建          │
│  ├── tag.service               ← findOrCreate + 使用计数      │
│  └── tag.entity                ← 标签（user/platform 双来源） │
│                                                             │
│  modules/registration/                                      │
│  ├── registration.controller   ← 报名/取消/问卷/导出          │
│  ├── registration-manage.controller ← 审核/签到/确认          │
│  ├── registration.service      ← 悲观锁容量控制 + 候补递补     │
│  ├── registration.entity       ← 报名记录（JSONB formData）  │
│  └── event-registration-form.entity ← 自定义问卷字段配置      │
│                                                             │
│  modules/payment/                                           │
│  ├── payment.controller        ← 订单/回调/退款               │
│  ├── payment.service           ← 订单管理（当前 Mock 支付）    │
│  └── payment-order.entity      ← 支付订单                    │
│                                                             │
│  shared/services/amap.service  ← 高德地图 POI/地理编码         │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL + Redis                                          │
└─────────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 活动生命周期管理

- **状态机**: `draft` → `published` → `cancelled` / `completed`
- **实现位置**: `event.service.ts:publish()`、`cancel()`
- **设计说明**: 发布/取消使用数据库事务，原子更新 Category 的 `eventCount` 反规范化计数
- **审核状态**: `auditStatus`（`pending`/`approved`/`rejected`）独立于发布状态，为管理员审核预留

### 2. 并发安全的报名系统

- **实现位置**: `registration.service.ts:register()`
- **设计说明**:
  - 事务内使用**悲观锁**（`pessimistic_write`）锁住活动和门票记录
  - 容量满员自动转为候补（`waitlisted`）
  - 取消报名后自动递补候补名单（`promoteWaitlisted()`，同样使用悲观锁）
  - 如果用户之前取消过，复用已有记录而非新建

### 3. 多层级票务系统

- **实现位置**: `event.service.ts:createTicket()`、`updateTicket()`、`deleteTicket()`
- **设计说明**:
  - 每个活动可创建多个票种（普通票/VIP 票等）
  - 支持销售时间窗口（`saleStartTime`/`saleEndTime`）
  - `soldCount` 原子更新，`quantity` 修改需 ≥ `soldCount`
  - 已售出的票不可删除

### 4. 支付流程（当前 Mock）

- **实现位置**: `payment.service.ts:createOrder()`、`markOrderPaid()`
- **设计说明**:
  - 创建订单 → 返回支付链接 → 回调标记已付 → 更新报名状态
  - 事务内同步更新报名状态和门票已售数量
  - **当前为 Mock 实现**，微信/支付宝真实接口已注释，通过 `mockPaySuccess()` 模拟
  - 订单号格式：`PAY` + 时间戳 + 6位随机数

### 5. 自定义报名问卷

- **实现位置**: `registration.service.ts:setRegistrationForm()`、`validateFormData()`
- **设计说明**:
  - 活动创建者可配置自定义字段（text/textarea/select/radio/checkbox/email/phone）
  - 问卷配置存储在 `EventRegistrationFormEntity`
  - 报名数据以 JSONB 存储在 `Registration.formData`
  - 服务端验证必填字段

### 6. 分类与标签体系

- **分类**: 平台管理的固定分类（如科技、艺术），支持用户订阅，`eventCount`/`subscriberCount` 反规范化
- **标签**: 用户可创建 + 平台预设，活动与标签多对多关联，`usageCount` 反规范化
- **实现位置**: `category.service.ts`、`tag.service.ts`

### 7. 协作者管理与权限

- **实现位置**: `event.service.ts:assertCreator()`、`assertCreatorOrCoHost()`
- **设计说明**:
  - 创建者拥有全部权限（删除、取消、修改、审核报名等）
  - 协作者可管理报名、生成分享链接/QR码，不可删除/取消活动
  - 唯一约束防止重复添加协作者

### 8. 地点搜索（高德 API 代理）

- **实现位置**: `event.controller.ts` 的 `locations/search`、`locations/geocode`、`locations/reverse-geocode`
- **设计说明**: 后端代理高德 Web 服务 API，前端通过 `LocationPicker` 组件搜索和选择地点

## 关键数据流

### 报名 → 支付 → 签到

```
EventDetailView.vue
  │
  │  ① 用户点击报名（免费活动）
  ▼
registerEvent(eventId, { ticketId, email, formData })
  │  POST /events/{id}/register
  ▼
RegistrationService.register()
  │  事务开始 → 悲观锁锁住 event + ticket
  │  → 容量检查 → 已有报名检查 → 创建/复用记录
  │  → soldCount++ → 事务提交
  │  → 异步发送通知
  ▼
返回 Registration → Toast 成功 → 更新界面状态

--- 如果是付费活动 ---

  │  ② 报名成功后创建支付订单
  ▼
createPayment({ eventId, ticketId, registrationId, paymentMethod })
  │  POST /payments/create
  ▼
PaymentService.createOrder()
  │  → 验证活动/票务/报名 → 生成订单号 → 创建 PaymentOrder
  │  → 返回 Mock 支付链接
  ▼
前端展示支付二维码 → mockPayment(orderNo)
  │  POST /payments/mock-pay/{orderNo}
  ▼
PaymentService.markOrderPaid()
  │  事务：订单 → paid + 报名 → approved + soldCount++
  ▼
前端刷新报名状态 → 显示电子票
```

## 设计决策记录

### 为什么报名使用悲观锁？

高并发报名场景（如热门活动开抢）中，乐观锁会导致大量重试。悲观锁（`pessimistic_write`）在事务内锁住活动和门票行，确保容量检查与写入的原子性，牺牲少量吞吐量换取正确性。

### 为什么分类计数反规范化？

`Category.eventCount` 和 `subscriberCount` 在活动发布/取消和用户订阅/取消订阅时事务内原子更新。避免每次查询都 COUNT 聚合，分类列表查询效率高。

### 为什么标签支持双来源？

`TagEntity.source` 区分 `user`（用户创建）和 `platform`（平台预设）。用户可自由创建标签丰富内容，平台标签提供基础分类体系。`findOrCreate()` 方法在活动关联标签时自动复用已有标签。

### 为什么活动主题用 JSONB 存储？

`EventEntity.theme` 使用 JSONB 类型存储颜色、字体、风格等配置，灵活性高，无需为主题变更迁移数据库 schema。预设主题模板通过 `EventThemeEntity` 提供参考。

### 为什么支付模块当前使用 Mock？

微信/支付宝正式接入需要商户资质审批。Mock 实现保持完整的业务流程（订单 → 支付 → 回调），待资质到位后替换实现即可。生产环境需通过环境变量切换。

## 安全设计

| 安全措施 | 实现位置 | 说明 |
|---------|---------|------|
| 创建者权限校验 | `event.service.ts:assertCreator()` | 所有修改操作限创建者 |
| 创建者/协作者权限 | `event.service.ts:assertCreatorOrCoHost()` | 分享/QR码允许协作者 |
| 悲观锁防超卖 | `registration.service.ts:register()` | 事务内 `pessimistic_write` |
| 草稿保护 | `event.service.ts:update()` | 仅 `draft` 状态可编辑 |
| SQL LIKE 转义 | `event.service.ts:escapeLike()` | 防止通配符注入 |
| 报名重复检查 | `registration.entity.ts` | `eventId + userId` 唯一索引 |
| 问卷必填验证 | `registration.service.ts:validateFormData()` | 服务端验证必填字段 |

## 模块依赖关系

```
EventModule
  ├── TypeOrmModule.forFeature([EventEntity, EventTicketEntity,
  │    EventCoHostEntity, UserEntity, CategoryEntity])
  ├── 导入 SharedServicesModule（AmapService 地图服务）
  ├── 导出 EventService → 供 RegistrationModule、DiscoverModule 使用
  │
RegistrationModule
  ├── 导入 EventModule
  ├── 导入 NotificationModule（异步通知）
  │
PaymentModule
  ├── 导入 EventModule
  ├── 导入 RegistrationModule
  │
CategoryModule → 独立，被 EventModule 引用实体
TagModule → 独立，被 EventModule 引用实体
EventThemeModule → 独立，仅提供主题查询
```

## 数据库设计

### 核心表

| 表名 | 说明 | 关键约束 |
|------|------|---------|
| `events` | 活动主表 | 索引：status+startTime, lat+lng, creatorId, communityId, categoryId |
| `event_tickets` | 票种表 | FK → events (CASCADE) |
| `event_co_hosts` | 协作者关系 | eventId+userId UNIQUE, FK → events/users (CASCADE) |
| `event_tags` | 活动-标签关联 | ManyToMany 中间表 |
| `categories` | 分类表 | slug UNIQUE, eventCount/subscriberCount 反规范化 |
| `category_subscribers` | 分类订阅 | categoryId+userId UNIQUE |
| `tags` | 标签表 | name UNIQUE, usageCount 反规范化 |
| `registrations` | 报名记录 | eventId+userId 唯一索引, JSONB formData |
| `event_registration_forms` | 问卷字段配置 | FK → events (CASCADE) |
| `payment_orders` | 支付订单 | orderNo UNIQUE, FK → events/users/tickets/registrations |
| `event_themes` | 预设主题 | slug UNIQUE, isActive 软过滤 |

## 接口文档

详细接口参数、请求体、响应体见 Swagger：`/api/docs`

- Tag `活动`：活动 CRUD、发布/取消、复制、票务、协作者
- Tag `活动主题`：主题查询
- Tag `分类`：分类查询、订阅
- Tag `标签`：标签查询、创建
- Tag `报名`：报名/取消、问卷、签到、审核
- Tag `支付`：订单创建、回调、退款
