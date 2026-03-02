# 个人中心模块 — 架构文档

## 模块定位

个人中心是用户登录后的自管理入口，承载**个人资料编辑**和**账号安全管理**两大职责。前端路由 `/settings/*`，后端路由 `/users/me/*` + `/users/:id`。

本模块与 Auth 模块（认证/注册/登录）共享 `users` 表，但职责边界清晰：Auth 负责"进门"，个人中心负责"装修"。

## 业务能力矩阵

| 能力 | 前端入口 | 后端端点 | 安全等级 |
|------|---------|---------|---------|
| 查看个人信息 | `/settings/profile` | `GET /users/me` | JWT |
| 编辑资料（昵称/头像/签名） | `/settings/profile` | `PUT /users/:id` | JWT + 本人校验 |
| 修改密码 | `/settings/security` | `PUT /users/me/password` | JWT + 旧密码验证 + 限流 |
| 换绑手机号 | `/settings/security` | `PUT /users/me/phone` | JWT + 短信验证码 + 限流 |
| 绑定/换绑邮箱 | `/settings/security` | `PUT /users/me/email` | JWT + 邮箱验证码 + 限流 |
| 注销账号 | `/settings/security` | `DELETE /users/:id` | JWT + 本人校验 + 前端二次确认 |
| 查看他人公开资料 | — | `GET /users/:id/profile` | 无 |

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  前端 (Vue 3 + Composition API)                         │
│                                                         │
│  views/settings/                                        │
│  ├── SettingsLayout.vue        ← 布局壳：左导航 + 右内容 │
│  └── components/                                        │
│      ├── ProfileSection.vue    ← 个人资料编辑表单        │
│      ├── SecuritySection.vue   ← 账号安全总览            │
│      ├── ChangePasswordDialog  ← 修改密码弹窗            │
│      ├── ChangePhoneDialog     ← 换绑手机弹窗            │
│      ├── ChangeEmailDialog     ← 换绑邮箱弹窗            │
│      └── DeleteAccountDialog   ← 注销账号弹窗            │
│                                                         │
│  components/AvatarUpload.vue   ← 头像上传组件            │
│  lib/users.ts                  ← API 调用层              │
│  lib/upload.ts                 ← 文件上传 API            │
│  composables/useSmsCountdown   ← 短信验证码倒计时        │
│  composables/useEmailCountdown ← 邮箱验证码倒计时        │
│  stores/auth.ts                ← 用户状态（Pinia）       │
├─────────────────────────────────────────────────────────┤
│  HTTP (Axios + Cookie JWT)                              │
├─────────────────────────────────────────────────────────┤
│  后端 (NestJS)                                          │
│                                                         │
│  modules/user/                                          │
│  ├── user-account.controller   ← /users/me/* 路由       │
│  ├── user.controller           ← /users/:id 路由        │
│  ├── user-security.service     ← 安全变更业务逻辑        │
│  ├── user.service              ← 基础 CRUD 业务逻辑     │
│  ├── user.entity               ← TypeORM 实体           │
│  ├── user.dto                  ← 基础 DTO               │
│  └── user-security.dto         ← 安全变更 DTO            │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (users 表)                                   │
└─────────────────────────────────────────────────────────┘
```

## 关键数据流

### 1. 个人资料编辑

```
ProfileSection.vue
  │  onMounted: auth.user ?? auth.fetchUser() → 填充表单（昵称/签名）
  │
  │  ┌── 头像上传（独立于表单，即时保存）
  │  │   AvatarUpload.vue
  │  │     点击头像 → 选择文件 → 本地预览(createObjectURL)
  │  │     → POST /upload/image (FormData)
  │  │     → 上传成功 → emit URL → 即时调用 PUT /users/:id { avatar }
  │  │
  │  └── 昵称/签名表单 → zod 实时校验
  │
  ▼  提交（仅昵称/签名）
lib/users.ts:updateUser(userId, payload)
  │  PUT /users/{userId}
  ▼
UserController.update()
  │  JWT 守卫 → 本人校验 (req.user.sub === id)
  │  → UserService.update(): 逐字段赋值 → save()
  ▼
响应 UserSelfDto
  │
  ▼  前端
auth.fetchUser() → 更新 Pinia store → Toast 成功
```

### 2. 换绑手机号（安全变更的典型流程）

```
ChangePhoneDialog.vue
  │
  │  ① 用户输入新手机号
  │  ② 点击"获取验证码"
  ▼
useSmsCountdown.handleSendSms(newPhone)
  │  POST /auth/sms/send { phone, type: 'bind-phone' }
  │  → 开始 60s 倒计时
  │
  │  ③ 用户输入验证码，提交
  ▼
lib/users.ts:changePhone({ newPhone, smsCode })
  │  PUT /users/me/phone
  ▼
UserAccountController.changePhone()
  │  JWT 守卫 → 从 req.user.sub 获取 userId
  ▼
UserSecurityService.changePhone(userId, newPhone, smsCode)
  │
  │  Step 1: 检查新手机号是否被占用（不消耗验证码）
  │    → UserService.findByPhone(newPhone)
  │    → 已占用则抛 ConflictException
  │
  │  Step 2: 验证短信验证码（消耗验证码）
  │    → VerificationService.verifyCode(newPhone, smsCode, 'bind-phone')
  │    → 验证失败抛 BadRequestException
  │
  │  Step 3: 写入数据库（兜底唯一约束）
  │    → UserService.updateBasicFields(userId, { phone: newPhone })
  │    → catch PG 23505 → ConflictException
  │
  ▼
响应 UserSelfDto
  │
  ▼  前端
auth.fetchUser() → 更新 store → Toast 成功
```

**设计意图：三步走的顺序保证**
- 先做低成本的冲突检查，避免验证码被无效请求浪费
- 数据库唯一约束作为最终兜底，防止检查与写入之间的竞态窗口

### 3. 注销账号

```
DeleteAccountDialog.vue
  │  用户输入"删除账号"确认文本 → 按钮启用
  ▼
lib/users.ts:deleteUser(userId)
  │  DELETE /users/{userId}
  ▼
UserController.remove()
  │  JWT 守卫 → 本人校验 → UserService.remove()（硬删除）
  ▼
前端：auth.logout() → router.push('/login') → Toast
```

## 设计决策记录

### 为什么分两个 Controller？

| | UserController | UserAccountController |
|---|---|---|
| **路由前缀** | `/users` + `/:id` | `/users/me` |
| **身份来源** | URL 参数 `:id`，需本人校验 | JWT payload `req.user.sub`，天然安全 |
| **适用场景** | 通用 CRUD、公开资料查询 | 当前用户的安全敏感操作 |
| **限流** | 无 | 5 次/分钟 |

分离的好处：
- `/users/me/*` 不需要 `:id` 参数，天然避免了越权风险
- 安全操作集中在一个 Controller，便于统一应用守卫和限流
- 路由注册顺序：`UserAccountController` 必须在 `UserController` 之前，否则 "me" 会被 `:id` 捕获

### 为什么安全服务独立？

`UserSecurityService` 与 `UserService` 分离，原因：
- **单一职责**：基础 CRUD 和安全变更的关注点不同
- **依赖差异**：安全服务依赖 `VerificationService`（验证码），基础服务不需要
- **测试隔离**：安全变更的测试场景（验证码 mock、竞态测试）不应影响基础 CRUD 测试

### 为什么密码使用 `select: false`？

Entity 层 `password` 字段设置 `select: false`，所有常规查询默认不返回密码。需要密码的场景通过专用方法（`findByPhoneWithPassword`、`findByIdWithPassword`）使用 `addSelect` 显式获取。

好处：
- 即使 Controller 层意外返回了完整 Entity，密码也不会泄露
- 与 `toSelfDto()` 的显式字段映射形成双重保险

### 为什么使用硬删除？

当前阶段用户表无外键关联（活动、报名等模块尚未开发），硬删除最简。未来引入关联数据后，应迁移为软删除（`@DeleteDateColumn`）。

### 前端验证码倒计时为什么用 Composable？

`useSmsCountdown` / `useEmailCountdown` 将验证码发送 + 倒计时 + 按钮禁用状态封装为 Composable，原因：
- 验证码逻辑在注册页、换绑弹窗等多处复用
- `onUnmounted` 自动清理定时器，防止内存泄漏
- 状态（loading、countdown）与组件绑定，避免全局污染

## 安全设计

| 安全措施 | 实现位置 | 说明 |
|---------|---------|------|
| JWT 认证 | `JwtAuthGuard` | 所有个人中心接口需登录 |
| 本人校验 | Controller 层 `req.user.sub === id` | 防止越权操作 |
| 密码哈希 | `bcrypt` 12 轮 | Entity `select: false` 双重保护 |
| 操作限流 | `@Throttle` 5 次/分钟 | 密码修改、换绑操作 |
| 验证码消耗 | `VerificationService.verifyCode()` | 一次性消耗，10 分钟过期 |
| 唯一约束兜底 | `handleUniqueViolation()` | 防止并发注册/换绑的竞态 |
| 前端二次确认 | `DeleteAccountDialog` 输入确认文本 | 注销账号需手动输入"删除账号" |
| 手机号脱敏 | `SecuritySection.maskPhone()` | 中间四位替换为 `****` |

## 模块依赖关系

```
UserModule
  ├── 导入 TypeOrmModule.forFeature([UserEntity])
  ├── 导入 VerificationModule（验证码服务）
  ├── 导出 UserService → 供 AuthModule 使用
  │
  └── 内部依赖：
      UserAccountController → UserService, UserSecurityService
      UserController → UserService
      UserSecurityService → UserService, VerificationService
```

## 接口文档

详细接口参数、请求体、响应体见 Swagger：`/api/docs`

- Tag `用户`：基础 CRUD 接口
- Tag `用户-账号`：当前用户安全操作接口
