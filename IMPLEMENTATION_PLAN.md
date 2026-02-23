# 用户模块开发计划

> 统一分支 `feature/user-module`，按阶段 commit，共 7 个阶段

## 阶段总览

```
分支: feature/user-module（全程使用，按阶段提交）

阶段1: 用户实体改造 + 短信验证码服务（基础设施）     ✅ Complete
  ↓
阶段1.5: 安全修复（阶段1 代码审查问题）     ✅ Complete
  ↓
阶段2: 注册 + /users/me + 前端类型同步      ← 当前
  ↓
阶段2.5: 协议模块
  ↓
阶段3: 登录（短信 + 密码双通道）
  ↓
阶段4: 忘记密码 / 重置
  ↓
阶段5: 微信授权登录

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
**状态:** Not Started

### 后端

- [ ] 改造 `auth.service.ts` 注册逻辑
  - 手机号 + 短信验证码 + 密码注册
  - 调用 `VerificationService.verifyCode()` 校验验证码
  - 调用 `UserService` 创建用户（阶段1.5 M-03 已重构）
  - 签发 JWT 返回
- [ ] 更新 `auth.dto.ts` — RegisterDto 改为 `{ phone, smsCode, password, nickname? }`
- [ ] 实现 `GET /api/users/me` — 通过 JWT 获取当前用户信息（JwtAuthGuard 保护）
- [ ] 接口测试：完整注册流程 + `/users/me` 鉴权验证

### 前端

- [ ] 同步前端类型定义 `src/types/index.ts`（User 从 username/email 改为 phone/nickname/avatar/bio，RegisterPayload 对齐新 DTO）
- [ ] 注册页面 `src/views/auth/RegisterView.vue`
  - 手机号输入 + 获取验证码按钮（60秒倒计时）
  - 验证码输入
  - 密码输入 + 确认密码
  - 注册按钮
- [ ] 注册成功后自动登录跳转

### 验收标准

- 完整注册流程：输入手机号 → 获取验证码 → 填写密码 → 注册成功 → 自动登录
- `GET /api/users/me` 携带有效 token 返回当前用户信息，无 token 返回 401
- 手机号重复注册返回 409
- 前端类型与后端接口完全对齐，编译无错误

---

## 阶段 2.5：协议模块

**commit:** `feat: 协议模块（注册协议签署）`
**状态:** Not Started

### 后端

- [ ] 新建协议模块 `src/modules/agreement/`
  - `agreement.entity.ts` — 协议内容（type、title、version、content、effectiveDate）
  - `agreement-sign.entity.ts` — 签署记录（user_id、agreement_type、version、signedAt）
  - `agreement.service.ts` — 协议查询、签署、记录查询
  - `agreement.controller.ts` — GET 协议内容、POST 签署、GET 签署记录
  - `agreement.dto.ts` — 签署请求参数校验
  - `agreement.module.ts` — 模块注册
- [ ] 注册流程集成：注册成功后自动签署 `user-terms` 和 `privacy-policy`
- [ ] 接口测试：协议 CRUD + 签署记录

> 注：报名协议、缴费协议属于活动模块/支付模块，不在本阶段范围

### 前端

- [ ] 注册页新增协议勾选（用户条款 + 隐私政策，点击可查看全文）
- [ ] 协议详情弹窗组件

### 验收标准

- 协议签署记录正确写入数据库
- 注册成功后自动签署默认协议
- 协议内容可通过 API 查询

---

## 阶段 3：登录（短信 + 密码）

**commit:** `feat: 登录（短信验证码 + 密码双通道）`
**状态:** Not Started

### 后端

- [ ] 新增 `POST /api/auth/login/sms` — 短信验证码登录
- [ ] 改造 `POST /api/auth/login/password` — 手机号 + 密码登录
- [ ] 实现 `GET /api/users/:id/profile` — 获取用户公开信息
- [ ] 接口测试：两种登录方式 + 鉴权守卫

### 前端

- [ ] 登录页面 `src/views/auth/LoginView.vue` 改造
  - Tab 切换：短信验证码登录 / 密码登录
  - 短信验证码登录：手机号 + 验证码
  - 密码登录：手机号 + 密码
  - "忘记密码"入口
  - "去注册"入口
- [ ] Token 存储（localStorage）+ Axios 拦截器自动携带
- [ ] 路由守卫完善（未登录跳转登录页）
- [ ] 登录成功后跳转首页

### 验收标准

- 两种方式均能正常登录并获取 Token
- Token 过期/无效返回 401
- 前端鉴权守卫正常拦截未登录请求

---

## 阶段 4：忘记密码 / 重置

**commit:** `feat: 忘记密码 / 密码重置（手机号 + 邮箱）`
**状态:** Not Started

### 后端

- [ ] 实现 `POST /api/auth/password/verify` — 验证身份（手机号验证码 / 邮箱验证码）
  - 校验通过签发临时 resetToken（10分钟有效）
- [ ] 实现 `POST /api/auth/password/reset` — 重置密码
  - 校验 resetToken → 更新密码 → 废弃 resetToken
- [ ] 扩展 verification 模块：新增 `email-sender.service.ts`（邮件发送）、新增 `POST /api/auth/email/send` 端点、扩展 `verification.dto.ts` 支持 email 参数
- [ ] 接口测试：手机号重置 + 邮箱重置完整流程

### 前端

- [ ] 忘记密码页面 `src/views/auth/ForgotPasswordView.vue`
  - Step 1：选择验证方式（手机号 / 邮箱）
  - Step 2：输入手机号或邮箱 + 获取验证码 + 输入验证码
  - Step 3：设置新密码 + 确认密码
  - 重置成功提示 → 跳转登录页

### 验收标准

- 手机号通道：发送验证码 → 验证 → 重置密码 → 登录成功
- 邮箱通道：发送验证码 → 验证 → 重置密码 → 登录成功
- resetToken 过期（10分钟后）返回 400
- 新密码与旧密码相同返回 400

---

## 阶段 5：微信授权登录

**commit:** `feat: 微信授权登录`
**状态:** Not Started

### 后端

- [ ] 新建 `src/modules/auth/wechat/` 子模块
- [ ] 实现 `GET /api/auth/wechat` — 生成微信授权 URL 并重定向
- [ ] 实现 `GET /api/auth/wechat/callback` — 微信回调处理
  - 用授权码换取 access_token
  - 获取微信用户信息（openid、unionid、昵称、头像）
  - 查找已绑定账号 → 直接签发 JWT
  - 未绑定 → 自动创建账号或引导绑定手机号
- [ ] `user.entity.ts` 新增 `wechatOpenId`、`wechatUnionId` 字段
- [ ] 新建 `src/config/wechat.config.ts` — AppID、AppSecret、回调 URL
- [ ] 更新 `.env.example` 和 `.env.dev`
- [ ] 接口测试：完整 OAuth 流程

### 前端

- [ ] 登录页新增"微信登录"按钮
- [ ] 微信授权回调页面处理（接收 token、跳转首页）
- [ ] 首次微信登录绑定手机号页面（如需要）

### 验收标准

- 点击微信登录 → 跳转微信授权 → 授权成功 → 回调 → 获取 Token → 跳转首页
- 已绑定用户直接登录
- 未绑定用户引导绑定手机号

### 前置条件

- 微信开放平台 AppID 和 AppSecret
- 回调域名配置（需与微信后台一致）
