# 用户模块开发计划

> 基于技术依赖链拆分，共 5 个阶段，顺序执行

## 阶段总览

```
阶段1: 用户实体改造 + 短信验证码服务（基础设施）
  ↓
阶段2: 注册 + 协议签署（依赖阶段1）
  ↓
阶段3: 登录（短信 + 密码）（依赖阶段1）
  ↓
阶段4: 忘记密码 / 重置（依赖阶段1）
  ↓
阶段5: 微信授权登录（独立第三方对接）
```

---

## 阶段 1：用户实体改造 + 短信验证码服务

**分支:** `feature/user-entity-sms`
**目标:** 完成用户数据模型改造和短信基础设施，为后续所有功能提供基础
**状态:** Complete

### 后端

- [x] 改造 `user.entity.ts`
  - `phone` 替代 `email` 为主凭证（unique、必填）
  - `email` 改为可选字段
  - `username` 改为 `nickname`（可选，自动生成）
  - 新增 `avatar`（头像 URL）、`bio`（个性签名）字段
- [x] 同步更新 `user.dto.ts`、`user.service.ts`、`user.controller.ts`
- [x] 同步更新 `auth.service.ts`、`auth.dto.ts`（phone 替代 email，nickname 替代 username，JwtPayload 改为 `{ sub, phone, nickname }`）
- [x] 实现 `JwtAuthGuard`（`src/modules/auth/guards/jwt-auth.guard.ts`）+ `JwtStrategy`（`src/modules/auth/strategies/jwt.strategy.ts`），AuthModule 导出供其他模块使用
- [x] 新建验证码模块 `src/modules/verification/`
  - `verification.service.ts` — 验证码生成（6位）、内存缓存校验、过期机制（5分钟）+ 阿里云短信 SDK（`@alicloud/dysmsapi20170525`）发送
  - `verification.controller.ts` — `POST /api/auth/sms/send`
  - `verification.dto.ts` — phone + type 参数校验
  - `verification.module.ts`
- [x] 新建 `src/config/sms.config.ts` — AccessKeyId、AccessKeySecret、签名（SignName）、模板 Code（TemplateCode）、endpoint（dysmsapi.aliyuncs.com）
- [x] 安装阿里云 SMS SDK 依赖：`@alicloud/dysmsapi20170525`、`@alicloud/openapi-client`、`@alicloud/tea-util`
- [x] 更新 `.env.example` 和 `.env.dev` 补充短信服务配置项
- [x] 修复 `app.module.ts` envFilePath 配置（原始代码未指定 envFilePath，导致 .env.dev 未加载）
- [x] 接口测试：验证码发送 + 实体 CRUD + JwtAuthGuard 鉴权

### 前端

- [ ] 阶段1 前端无页面改动（基础设施阶段）

### 验收标准

- `POST /api/auth/sms/send` 能正常发送验证码
- 用户实体字段改造完成，数据库同步成功
- 编译无错误，现有测试通过

---

## 阶段 2：注册 + 协议签署

**分支:** `feature/user-register`
**目标:** 用户能通过手机号注册并自动签署协议
**依赖:** 阶段1（用户实体 + 短信服务）
**状态:** Not Started

### 后端

- [ ] 改造 `auth.service.ts` 注册逻辑
  - 手机号 + 短信验证码 + 密码注册
  - 注册成功自动签署 `user-terms` 和 `privacy-policy`
  - 签发 JWT 返回
- [ ] 新建协议模块 `src/modules/agreement/`
  - `agreement.entity.ts` — 协议内容（type、title、version、content、effectiveDate）
  - `agreement-sign.entity.ts` — 签署记录（user_id、agreement_type、version、signedAt）
  - `agreement.service.ts` — 协议查询、签署、记录查询
  - `agreement.controller.ts` — GET 协议内容、POST 签署、GET 签署记录
  - `agreement.dto.ts` — 签署请求参数校验
  - `agreement.module.ts` — 模块注册
- [ ] 更新 `auth.dto.ts` — RegisterDto 改为 phone + smsCode + password + nickname?
- [ ] 接口测试：完整注册流程 + 协议签署验证

### 前端

- [ ] 注册页面 `src/views/auth/RegisterView.vue`
  - 手机号输入 + 获取验证码按钮（60秒倒计时）
  - 验证码输入
  - 密码输入 + 确认密码
  - 协议勾选（用户条款 + 隐私政策，点击可查看全文）
  - 注册按钮
- [ ] 协议详情页/弹窗组件
- [ ] 注册成功后自动登录跳转

### 验收标准

- 完整注册流程：输入手机号 → 获取验证码 → 填写密码 → 勾选协议 → 注册成功 → 自动登录
- 协议签署记录正确写入数据库
- 手机号重复注册返回 409

---

## 阶段 3：登录（短信 + 密码）

**分支:** `feature/user-login`
**目标:** 用户能通过短信验证码或密码登录
**依赖:** 阶段1（短信服务）
**状态:** Not Started

### 后端

- [ ] 新增 `POST /api/auth/login/sms` — 短信验证码登录
- [ ] 改造 `POST /api/auth/login/password` — 手机号 + 密码登录（现有是邮箱）
- [ ] 实现 `GET /api/users/me` — 获取当前用户信息
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

**分支:** `feature/user-password-reset`
**目标:** 用户能通过手机号或邮箱重置密码
**依赖:** 阶段1（短信服务）
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

**分支:** `feature/user-wechat-auth`
**目标:** 用户能通过微信扫码/点击授权登录
**依赖:** 阶段1（用户实体 + JWT 基础设施）、阶段3（登录流程）
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
