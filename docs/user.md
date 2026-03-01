# 用户模块（个人中心）

## 模块职责

负责用户信息的增删改查和账号安全管理（密码修改、手机换绑、邮箱换绑），提供用户数据访问层供其他模块（特别是 Auth 模块）使用。

## 架构设计

### 后端

| 文件 | 职责 |
|------|------|
| `src/modules/user/user.controller.ts` | 用户管理路由：公开资料查询、列表、单查、更新、删除（需登录，更新/删除限本人） |
| `src/modules/user/user-account.controller.ts` | 当前用户路由（`/users/me/*`）：获取自身信息、修改密码、换绑手机号、换绑邮箱 |
| `src/modules/user/user.service.ts` | 用户基础业务逻辑：CRUD、查询方法、字段更新 |
| `src/modules/user/user-security.service.ts` | 账号安全业务逻辑：密码修改、手机换绑、邮箱换绑（含验证码消耗和唯一性校验） |
| `src/modules/user/user.entity.ts` | TypeORM 实体定义 |
| `src/modules/user/user.dto.ts` | 用户基础 DTO（CreateUserDto、UpdateUserDto、UserSelfDto、UserPublicDto） |
| `src/modules/user/user-security.dto.ts` | 账号安全 DTO（ChangePasswordDto、ChangePhoneDto、ChangeEmailDto） |
| `src/modules/user/user.module.ts` | 模块声明，导出 UserService 供 AuthModule 使用 |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/views/settings/SettingsLayout.vue` | 个人中心布局（左侧导航 + 右侧内容区） |
| `frontend/src/views/settings/components/ProfileSection.vue` | 个人资料编辑（头像、昵称、签名） |
| `frontend/src/views/settings/components/SecuritySection.vue` | 账号安全总览页，承载各安全操作弹窗的触发入口 |
| `frontend/src/views/settings/components/ChangePasswordDialog.vue` | 修改密码弹窗 |
| `frontend/src/views/settings/components/ChangePhoneDialog.vue` | 换绑手机号弹窗（含短信验证码） |
| `frontend/src/views/settings/components/ChangeEmailDialog.vue` | 换绑邮箱弹窗（含邮箱验证码） |
| `frontend/src/views/settings/components/DeleteAccountDialog.vue` | 注销账号弹窗（需输入确认文本） |
| `frontend/src/lib/users.ts` | 用户管理 API 封装 |
| `frontend/src/composables/useSmsCountdown.ts` | 短信验证码发送 + 60s 倒计时逻辑 |
| `frontend/src/composables/useEmailCountdown.ts` | 邮箱验证码发送 + 60s 倒计时逻辑 |
| `frontend/src/types/index.ts` | User 接口、各 Payload 类型定义 |

## 数据库设计

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) PK | UUIDv7，`@BeforeInsert` 自动生成 |
| phone | varchar(20) UNIQUE NOT NULL | 手机号（主凭证） |
| nickname | varchar(64) | 昵称，注册时未传则自动生成"用户XXXX" |
| email | varchar(128) UNIQUE | 邮箱，注册后通过换绑流程绑定 |
| avatar | varchar(512) | 头像 URL |
| bio | varchar(200) | 个性签名 |
| password | varchar(128) | bcrypt 哈希，`select: false` 默认不返回 |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

### 设计决策

- **手机号为主凭证**: `phone` 是 NOT NULL + UNIQUE，注册必须提供
- **邮箱为可选绑定**: `email` 是 UNIQUE + NULLABLE，通过 `PUT /users/me/email` 换绑
- **密码默认隐藏**: Entity 使用 `select: false`，需要密码的查询方法通过 QueryBuilder 显式 `addSelect`
- **邮箱规范化**: 注册/登录/换绑时自动去空格 + 转小写（`user.service.ts:normalizeEmail()`）

## 核心功能

### 1. 用户创建

- **入口**: 仅通过 `POST /auth/register` 注册创建，UserController 不提供 create 端点
- **实现**: `user.service.ts:create()` — 检查手机号/邮箱唯一性 → 自动生成昵称 → bcrypt 哈希密码 → 保存

### 2. 用户查询

| 方法 | 场景 |
|------|------|
| `findOne(id)` | 按 ID 查询，不含密码 |
| `findOneSafe(id)` | 按 ID 查询，返回 UserSelfDto |
| `findByPhone(phone)` | 按手机号查询，不含密码，供短信登录使用 |
| `findByEmail(email)` | 按邮箱查询，不含密码，供邮箱登录使用 |
| `findByPhoneWithPassword(phone)` | 含密码字段，仅供密码登录校验 |
| `findByIdWithPassword(id)` | 含密码字段，仅供修改密码校验 |
| `getPublicProfile(id)` | 公开接口，仅返回 id/nickname/avatar/bio |

### 3. 用户更新

- **权限控制**: Controller 层校验 `req.user.sub === id`，仅允许更新本人信息
- **可更新字段**: 仅昵称、头像、签名（UpdateUserDto）
- **逐字段赋值**: 避免 `undefined` 覆盖已有值

### 4. 用户删除

- 硬删除，仅限本人操作

### 5. 修改密码

- **实现位置**: `user-security.service.ts:changePassword()`
- **设计说明**: 已登录状态下验证旧密码 → bcrypt 比对 → 更新为新密码哈希
- **限流**: `@Throttle` 5 次/分钟，防止暴力尝试

### 6. 换绑手机号

- **实现位置**: `user-security.service.ts:changePhone()`
- **设计说明**: 原子操作三步走 —— ① 检查新手机号是否被占用（不消耗验证码）→ ② 验证短信验证码（消耗验证码）→ ③ 写入数据库（兜底捕获 PG 23505 唯一约束冲突）
- **设计意图**: 步骤顺序确保验证码不被无效请求浪费

### 7. 换绑邮箱

- **实现位置**: `user-security.service.ts:changeEmail()`
- **设计说明**: 同换绑手机号的原子三步走逻辑，验证码通过邮件发送
- **邮箱规范化**: 写入前自动去空格 + 转小写

## 路由设计

静态路由 `/users/me` 在 `user.module.ts` 中声明时位于动态路由 `/users/:id` 之前，避免 Express 将 "me" 作为 `:id` 参数匹配。

### 用户管理路由（user.controller.ts）

| 方法 | 路由 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/users/:id/profile` | 无 | 获取用户公开信息 |
| GET | `/users` | JWT | 查询所有用户 |
| GET | `/users/:id` | JWT + 本人 | 查询单个用户 |
| PUT | `/users/:id` | JWT + 本人 | 更新用户资料 |
| DELETE | `/users/:id` | JWT + 本人 | 删除用户 |

### 账号安全路由（user-account.controller.ts）

| 方法 | 路由 | 鉴权 | 限流 | 说明 |
|------|------|------|------|------|
| GET | `/users/me` | JWT | — | 获取当前用户信息 |
| PUT | `/users/me/password` | JWT | 5次/分 | 修改密码 |
| PUT | `/users/me/phone` | JWT | 5次/分 | 换绑手机号 |
| PUT | `/users/me/email` | JWT | 5次/分 | 换绑邮箱 |

## 前端交互设计

### 个人中心布局

- **路由**: `/settings`，需登录（`meta: { requiresAuth: true }`）
- **结构**: 左侧导航菜单（个人资料 / 账号安全 / 外观）+ 右侧内容区（`<RouterView />`）
- **实现位置**: `SettingsLayout.vue:8-12` — 导航项定义

### 个人资料编辑

- **路由**: `/settings/profile`
- **表单字段**: 头像 URL（含实时预览和加载失败处理）、昵称（1-64 字）、个性签名（0-200 字）
- **表单校验**: vee-validate + zod，头像 URL 输入防抖 600ms
- **提交流程**: 调用 `PUT /users/{userId}` → 重新 `fetchUser()` 更新 store → Toast 提示

### 账号安全

- **路由**: `/settings/security`
- **展示项**: 密码（修改）、手机号（脱敏显示 + 换绑）、邮箱（绑定/换绑）、注销账号（危险操作）
- **手机号脱敏**: `SecuritySection.vue:maskPhone()` — 中间四位替换为 `****`

### 验证码倒计时

- **短信**: `useSmsCountdown` composable — 发送验证码后 60s 倒计时，组件卸载自动清理定时器
- **邮箱**: `useEmailCountdown` composable — 同上，额外包含邮箱格式正则校验
- **验证码消耗策略**: 验证通过即消耗，同一目标仅保留最新验证码，10 分钟过期

### 注销账号

- **确认机制**: 用户须手动输入"删除账号"文本，输入正确后按钮才可点击
- **删除流程**: 调用 `DELETE /users/{userId}` → `auth.logout()` → 重定向登录页

### 外观主题切换

- **纯前端功能**: 不涉及后端，偏好存 `localStorage('theme')`
- **三档**: 亮色 / 暗色 / 跟随系统，操作 `document.documentElement.classList` 切换 dark 类
- **启动初始化**: `main.ts` 在 `app.mount()` 前同步读取并应用主题，避免首屏闪烁（FOUC）
- **路由**: `/settings/appearance`，实现位置 `AppearanceSection.vue`

## 安全设计

### 验证码校验顺序（TOCTOU 防护）

换绑手机/邮箱采用"先查冲突 → 再消耗验证码 → 再写入"的三步顺序：

1. `findByPhone/findByEmail` 检查唯一性（不消耗验证码）
2. `verificationService.verifyCode()` 消耗验证码
3. `updateBasicFields` 写入数据库

即使写入阶段失败，验证码也只在冲突检查通过后才被消耗。

### 数据库唯一约束兜底

`phone` 和 `email` 字段有数据库级 `UNIQUE` 约束。应用层查重通过后，并发窗口内仍可能触发冲突，`user-security.service.ts:handleUniqueViolation()` 捕获 PG `23505` 错误码转为 `409 Conflict`。

### 弹窗状态重置

所有安全变更弹窗在关闭时（含 overlay 点击和 Escape）通过 `watch(open)` 重置表单状态，防止敏感信息残留。

## 接口文档

详细接口参数和返回值见 Swagger：`/api/docs`（Tags: 用户、用户-账号）
