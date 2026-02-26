# 认证模块

## 模块职责

负责用户注册、多方式登录（密码/短信验证码/邮箱验证码）、密码找回与重置。

## 架构设计

### 后端

| 文件 | 职责 |
|------|------|
| `src/modules/auth/auth.controller.ts` | 认证路由，所有端点使用 ThrottlerGuard 限流 |
| `src/modules/auth/auth.service.ts` | 认证业务逻辑，不直接操作 Repository |
| `src/modules/auth/auth.dto.ts` | 请求体 DTO 定义（含 class-validator 校验） |
| `src/modules/auth/auth.module.ts` | 模块声明，注册 JWT 和依赖模块 |
| `src/modules/auth/guards/jwt-auth.guard.ts` | JWT 鉴权守卫 |
| `src/modules/auth/strategies/jwt.strategy.ts` | Passport JWT 策略 |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/views/auth/LoginView.vue` | 登录页（三 Tab：短信/密码/邮箱） |
| `frontend/src/views/auth/RegisterView.vue` | 注册页（手机号注册） |
| `frontend/src/views/auth/ForgotPasswordView.vue` | 忘记密码页（两步流程，手机号/邮箱双通道） |
| `frontend/src/views/auth/components/SmsLoginForm.vue` | 短信验证码登录表单 |
| `frontend/src/views/auth/components/PasswordLoginForm.vue` | 密码登录表单 |
| `frontend/src/views/auth/components/EmailLoginForm.vue` | 邮箱验证码登录表单 |
| `frontend/src/views/auth/components/ForgotStep1Form.vue` | 密码找回 Step1 - 手机号验证 |
| `frontend/src/views/auth/components/ForgotEmailStep1Form.vue` | 密码找回 Step1 - 邮箱验证 |
| `frontend/src/views/auth/components/ForgotStep2Form.vue` | 密码找回 Step2 - 设置新密码 |
| `frontend/src/lib/auth.ts` | 所有认证 API 调用封装 |
| `frontend/src/stores/auth.ts` | Pinia 认证 Store（用户信息 + sessionChecked） |
| `frontend/src/composables/useAuthLogin.ts` | 登录成功后统一处理（fetchUser → 跳转） |

## 核心功能

### 1. 注册

- **流程**: 校验短信验证码 → 创建用户 → 自动签署协议 → 签发 JWT → 写入 httpOnly Cookie
- **设计**: 手机号为唯一主凭证（NOT NULL + UNIQUE），邮箱通过后续绑定
- **响应**: 注册成功返回 201，响应体 `data` 为 `null`（token 通过 Cookie 下发，不在响应体中暴露）
- **后端入口**: `auth.service.ts:register()`
- **前端页面**: `RegisterView.vue`，使用 vee-validate + zod 校验，含协议勾选弹窗

### 2. 登录

三种登录方式，前端通过 Tabs 切换：

| 方式 | 后端路由 | 后端方法 | 前端组件 |
|------|----------|----------|----------|
| 密码登录 | `POST /auth/login/password` | `loginByPassword()` | `PasswordLoginForm.vue` |
| 短信验证码 | `POST /auth/login/sms` | `loginBySms()` | `SmsLoginForm.vue` |
| 邮箱验证码 | `POST /auth/login/email` | `loginByEmail()` | `EmailLoginForm.vue` |

- **邮箱登录前提**: 用户需先注册（手机号）并绑定邮箱，未绑定时后端返回明确提示
- **响应**: 登录成功返回 200（`@HttpCode(200)`），响应体 `data` 为 `null`（token 通过 Cookie 下发）
- **统一处理**: 前端三种登录均 emit `success` 事件，由 `useAuthLogin` composable 统一处理后续流程

### 3. 密码找回

两步流程，Step1 支持手机号/邮箱双通道切换：

| 步骤 | 后端路由 | 说明 |
|------|----------|------|
| Step1 手机号验证 | `POST /auth/password/verify-reset` | 校验验证码 → 签发 resetToken（10min），返回 200 |
| Step1 邮箱验证 | `POST /auth/password/verify-reset-email` | 校验验证码 → 签发 resetToken（10min），返回 200 |
| Step2 重置密码 | `POST /auth/password/reset` | 验证 resetToken → 新旧密码校验 → 更新，返回 200 |

- **resetToken 设计**: 使用 JWT 签发，payload 包含 `purpose: 'password-reset'`，与登录 token 区分，避免被滥用
- **安全性**: 统一错误信息"验证码无效或已过期"，不暴露手机号/邮箱是否已注册

### 4. 退出登录

- **后端路由**: `POST /auth/logout`
- **行为**: 清除 `access_token` Cookie，返回 200
- **无需鉴权**: 任何请求都可以调用，幂等操作

### 5. JWT 鉴权（Cookie 会话模式）

- **Payload 最简化**: 仅包含 `sub`（用户 ID），避免易变字段导致 token 信息不一致
- **Token 传递**: 通过 httpOnly Cookie（`access_token`）传递，不再使用 Authorization Bearer header
- **Cookie 配置**: `httpOnly: true`、`sameSite: lax`、`path: /`、`maxAge: 7天`，生产环境启用 `secure`
- **Passport 策略**: `jwt.strategy.ts` 通过自定义 extractor 从 `req.cookies.access_token` 提取 JWT，附加到 `req.user`
- **前端无感知**: Cookie 由浏览器自动携带，前端无需手动管理 token 存储和请求头注入

## 限流策略

| 端点 | 限制 |
|------|------|
| 注册 | 60s / 5次 |
| 密码登录 | 60s / 10次 |
| 短信/邮箱登录 | 60s / 10次 |
| 验证身份（手机号/邮箱） | 60s / 5次 |
| 重置密码 | 60s / 5次 |
| 退出登录 | 无限流 |

## 路由守卫（前端）

- `requiresGuest`: 登录/注册/忘记密码页，已登录时重定向到 `/users`
- `requiresAuth`: 用户列表页，未登录时重定向到 `/login`

## 接口文档

详细接口参数和返回值见 Swagger：`/api/docs`（Tags: 认证）
