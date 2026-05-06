# 通知与邮件模块 — 架构文档

## 模块职责

通知模块负责站内通知和邮件通知两个渠道，为报名确认、活动提醒、活动更新、群发消息等场景提供消息触达能力。

## 业务能力矩阵

| 能力 | 前端入口 | 后端端点 | 说明 |
|------|---------|---------|------|
| 查看通知列表 | （预留） | `GET /notifications` | JWT，支持类型/已读筛选 |
| 标记已读 | （预留） | `PATCH /notifications/:id/read` | JWT + 本人 |
| 全部已读 | （预留） | `PATCH /notifications/read-all` | JWT |
| 未读数 | （预留） | `GET /notifications/unread-count` | JWT |
| 群发消息 | 管理页 | `POST /events/:id/broadcast` | JWT + 创建者 |
| 报名确认通知 | 自动触发 | — (服务内部调用) | 报名成功后异步发送 |

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  后端 (NestJS)                                          │
│                                                         │
│  modules/notification/                                  │
│  ├── notification.controller   ← 通知查询/标记已读        │
│  ├── notification.service      ← 通知创建/查询/群发       │
│  │   依赖 RegistrationService（查询报名者列表）            │
│  ├── notification.entity       ← 通知实体                │
│  └── email.service             ← Nodemailer SMTP 封装    │
│                                                         │
│  被调用方：                                               │
│  registration.service.ts       ← 报名成功后异步调用        │
│  │  this.notificationService                             │
│  │    .sendRegistrationConfirmation(...)                  │
│  │    .catch(() => {})                                   │
└─────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 站内通知

- **实现位置**: `notification.service.ts:create()`、`getNotifications()`
- **设计说明**:
  - 通知类型：`registration_confirm`、`event_reminder`、`event_update`、`system`
  - 支持关联资源（`relatedType` + `relatedId`），便于前端跳转到对应活动/报名
  - 查询支持按类型和已读状态筛选
  - `markAsRead()` 验证通知属于当前用户（权限检查）

### 2. 群发消息

- **实现位置**: `notification.service.ts:broadcast()`
- **设计说明**:
  - 仅活动创建者可操作
  - 向所有 `approved` 状态的报名者发送
  - 支持 `in_app`（站内通知）和 `email`（邮件）两个渠道
  - 邮件渠道需报名者有 email 字段

### 3. 报名确认通知

- **实现位置**: `notification.service.ts:sendRegistrationConfirmation()`
- **设计说明**:
  - 由 `RegistrationService` 在报名成功后**异步调用**
  - 同时发送站内通知和邮件（如有邮箱）
  - 异步调用通过 `.catch(() => {})` 吞掉异常，不影响报名结果

### 4. 邮件发送

- **实现位置**: `email.service.ts`
- **设计说明**:
  - 使用 Nodemailer 集成 SMTP
  - 配置从 `ConfigService` 读取（host/port/user/pass）
  - **Mock 模式**: 配置缺失时仅打印日志，不发送真实邮件
  - 三种邮件模板：报名确认、活动提醒、群发消息

## 设计决策记录

### 为什么通知异步发送？

报名是核心业务流程，通知发送失败不应阻塞报名结果。异步调用确保报名接口的响应时间不受邮件服务影响。

缺点：异步 `.catch(() => {})` 吞掉异常，没有日志记录和重试机制，可能导致用户收不到通知但无人知晓。后续建议引入消息队列（如 Bull）实现可靠的异步通知。

### 为什么邮件服务有 Mock 模式？

开发环境通常没有 SMTP 配置。Mock 模式允许开发者在不配置 SMTP 的情况下正常开发和测试。但需要注意生产环境必须配置 SMTP，否则用户收不到邮件。

## 数据库设计

### notifications 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(36) | UUIDv7 PK |
| userId | VARCHAR(36) | FK → users，通知接收者 |
| type | VARCHAR(50) | registration_confirm/event_reminder/event_update/system |
| title | VARCHAR(255) | 通知标题 |
| content | TEXT | 通知正文 |
| relatedType | VARCHAR(50) | 关联资源类型（event/registration 等） |
| relatedId | VARCHAR(36) | 关联资源 ID |
| isRead | BOOLEAN | 已读标记，默认 false |
| createdAt | TIMESTAMP | 创建时间 |

**索引**: userId、userId+isRead（未读查询）、type

## 接口文档

详细接口参数见 Swagger：`/api/docs`

- Tag `通知`：通知列表、标记已读、未读数
- Tag `活动`：群发消息（`POST /events/:id/broadcast`）
