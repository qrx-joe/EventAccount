# 个人中心模块扩展设计文档

> 日期：2026-03-03
> 范围：通知偏好、隐私设置、个人主页扩展、日历集成

## 一、背景与目标

T3 Program 个人中心模块已完成基础功能（个人资料编辑、账号安全、外观主题）。本次扩展围绕**活动平台用户的真实需求**，新增四个功能方向：

1. **通知偏好设置** — 用户控制接收通知的渠道（站内信/短信/邮箱）
2. **隐私设置** — 用户控制个人信息的公开范围
3. **个人主页扩展** — 社交链接、兴趣标签、详细简介、所在城市
4. **日历集成** — 已报名活动导出为 iCal 文件

### 约束条件

- 活动模块正在设计中，尚无 Event 实体
- 阶段 1（基础设施）不依赖活动模块，可立即开始
- 兴趣标签体系、日历导出、隐私联动需等活动模块落地后实现

---

## 二、数据库设计

### 2.1 新增表：`user_profiles`

扩展展示信息，与 `users` 表一对一关联。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar(36) | PK | UUIDv7 |
| userId | varchar(36) | UNIQUE FK → users.id, ON DELETE CASCADE | 用户关联 |
| city | varchar(50) | nullable | 所在城市 |
| detailedBio | text | nullable | 详细自我介绍（区别于 users.bio 的 200 字签名） |
| socialLinks | jsonb | default '{}' | 社交链接，结构见下方 |
| interestTags | varchar[] | default '{}' | 兴趣标签，字符串数组 |
| createdAt | timestamp | | 创建时间 |
| updatedAt | timestamp | | 更新时间 |

**socialLinks 结构**：

```typescript
interface SocialLinks {
  wechat?: string
  weibo?: string
  github?: string
  xiaohongshu?: string
  website?: string
}
```

**设计决策**：
- `bio`（200 字签名）保留在 users 表，作为快速标识到处复用；`detailedBio` 仅在个人主页详情展示
- `socialLinks` 用 JSONB 因为社交平台种类不固定；TypeScript 侧用强类型 interface 约束
- `interestTags` 先用字符串数组，等活动模块定义分类体系后可改为外键关联

### 2.2 新增表：`user_preferences`

通知偏好 + 隐私设置，与 `users` 表一对一关联。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar(36) | PK | UUIDv7 |
| userId | varchar(36) | UNIQUE FK → users.id, ON DELETE CASCADE | 用户关联 |
| notifyInApp | boolean | default true | 站内信通知 |
| notifySms | boolean | default true | 短信通知 |
| notifyEmail | boolean | default true | 邮箱通知 |
| profileVisible | boolean | default true | 个人主页是否公开 |
| eventHistoryVisible | boolean | default true | 活动参与记录是否公开 |
| allowDirectMessage | boolean | default true | 是否允许陌生人私信 |
| showInAttendeeList | boolean | default true | 是否在报名列表中显示 |
| createdAt | timestamp | | 创建时间 |
| updatedAt | timestamp | | 更新时间 |

**设计决策**：
- 通知偏好目前只做**渠道级**开关。事件类型级别细化（"活动提醒走短信、报名确认走邮箱"）等活动模块落地后以新列形式扩展
- 所有布尔字段默认 `true`（默认开放、用户主动收紧），符合社交平台惯例
- 用户注册时在事务中自动创建两张表的默认记录

---

## 三、后端 API 设计

### 3.1 模块结构

新增两个子模块，挂在现有 `UserModule` 下：

```
backend/src/modules/user/
├── profile/
│   ├── user-profile.entity.ts
│   ├── user-profile.dto.ts
│   ├── user-profile.service.ts
│   └── user-profile.controller.ts    # /users/me/profile
│
├── preferences/
│   ├── user-preferences.entity.ts
│   ├── user-preferences.dto.ts
│   ├── user-preferences.service.ts
│   └── user-preferences.controller.ts  # /users/me/preferences
│
└── calendar/
    ├── user-calendar.service.ts
    └── user-calendar.controller.ts    # /users/me/calendar
```

### 3.2 API 路由

#### 个人主页（UserProfileController）

| 方法 | 路由 | 认证 | 说明 |
|------|------|------|------|
| GET | /users/me/profile | JWT | 获取自己的完整 profile |
| PUT | /users/me/profile | JWT | 更新 profile |
| GET | /users/:id/profile | 无 | 获取他人公开 profile（受 profileVisible 控制） |

#### 偏好设置（UserPreferencesController）

| 方法 | 路由 | 认证 | 说明 |
|------|------|------|------|
| GET | /users/me/preferences | JWT | 获取所有偏好 |
| PATCH | /users/me/preferences/notifications | JWT | 部分更新通知偏好 |
| PATCH | /users/me/preferences/privacy | JWT | 部分更新隐私设置 |

#### 日历导出（UserCalendarController）

| 方法 | 路由 | 认证 | 说明 |
|------|------|------|------|
| GET | /users/me/calendar/export.ics | JWT | 导出已报名活动的 iCal 文件 |

**设计决策**：
- 偏好用 `PATCH` 而非 `PUT`：用户在通知页只改通知字段，不应被迫传隐私字段
- 公开 profile 接口复用现有 `/users/:id/profile` 路由，扩展返回字段并接入隐私检查
- 日历导出暂定接口，实现等活动实体落地后填充

---

## 四、前端页面设计

### 4.1 路由

```
/settings/profile        # 已有 → 扩展
/settings/privacy        # 新增
/settings/notifications  # 新增
/settings/calendar       # 新增
/settings/security       # 已有 → 不动
/settings/appearance     # 已有 → 不动
```

### 4.2 组件

```
frontend/src/views/settings/components/
├── ProfileSection.vue          # 已有，扩展
├── NotificationsSection.vue    # 新增
├── PrivacySection.vue          # 新增
├── CalendarSection.vue         # 新增
├── SecuritySection.vue         # 已有，不动
└── AppearanceSection.vue       # 已有，不动
```

### 4.3 导航分组

SettingsLayout.vue 左侧导航重构为分组结构：

```
个人信息
  ├── 个人资料        /settings/profile
  └── 隐私设置        /settings/privacy

通知与日历
  ├── 通知偏好        /settings/notifications
  └── 日历集成        /settings/calendar

系统
  ├── 账号安全        /settings/security
  └── 外观主题        /settings/appearance
```

### 4.4 各页面交互

#### ProfileSection 扩展

在现有头像 + 昵称 + 签名基础上新增：
- **所在城市**：文本输入，可选
- **详细简介**：多行文本域，建议 500 字内
- **社交链接**：动态表单，每行一个平台选择器 + URL 输入框，预置微信/微博/GitHub/小红书/个人网站
- **兴趣标签**：标签输入组件，自由输入或从预设列表选择，上限 10 个

保存方式：基础信息和扩展信息统一 PUT 提交。

#### NotificationsSection

三组 Switch 开关：站内信 / 短信 / 邮箱，每组一行显示渠道名 + 说明 + 开关。

交互：改动即存（PATCH 实时提交 + debounce），关闭短信时弹确认提示。

#### PrivacySection

四个 Switch 开关：
- 公开个人主页（关闭后他人仅可见头像和昵称）
- 展示活动参与记录
- 允许陌生人私信
- 在报名列表中显示我

交互：改动即存，每项下方附简短说明文字。

#### CalendarSection

- 说明文字 + "导出日历 (.ics)" 按钮
- 活动模块未上线前按钮置灰，提示"活动功能即将上线"

### 4.5 类型定义扩展

```typescript
// user_profiles
interface UserProfile {
  id: string
  userId: string
  city: string | null
  detailedBio: string | null
  socialLinks: SocialLinks
  interestTags: string[]
  createdAt: string
  updatedAt: string
}

interface SocialLinks {
  wechat?: string
  weibo?: string
  github?: string
  xiaohongshu?: string
  website?: string
}

// user_preferences
interface UserPreferences {
  id: string
  userId: string
  notifyInApp: boolean
  notifySms: boolean
  notifyEmail: boolean
  profileVisible: boolean
  eventHistoryVisible: boolean
  allowDirectMessage: boolean
  showInAttendeeList: boolean
  createdAt: string
  updatedAt: string
}

// 更新 DTO
interface UpdateProfilePayload {
  city?: string | null
  detailedBio?: string | null
  socialLinks?: Partial<SocialLinks>
  interestTags?: string[]
}

interface UpdateNotificationsPayload {
  notifyInApp?: boolean
  notifySms?: boolean
  notifyEmail?: boolean
}

interface UpdatePrivacyPayload {
  profileVisible?: boolean
  eventHistoryVisible?: boolean
  allowDirectMessage?: boolean
  showInAttendeeList?: boolean
}
```

---

## 五、实施节奏

### 阶段 1 — 基础设施（不依赖活动模块）

- 1.1 数据库：创建 user_profiles、user_preferences 表 + migration
- 1.2 后端：UserProfileEntity + UserPreferencesEntity
- 1.3 后端：UserProfileService + UserPreferencesService + Controller
- 1.4 后端：注册流程中自动创建默认 profile 和 preferences 记录
- 1.5 前端：类型定义 + API 封装（lib/profile.ts, lib/preferences.ts）
- 1.6 前端：扩展 ProfileSection（城市、详细简介、社交链接）
- 1.7 前端：新增 NotificationsSection + PrivacySection
- 1.8 前端：SettingsLayout 导航重构（分组）
- 1.9 前端：路由注册

### 阶段 2 — 标签体系（需与活动模块设计对齐）

- 2.1 与活动模块团队对齐分类标签体系
- 2.2 前端：兴趣标签选择组件（预设列表 + 自定义输入）
- 2.3 后端：interestTags 写入 + 公开 profile 返回

### 阶段 3 — 日历集成（需活动实体 + 报名关联表落地）

- 3.1 后端：iCal 文件生成服务（查询用户已报名活动 → .ics）
- 3.2 前端：CalendarSection 导出按钮解锁
- 3.3 测试：多时区活动、全天活动等边界场景

### 阶段 4 — 隐私联动（需活动列表页 + 报名列表页落地）

- 4.1 后端：GET /users/:id/profile 接入隐私设置检查
- 4.2 前端：受限主页降级展示
- 4.3 后端：报名列表 + 活动记录查询接入隐私开关

---

## 六、与现有模块的关系

| 现有模块 | 变更 |
|---------|------|
| UserModule | 注册 imports 新增的 Profile/Preferences 子模块 |
| AuthService.register() | 事务中追加创建默认 profile + preferences 记录 |
| UserController.getPublicProfile() | 扩展返回字段，接入隐私检查（阶段 4） |
| 前端 types/index.ts | 新增 UserProfile、UserPreferences 等类型 |
| 前端 router | 新增 4 个 settings 子路由 |
| 前端 SettingsLayout | 导航项从 3 个变为 6 个，分组展示 |
