# 用户模块 - 接口契约

> v1.0.0 | 2026-02-23 | 供其他模块开发者对接使用

## 鉴权方式

| 项目 | 说明 |
|------|------|
| 方式 | Bearer Token（JWT） |
| 请求头 | `Authorization: Bearer <token>` |
| 有效期 | 7 天 |
| 获取方式 | 注册 / 登录接口返回 |

### JWT Payload 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| sub | string | 用户 ID（UUIDv7） |
| phone | string | 手机号 |
| nickname | string | 昵称 |

### 鉴权使用示例

```typescript
@UseGuards(JwtAuthGuard)
@Get('my-resources')
async getMyResources(@Req() req: Request) {
  const userId = req.user.sub;
}
```

---

## 接口清单

### 认证（公开）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/sms/send` | 发送短信验证码 |
| POST | `/api/auth/email/send` | 发送邮箱验证码 |
| POST | `/api/auth/register` | 用户注册（手机号 + 验证码 + 密码） |
| POST | `/api/auth/login/sms` | 短信验证码登录 |
| POST | `/api/auth/login/password` | 密码登录 |
| GET  | `/api/auth/wechat` | 微信授权登录（跳转微信） |
| GET  | `/api/auth/wechat/callback` | 微信授权回调 |
| POST | `/api/auth/password/verify` | 忘记密码 - 验证身份（手机号或邮箱） |
| POST | `/api/auth/password/reset` | 重置密码 |

### 协议（部分需鉴权）

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET  | `/api/agreements/:type` | 否 | 获取协议内容 |
| POST | `/api/agreements/sign` | 是 | 签署协议 |
| GET  | `/api/agreements/signed` | 是 | 查询签署记录 |

### 用户信息（需鉴权）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/users/me` | 获取当前登录用户信息 |
| GET  | `/api/users/:id/profile` | 获取用户公开信息（昵称、头像） |

---

## 统一响应格式

所有接口返回 `ApiResponseDto`，定义在 `src/common/dto/api-response.dto.ts`：

```json
{
  "success": true,
  "code": 200,
  "message": "success",
  "data": {},
  "timestamp": "2026-02-23T12:00:00.000Z"
}
```

### 通用错误码

| code | 说明 |
|------|------|
| 400 | 参数校验失败 |
| 401 | 未登录或 Token 无效/过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（手机号已注册等） |
| 429 | 请求频率超限 |

---

## 关键约定

1. **手机号是主凭证** — 注册必填，登录/重置密码基于手机号
2. **邮箱是辅助凭证** — 注册时非必填，报名时可补填，支持邮箱重置密码
3. **用户 ID 格式** — UUIDv7（时间有序），例：`019523a4-7e8b-7000-8000-000000000001`
4. **密码重置流程** — 先调 `/api/auth/sms/send`(type=reset) 或 `/api/auth/email/send`(type=reset) → 再调 `/api/auth/password/verify` 获取临时 resetToken → 最后调 `/api/auth/password/reset`
5. **协议类型** — `user-terms` / `privacy-policy` / `payment-agreement`

---

## 详细参数

启动后端后访问 Swagger 文档：`http://localhost:{PORT}/api/docs`
