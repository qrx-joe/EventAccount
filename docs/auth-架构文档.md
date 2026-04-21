# 认证模块 — 架构文档

## 模块职责

认证模块负责用户的注册、登录（密码/短信/邮箱三种方式）、忘记密码、Token 签发与会话管理。前端路由 `/login`、`/register`、`/forgot-password`，后端路由 `/auth/*`。

本模块与 User 模块共享 `users` 表，职责边界：Auth 负责"进门"（身份验证），User/个人中心负责"装修"（资料管理）。

## 业务能力矩阵

| 能力 | 前端入口 | 后端端点 | 安全等级 |
|------|---------|---------|---------|
| 手机号注册 | `/register` | `POST /auth/register` | 短信验证码 + 限流 5次/分 |
| 密码登录 | `/login` (password tab) | `POST /auth/login/password` | 限流 10次/分 |
| 短信登录 | `/login` (sms tab) | `POST /auth/login/sms` | 短信验证码 + 限流 10次/分 |
| 邮箱登录 | `/login` (email tab) | `POST /auth/login/email` | 邮箱验证码 + 限流 10次/分 |
| 忘记密码-手机验证 | `/forgot-password` (phone) | `POST /auth/password/verify-reset` | 短信验证码 + 限流 5次/分 |
| 忘记密码-邮箱验证 | `/forgot-password` (email) | `POST /auth/password/verify-reset-email` | 邮箱验证码 + 限流 5次/分 |
| 重置密码 | `/forgot-password` (step 2) | `POST /auth/password/reset` | 短期 Reset Token (10分钟) + 限流 5次/分 |
| 登出 | 全局 Header 下拉 | `POST /auth/logout` | 清除 httpOnly Cookie |

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  前端 (Vue 3 + Composition API)                         │
│                                                         │
│  views/auth/                                            │
│  ├── LoginView.vue            ← Tab 切换三种登录方式     │
│  │   ├── PasswordLoginForm    ← 密码登录表单             │
│  │   ├── SmsLoginForm         ← 短信验证码登录           │
│  │   └── EmailLoginForm       ← 邮箱验证码登录           │
│  ├── RegisterView.vue         ← 注册 + 协议签署          │
│  └── ForgotPasswordView.vue   ← 两步式密码重置           │
│      ├── ForgotStep1Form      ← 手机号验证               │
│      ├── ForgotEmailStep1Form ← 邮箱验证                 │
│      └── ForgotStep2Form      ← 设置新密码               │
│                                                         │
│  lib/auth.ts                  ← 认证 API 调用层           │
│  composables/useAuthLogin.ts  ← 登录后统一路由处理        │
│  composables/useCountdown.ts  ← 通用验证码倒计时          │
│  composables/useSmsCountdown  ← 短信倒计时薄包装          │
│  composables/useEmailCountdown← 邮箱倒计时薄包装          │
│  stores/auth.ts               ← Pinia 用户状态            │
├─────────────────────────────────────────────────────────┤
│  HTTP (Axios + Cookie JWT)                              │
├─────────────────────────────────────────────────────────┤
│  后端 (NestJS)                                          │
│                                                         │
│  modules/auth/                                          │
│  ├── auth.controller          ← 路由 + Cookie 管理       │
│  │   @Throttle 各方法独立限流                             │
│  ├── auth.service             ← 注册/登录/Token 签发     │
│  ├── auth-reset.service       ← 密码重置专用服务          │
│  ├── auth.dto                 ← 请求 DTO + JwtPayload   │
│  ├── strategies/jwt.strategy  ← Passport JWT 从 Cookie 提取│
│  ├── guards/jwt-auth.guard    ← JWT 认证守卫             │
│  ├── guards/roles.guard       ← 角色检查守卫             │
│  └── decorators/roles.decorator ← @Roles() 装饰器       │
│                                                         │
│  modules/verification/                                  │
│  ├── verification.controller      ← 发送验证码路由       │
│  ├── email-verification.controller← 邮箱验证码路由       │
│  ├── verification.service         ← Redis 验证码存储/校验│
│  └── verification-sender.service  ← 短信/邮箱发送调度    │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (users 表) + Redis (验证码)                  │
└─────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 多方式登录

- **实现位置**: `auth.service.ts:loginByPassword()`、`loginBySms()`、`loginByEmail()`
- **设计说明**: 三种登录方式统一流程——验证身份 → 检查账号状态（`checkActive()`）→ 签发 JWT → 写入 httpOnly Cookie
- **Token 存储**: JWT 存入 httpOnly Cookie（`access_token`），前端无法通过 JS 读取，防止 XSS 窃取

### 2. 注册流程

- **实现位置**: `auth.service.ts:register()`
- **设计说明**: 验证短信验证码 → 创建用户（密码 bcrypt 哈希）→ 自动签署用户协议 → 签发 Token
- **前端流程**: `RegisterView.vue` 中用户需先阅读并勾选用户条款和隐私政策（Markdown 渲染 + DOMPurify 消毒）

### 3. 密码重置（两阶段 Token 隔离）

- **实现位置**: `auth-reset.service.ts:verifyResetCode()` → `resetPassword()`
- **设计说明**:
  - 阶段一：验证手机/邮箱验证码，签发含 `purpose: 'password-reset'` 的短期 Token（10分钟）
  - 阶段二：使用 Reset Token 重置密码
  - **隔离机制**: `JwtStrategy.validate()` 拒绝含 `purpose` 字段的 Token 用作普通认证，防止 Reset Token 被滥用

### 4. 验证码系统

- **实现位置**: `verification.service.ts`、`verification-sender.service.ts`
- **设计说明**: Redis 存储验证码，6位数字，10分钟过期，一次性消耗
- **类型区分**: `register`、`login`、`reset`、`bind-phone`、`bind-email` 等用途隔离

### 5. 前端登录后统一路由

- **实现位置**: `composables/useAuthLogin.ts`
- **设计说明**: 登录成功后调用 `auth.fetchUser()` → 根据角色路由（admin → `/admin/users`，user → `/users`）→ Toast 提示

## 设计决策记录

### 为什么 JWT 存在 Cookie 而非 localStorage？

| | Cookie (httpOnly) | localStorage |
|---|---|---|
| **XSS 防护** | JS 无法读取 | JS 可读取，XSS 可窃取 |
| **自动发送** | 浏览器自动携带 | 需手动设置 Header |
| **CSRF 风险** | 需 `sameSite: lax` 缓解 | 无 CSRF 风险 |

选择 Cookie + `sameSite: lax` + `httpOnly: true`，牺牲少量便利性换取安全性。

### 为什么 Reset Token 用 JWT 的 purpose 字段隔离？

Reset Token 与认证 Token 共享相同的密钥签发，但通过 `purpose: 'password-reset'` 字段区分。`JwtStrategy.validate()` 中如果检测到 `purpose` 字段则拒绝认证，确保 Reset Token 仅用于密码重置。

优点：无需额外维护 Token 黑名单或独立密钥。

### 为什么验证码倒计时提取为通用 composable？

`useCountdown.ts` 接受 `validate`/`send`/`successMessage` 配置，`useSmsCountdown` 和 `useEmailCountdown` 各只有 ~10 行薄包装。消除了之前 90% 的代码重复。

## 安全设计

| 安全措施 | 实现位置 | 说明 |
|---------|---------|------|
| bcrypt 12轮哈希 | `user.service.ts:BCRYPT_SALT_ROUNDS` | 约 300ms 计算时间 |
| 速率限制 | `auth.controller.ts` 各方法 `@Throttle` | 注册/重置 5次/分，登录 10次/分 |
| httpOnly Cookie | `auth.controller.ts:getAccessTokenCookieOptions()` | 防 XSS 窃取 |
| Reset Token 隔离 | `jwt.strategy.ts:validate()` | 拒绝含 purpose 字段的 Token |
| 验证码一次性消耗 | `verification.service.ts:verifyCode()` | 验证后立即从 Redis 删除 |
| 账号禁用检查 | `auth.service.ts:checkActive()` | 登录时检查 `isActive` 字段 |

## 模块依赖关系

```
AuthModule
  ├── 导入 PassportModule
  ├── 导入 JwtModule（异步配置，读取 JWT_SECRET）
  ├── 导入 UserModule（用户查询/创建）
  ├── 导入 VerificationModule（验证码服务）
  ├── 导入 AgreementModule（注册时自动签署协议）
  ├── 导出 JwtAuthGuard → 供其他模块保护路由
  └── 导出 RolesGuard → 供 Admin 模块角色检查
```

## 数据库设计

认证模块直接操作 `users` 表（Entity 定义在 User 模块），不拥有独立表。

验证码存储在 Redis 中，Key 格式：`verification:{type}:{phone/email}`，TTL 10 分钟。

## 接口文档

详细接口参数、请求体、响应体见 Swagger：`/api/docs`

- Tag `认证`：注册、登录、密码重置接口
- Tag `验证码`：短信/邮箱验证码发送接口
