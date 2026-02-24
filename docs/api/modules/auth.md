# 认证模块

## 模块职责

处理用户注册、密码登录、短信登录、密码重置、微信扫码登录等认证流程，签发和验证 JWT token。

## 架构设计

```
src/modules/auth/
├── auth.controller.ts           — 注册、登录、密码重置接口
├── auth.service.ts              — 认证核心业务逻辑
├── auth.dto.ts                  — 请求/响应 DTO + JWT Payload 类型
├── auth.module.ts               — 模块定义
├── strategies/
│   └── jwt.strategy.ts          — Passport JWT 验证策略（含 purpose 校验）
├── guards/
│   └── jwt-auth.guard.ts        — JWT 认证守卫
└── wechat/
    ├── wechat-oauth.controller.ts  — 微信 OAuth 接口（3 个端点）
    ├── wechat-oauth.service.ts     — 微信 OAuth 核心逻辑（含 Mock 模式）
    └── wechat-oauth.dto.ts         — 微信相关 DTO + 接口定义
```

## 核心功能

### 注册

- **实现位置:** `auth.service.ts:register()` (第 41 行)
- **设计说明:** 手机号 + 短信验证码 + 密码注册，成功后自动签署默认协议（`AgreementService.autoSignOnRegister`）

### 密码登录

- **实现位置:** `auth.service.ts:loginByPassword()` (第 67 行)
- **设计说明:** 手机号 + 密码，bcrypt 比对。微信用户（无密码）尝试密码登录返回 401 "该账号未设置密码"

### 短信验证码登录

- **实现位置:** `auth.service.ts:loginBySms()` (第 89 行)
- **设计说明:** 手机号 + 短信验证码，验证码一次性使用。未注册手机号返回 400 "该手机号尚未注册，请先注册"

### 密码重置

- **验证身份:** `auth.service.ts:verifyResetCode()` (第 118 行) — 验证手机号 + 验证码，签发含 `purpose: 'password-reset'` 的 resetToken（10 分钟有效）
- **重置密码:** `auth.service.ts:resetPassword()` (第 149 行) — 手动 `jwtService.verify()` + purpose 校验，新旧密码 bcrypt 比对防止相同密码

### 微信扫码登录

- **获取授权链接:** `wechat-oauth.service.ts:getAuthorizeUrl()` — 生成 state（一次性，5 分钟过期）+ 授权 URL
- **回调处理:** `wechat-oauth.service.ts:handleCallback()` (第 135 行) — 验证 state → 获取微信用户信息 → 已绑定用户直接签发 token / 新用户签发 bindToken
- **绑定手机号:** `wechat-oauth.service.ts:bindPhone()` (第 184 行) — 解码 bindToken → 验证短信 → 查找或创建用户 → 关联微信 → 签发 token

## 安全设计

### JWT Token 分化策略

| Token 类型 | Payload | 有效期 | 用途 |
|-----------|---------|--------|------|
| 登录 token | `{ sub: userId }` | 7 天 | 接口鉴权 |
| 重置密码 token | `{ sub: userId, purpose: 'password-reset' }` | 10 分钟 | 密码重置 |
| 微信绑定 token | `{ sub: 'wechat:openid', purpose: 'wechat-bindphone', ... }` | 10 分钟 | 绑定手机号 |

- `jwt.strategy.ts` 校验 purpose 字段，拒绝 resetToken/bindToken 冒充登录 token
- 重置密码和微信绑定使用手动 `jwtService.verify()` + purpose 校验，不走 JwtAuthGuard

### CSRF 防护（微信 OAuth）

- state 参数存储在内存 Map，5 分钟过期，一次性使用
- 定期清理过期 state（10 分钟周期）

### 速率限制

| 接口 | 限制 |
|------|------|
| 注册 | 60s/5 次 |
| 密码登录 | 60s/10 次 |
| 短信登录 | 60s/10 次 |
| 密码重置验证 | 60s/5 次 |
| 密码重置 | 60s/5 次 |
| 微信授权链接 | 60s/10 次 |
| 微信绑定手机号 | 60s/5 次 |

### Mock 模式

- `WECHAT_OPEN_APPID` 为空时自动进入 Mock 模式
- 固定 openid = `mock_openid_fixed`，昵称 = "微信Mock用户"
- 授权链接指向前端 `/wechat/callback?code=mock_code&state=xxx`

## 数据库关联

认证模块不直接管理数据库表，通过 `UserService` 和 `AgreementService` 操作：

- **users 表:** 查询/创建/关联微信（通过 UserService）
- **agreements + agreement_signs 表:** 注册时自动签署（通过 AgreementService）

## 接口文档

详细接口参数和返回值见 Swagger 自动生成的 API 文档：启动后端后访问 `/api-docs`
