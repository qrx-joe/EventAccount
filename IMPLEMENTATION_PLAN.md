# 用户模块开发计划

> 统一分支 `feature/user-module`，按阶段 commit，共 7 个阶段

## 阶段总览

```
分支: feature/user-module（全程使用，按阶段提交）

阶段1: 用户实体改造 + 短信验证码服务（基础设施）     ✅ Complete
  ↓
阶段1.5: 安全修复（阶段1 代码审查问题）     ✅ Complete
  ↓
阶段2: 注册 + /users/me + 前端类型同步     ✅ Complete
  ↓
阶段2.5: 协议模块     ✅ Complete
  ↓
阶段3: 登录（短信 + 密码双通道）     ✅ Complete
  ↓
阶段4: 忘记密码 / 重置（手机号通道）     ✅ Complete
  ↓
阶段5: 微信授权登录      ✅ Complete
  ↓
阶段6: 全项目代码审查修复     ✅ Complete

完成后合并到 develop，squash 或保留 commit 均可
```

---

## 阶段 1：用户实体改造 + 短信验证码服务

**commit:** `feat: 用户实体改造 + 短信验证码服务`
**状态:** Complete

### 后端

- [x] 改造 `user.entity.ts`
  - `phone` 替代 `email` 为主凭证（unique、必填）
  - `email` 改为可选字段
  - `username` 改为 `nickname`（可选，自动生成）
  - 新增 `avatar`（头像 URL）、`bio`（个性签名）字段
- [x] 同步更新 `user.dto.ts`、`user.service.ts`、`user.controller.ts`
- [x] 同步更新 `auth.service.ts`、`auth.dto.ts`（phone 替代 email，nickname 替代 username，JwtPayload 改为 `{ sub, phone, nickname }`）
- [x] 实现 `JwtAuthGuard` + `JwtStrategy`，AuthModule 导出供其他模块使用
- [x] 新建验证码模块 `src/modules/verification/`
- [x] 新建 `src/config/sms.config.ts`
- [x] 安装阿里云 SMS SDK 依赖
- [x] 更新 `.env.example` 和 `.env.dev` 补充短信服务配置项
- [x] 修复 `app.module.ts` envFilePath 配置
- [x] 接口测试：验证码发送 + 实体 CRUD + JwtAuthGuard 鉴权

### 验收标准

- `POST /api/auth/sms/send` 能正常发送验证码
- 用户实体字段改造完成，数据库同步成功
- 编译无错误

---

## 阶段 1.5：安全修复

**commit:** `fix(安全加固): 阶段1.5 — 安全修复与代码质量改进`
**状态:** Complete

### 严重问题（阻塞后续开发）

- [x] **S-01** 移除 JWT `'fallback-secret'` 硬编码（`jwt.strategy.ts`、`auth.module.ts`），缺失时抛异常终止启动
- [x] **S-02** `UserService.create()` 密码明文入库 — 加 bcrypt hash，移除 `UserController.create` 统一走 `AuthService.register()`
- [x] **S-03** `UserController` 加 `@UseGuards(JwtAuthGuard)` 鉴权守卫
- [x] **S-04** `verification.service.ts` 验证码生成改用 `crypto.randomInt()` 替代 `Math.random()`
- [x] **S-05** `verifyCode()` 增加最大尝试次数限制（5 次），防止暴力破解

### 重要问题

- [x] **M-01** 验证码内存 Map 增加定时清理机制（`OnModuleInit` + `setInterval`），防止内存泄漏
- [x] **M-02** 重新定义 `UpdateUserDto`，排除 `password` 和 `phone` 字段，敏感字段需独立接口
- [x] **M-03** `AuthService` 依赖 `UserService` 创建用户，消除重复的用户创建逻辑
- [x] **M-04** 统一手机号校验正则

### 其他改进

- [x] JwtPayload 只保留 `sub`（用户 ID），移除易变的 `phone`、`nickname`
- [x] `.env.example` 数据库名 `t2_program` 修正为 `t3_program`
- [x] 新增 `@nestjs/throttler` 全局速率限制 + Auth 接口单独限流
- [x] `tsconfig.json` 开启 `noImplicitAny`
- [x] 编译 + lint 通过

### 验收标准

- 缺少 `JWT_SECRET` 时服务启动失败并报明确错误
- `PUT /users/:id` 无法修改 `password` 和 `phone`
- 验证码连续错误 5 次后自动失效
- 编译无错误

---

## 阶段 2：注册

**commit:** `feat: 注册（手机号+验证码+密码）+ /users/me + 前端类型同步`
**状态:** Complete

### 后端

- [x] 改造 `auth.service.ts` 注册逻辑
  - 手机号 + 短信验证码 + 密码注册
  - 调用 `VerificationService.verifyCode()` 校验验证码
  - 调用 `UserService` 创建用户（阶段1.5 M-03 已重构）
  - 签发 JWT 返回
- [x] 更新 `auth.dto.ts` — RegisterDto 改为 `{ phone, smsCode, password, nickname? }`
- [x] 实现 `GET /api/users/me` — 通过 JWT 获取当前用户信息（JwtAuthGuard 保护）
- [x] 接口测试：完整注册流程 + `/users/me` 鉴权验证

### 前端

- [x] 同步前端类型定义 `src/types/index.ts`（User 从 username/email 改为 phone/nickname/avatar/bio，RegisterPayload 对齐新 DTO）
- [x] 注册页面 `src/views/auth/RegisterView.vue`
  - 手机号输入 + 获取验证码按钮（60秒倒计时）
  - 验证码输入
  - 密码输入 + 确认密码
  - 注册按钮
- [x] 注册成功后自动登录跳转

### 验收标准

- 完整注册流程：输入手机号 → 获取验证码 → 填写密码 → 注册成功 → 自动登录
- `GET /api/users/me` 携带有效 token 返回当前用户信息，无 token 返回 401
- 手机号重复注册返回 409
- 前端类型与后端接口完全对齐，编译无错误

---

## 阶段 2.5：协议模块

**commit:** `feat: 协议模块（注册协议签署）`
**状态:** Complete

### 后端

- [x] 新建协议模块 `src/modules/agreement/`
  - `agreement.entity.ts` — 协议内容（type、title、version、content、effectiveDate）
  - `agreement-sign.entity.ts` — 签署记录（user_id、agreement_type、version、signedAt）
  - `agreement.service.ts` — 协议查询、签署、记录查询
  - `agreement.controller.ts` — GET 协议内容、POST 签署、GET 签署记录
  - `agreement.dto.ts` — 签署请求参数校验
  - `agreement.module.ts` — 模块注册
- [x] 注册流程集成：注册成功后自动签署 `user-terms` 和 `privacy-policy`
- [x] 接口测试：协议 CRUD + 签署记录

> 注：报名协议、缴费协议属于活动模块/支付模块，不在本阶段范围

### 前端

- [x] 注册页新增协议勾选（用户条款 + 隐私政策，点击可查看全文）
- [x] 协议详情弹窗组件

### 验收标准

- 协议签署记录正确写入数据库
- 注册成功后自动签署默认协议
- 协议内容可通过 API 查询

---

## 阶段 3：登录（短信 + 密码）

**commit:** `feat: 登录（短信验证码 + 密码双通道）`
**状态:** Complete

### 后端

- [x] 新增 `POST /api/auth/login/sms` — 短信验证码登录
- [x] 改造 `POST /api/auth/login/password` — 手机号 + 密码登录（原 `POST /api/auth/login` 拆分）
- [x] 实现 `GET /api/users/:id/profile` — 获取用户公开信息（仅返回 id/nickname/avatar/bio）
- [x] 代码审查修复：timingSafeEqual 验证码比对、bcrypt salt rounds 12、路由顺序优化、Swagger 完善
- [x] 接口测试：两种登录方式 + 鉴权守卫 + 公开 profile + 错误信息不泄露注册状态

### 前端

- [x] 登录页面 `src/views/auth/LoginView.vue` 改造
  - Tab 切换：短信验证码登录 / 密码登录（shadcn-vue Tabs 组件）
  - 短信验证码登录：`SmsLoginForm.vue` 子组件
  - 密码登录：`PasswordLoginForm.vue` 子组件
  - "忘记密码"入口（阶段 4 实现，当前禁用态文本）
  - "去注册"入口
- [x] Token 存储（localStorage）+ Axios 拦截器自动携带（阶段 2 已完成）
- [x] 路由守卫完善（阶段 2 已完成）
- [x] 登录成功后跳转首页
- [x] 代码审查修复：PHONE_REGEX 提取到 validators.ts、fetchUser 返回值检查、inputmode="numeric"

### 验收标准

- ✅ 两种方式均能正常登录并获取 Token
- ✅ Token 过期/无效返回 401
- ✅ 前端鉴权守卫正常拦截未登录请求
- ✅ 密码登录错误不泄露手机号注册状态
- ✅ 公开 profile 只返回非敏感字段
- ✅ 验证码一次性使用，用后即失效

---

## 阶段 4：忘记密码 / 重置

**commit:** `feat: 忘记密码 / 密码重置（手机号验证码通道）`
**状态:** Complete

### 后端

- [x] 新增 DTO 类型：`ResetTokenPayload`、`ForgotPasswordVerifyDto`、`ResetPasswordDto`（`auth.dto.ts`）
- [x] `UserService` 新增 `findByIdWithPassword()`、`updatePassword()` 方法
- [x] `AuthService` 新增 `verifyResetCode()`、`resetPassword()` 方法
  - resetToken 使用 JWT 签发，10 分钟有效，payload 含 `purpose: 'password-reset'`
  - 手动 `jwtService.verify()` + purpose 校验，不走 JwtAuthGuard
  - 新旧密码 bcrypt 比对，相同则拒绝
- [x] `AuthController` 新增 `POST /api/auth/password/verify-reset`、`POST /api/auth/password/reset`（@Throttle 60s/5次）
- [x] 代码审查修复：
  - `jwt.strategy.ts` 增加 purpose 校验，拒绝 resetToken 冒充登录 token
  - `verifyResetCode()` 统一错误信息，避免泄露手机号注册状态
- [x] 接口测试（11 个用例全部通过）：
  1. ✅ 发送重置验证码 → 200
  2. ✅ 验证重置验证码（正确）→ 200 + resetToken
  3. ✅ 验证重置验证码（错误码）→ 400
  4. ✅ 验证重置验证码（未注册手机）→ 400
  5. ✅ 重置密码（正确 token + 新密码）→ 200
  6. ✅ 用新密码登录 → 200
  7. ✅ 用旧密码登录 → 401
  8. ✅ 重置密码（新旧密码相同）→ 400
  9. ✅ 重置密码（两次密码不一致）→ 400
  10. ✅ 重置密码（伪造/过期 token）→ 401
  11. ✅ 用登录 token 冒充 resetToken → 401

### 前端

- [x] 新增类型：`VerifyResetCodePayload`、`VerifyResetCodeResult`、`ResetPasswordPayload`（`types/index.ts`）
- [x] 新增 API 函数：`verifyResetCode()`、`resetPassword()`（`lib/auth.ts`）
- [x] 新增路由 `/forgot-password`（meta: requiresGuest）
- [x] `PasswordLoginForm.vue` 禁用态 span 改为 `<RouterLink to="/forgot-password">`
- [x] 新建 `ForgotPasswordView.vue` — 两步骤单页面（步骤指示器 + v-if 切换）
  - `ForgotStep1Form.vue` — 手机号 + 短信验证码验证身份
  - `ForgotStep2Form.vue` — 设置新密码（含确认密码 + refine 校验）
- [x] 代码审查修复：
  - 拆分为 3 个独立组件，解决 vee-validate useForm provide/inject 冲突
  - 移除 PasswordLoginForm.vue 中冗余的 RouterLink import

### 验收标准

- ✅ 手机号通道：发送验证码 → 验证 → 重置密码 → 用新密码登录成功
- ✅ 旧密码登录失败（401）
- ✅ resetToken 伪造/过期返回 401
- ✅ 新密码与旧密码相同返回 400
- ✅ 登录 token 无法冒充 resetToken（purpose 校验）
- ✅ 未注册手机号不泄露注册状态（统一错误信息）

> 注：邮箱通道本阶段不做，后续按需补充

---

## 阶段 5：微信开放平台 PC 扫码登录

**commit:** `feat(微信登录): 阶段5 — 微信开放平台PC扫码登录`
**状态:** Complete

### 后端

- [x] 新建 `src/config/wechat.config.ts` — registerAs('wechat') 配置 AppID、AppSecret、回调 URL
- [x] 更新 `.env.dev` 和 `.env.example` — 新增 WECHAT_OPEN_APPID/SECRET/CALLBACK_URL
- [x] `app.module.ts` — ConfigModule.load 添加 wechatConfig
- [x] `user.entity.ts` — password 改为 nullable，新增 wechatOpenId（varchar 64, unique, nullable, select:false）和 wechatUnionId
- [x] `user.dto.ts` — CreateUserDto.password 改为 @IsOptional
- [x] `user.service.ts` — 新增 findByWechatOpenId()、createFromWechat()、linkWechat()，create() 适配 password 可选
- [x] `verification.dto.ts` — VerificationCodeType 新增 BIND_PHONE = 'bindphone'
- [x] `auth.service.ts` — loginByPassword 增加密码为空检查，resetPassword 适配微信用户首次设密码
- [x] 新建 `src/modules/auth/wechat/wechat-oauth.dto.ts` — WechatCallbackQueryDto、WechatBindPhoneDto（class-validator）+ 接口定义
- [x] 新建 `src/modules/auth/wechat/wechat-oauth.service.ts` — 核心 OAuth 服务
  - Mock/真实双模式（WECHAT_OPEN_APPID 为空时自动 Mock，固定 openid = mock_openid_fixed）
  - state CSRF 防护（内存 Map + 5 分钟过期 + 一次性使用 + 定期清理）
  - getAuthorizeUrl() — 生成 state → 返回授权 URL
  - handleCallback(code, state) — 验证 state → 获取用户信息 → 已绑定签 token / 未绑定签 bindToken
  - bindPhone(dto) — 解码 bindToken → 验证短信 → 查找/创建用户 → 关联微信 → 签发 token
- [x] 新建 `src/modules/auth/wechat/wechat-oauth.controller.ts` — 3 个端点（GET wechat、GET wechat/callback、POST wechat/bindphone）+ @Throttle + Swagger
- [x] `auth.module.ts` — 注册 WechatOAuthController + WechatOAuthService
- [x] 代码审查修复：
  - bindPhone 中冗余的 findByWechatOpenId 查询合并为一次
  - state 校验和验证码校验改用 BadRequestException（400）而非 UnauthorizedException（401）
- [x] E2E 测试（10 个用例全部通过）：
  1. ✅ 获取微信授权链接（Mock）→ authorizeUrl 含 mock_code + state
  2. ✅ 微信回调 - 新用户 → action=bindphone + bindToken
  3. ✅ state 重放攻击 → 400（一次性使用）
  4. ✅ 发送绑定验证码（type=bindphone）→ 201
  5. ✅ 绑定手机号 → 201 + token
  6. ✅ 用 token 访问 /users/me → 200，确认微信用户信息
  7. ✅ 微信老用户回归 → action=login + token
  8. ✅ 无效 bindToken → 401
  9. ✅ 微信已绑定其他账号 → 409
  10. ✅ 微信用户密码登录 → 401 "该账号未设置密码"
- [x] 测试基础设施改进：
  - jest-e2e.json 添加 transformIgnorePatterns（uuid v13 ESM 兼容）
  - test/setup-env.ts 加载 .env.dev（Jest 默认 NODE_ENV=test 无对应 env 文件）

### 前端

- [x] `types/index.ts` — 新增 WechatAuthorizeResult、WechatCallbackResult、WechatBindPhonePayload，SendSmsCodePayload.type 扩展 'bindphone'
- [x] `lib/auth.ts` — 新增 getWechatAuthUrl()、wechatCallback()、wechatBindPhone()
- [x] `router/index.ts` — 新增 /wechat/callback（无守卫）和 /wechat/bindphone（requiresGuest）
- [x] `components/icons/WechatIcon.vue` — 微信绿色 SVG 图标组件
- [x] `LoginView.vue` — 登录表单下方新增 Separator + "其他登录方式" + 微信登录按钮
- [x] 新建 `WechatCallbackView.vue` — 回调中间页（onMounted 解析 code+state → 调 API → 按 action 分流）
- [x] 新建 `WechatBindPhoneView.vue` — 绑定手机号表单（展示微信头像昵称 + 手机号 + 验证码 + 60s 倒计时）
- [x] 代码审查修复：onUnmounted 中清理 sessionStorage 绑定数据

### 验收标准

- ✅ Mock 完整新用户流程：点击微信登录 → callback → 绑定手机号 → 登录成功
- ✅ Mock 老用户回归：点击微信登录 → 直接登录
- ✅ state 一次性使用，重放攻击被拒绝（400）
- ✅ bindToken 有效期 10 分钟，过期/伪造返回 401
- ✅ 微信已绑定其他账号 → 409 冲突
- ✅ 微信用户（无密码）尝试密码登录 → 401 "该账号未设置密码"
- ✅ 前后端编译 + lint 通过
- ✅ 10 个 E2E 测试全部通过

---

## 阶段 6：全项目代码审查修复

**commit（后端）:** `fix(安全加固): 全项目代码审查修复`
**commit（前端）:** `fix(代码审查): 全项目前端代码审查修复`
**状态:** Complete

> 阶段 1-5 全部完成后，对整个项目进行前后端全面代码审查，修复所有立即修复（Critical）和短期修复（High）问题。

### 后端（10 项修复，13 文件变更）

#### 严重问题（Critical）

- [x] **C-01** CORS 全开放 → 限制为 `ALLOWED_ORIGINS` 环境变量配置的域名（`main.ts`）
- [x] **C-02** 缺少 HTTP 安全头 → 安装并启用 `helmet` 中间件（`main.ts`、`package.json`）
- [x] **C-04** AllExceptionsFilter 只捕获 HttpException → `@Catch()` 捕获所有异常，非 HTTP 异常返回 500 + 通用错误信息（`http-exception.filter.ts`）
- [x] **C-05** 短信发送接口无独立限流 → `@Throttle({ default: { ttl: 60000, limit: 5 } })` + `@UseGuards(ThrottlerGuard)`（`verification.controller.ts`）

#### 重要问题（High）

- [x] **H-03** `UserService.update()` Object.assign 可能用 undefined 覆盖已有值 → 改为逐字段 `!== undefined` 检查（`user.service.ts`）
- [x] **H-05** `tsconfig.json` 未开启 strict 模式 → 添加 `"strict": true`，保留 `"strictPropertyInitialization": false`（TypeORM 实体需要）
- [x] **H-06** ESLint `no-explicit-any` 关闭 → 改为 `warn` 级别（`eslint.config.mjs`）
- [x] **H-07** 生产环境 ValidationPipe 暴露详细错误 → `disableErrorMessages: process.env.NODE_ENV === 'production'`（`main.ts`）

#### 中等问题（Medium）

- [x] **M-01** 缺少环境变量校验 → 添加 Joi validationSchema 校验必要环境变量（`app.module.ts`、`package.json`）

#### 低优先级（Low）

- [x] **L-01** envFilePath 加载顺序问题 → `.env.${NODE_ENV}` 优先于 `.env`（`app.module.ts`）
- [x] **L-02/L-06** 数据库默认名 `t2_program` → `t3_program` + Swagger 标题同步（`database.config.ts`、`main.ts`）
- [x] **L-03** E2E 测试 `res.body` 类型不安全 → 定义 `ApiBody<T>` 泛型接口 + 各接口数据类型（`wechat-oauth.e2e-spec.ts`）

### 前端（6 项修复，14 文件变更，2 新文件，2 删除文件）

#### 严重问题（P0）

- [x] **#1** UserListView 编辑/删除按钮无权限控制 → 添加 `v-if="auth.user?.id === user.id"` 条件渲染
- [x] **#3** HTTP 拦截器 401 时使用 `window.location.href` 导致 SPA 状态丢失 → 改为 `router.push({ name: 'login' })`

#### 重要问题（P1）

- [x] **#4/#5** `index.html` lang="en" → "zh-CN"，title "frontend" → "T3 Program"
- [x] **#6** 短信倒计时逻辑在 4 个组件中重复 → 提取为 `composables/useSmsCountdown.ts` 组合式函数
- [x] **#7** 登录成功处理逻辑在 4 个组件中重复 → 提取为 `composables/useAuthLogin.ts` 组合式函数
- [x] **#8** 脚手架残留文件 `HelloWorld.vue` 和 `vue.svg` → 删除
- [x] **#9** 缺少 404 兜底路由 → 添加 `/:pathMatch(.*)*` 重定向到 `/login`

### 新增依赖

- 后端：`helmet`（HTTP 安全头）、`joi`（环境变量校验）

### 验收标准

- ✅ 后端 `npm run build` 编译通过
- ✅ 后端 `npm run lint` 0 errors 0 warnings
- ✅ 后端 E2E 测试 10/10 全部通过
- ✅ 前端 `npm run build` 编译通过
- ✅ 前端 `npm run lint` 0 errors
- ✅ MR !7 已创建并推送
