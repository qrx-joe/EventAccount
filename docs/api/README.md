# 后端 API 文档索引

## 模块文档

| 模块 | 文档 | 职责 |
|------|------|------|
| 用户模块 | [user.md](modules/user.md) | 用户信息 CRUD、密码管理、微信账号关联 |
| 认证模块 | [auth.md](modules/auth.md) | 注册、登录（密码/短信/微信）、密码重置、JWT 签发 |
| 短信验证码模块 | [verification.md](modules/verification.md) | 验证码生成、发送（阿里云 SMS / Mock）、校验 |
| 用户协议模块 | [agreement.md](modules/agreement.md) | 协议版本管理、签署记录、自动 seed |

## Swagger API 文档

启动后端后访问 `/api-docs` 查看完整的接口参数、响应体、示例值。

## 统一响应体

所有接口返回统一格式（定义在 `src/common/dto/api-response.dto.ts`）：

```typescript
{
  success: boolean     // 业务是否成功
  code: number         // HTTP 状态码
  message: string      // 提示信息
  data: T | null       // 成功时为数据，失败时为 null
  timestamp: string    // ISO 8601 时间戳
}
```

## 全局中间件与安全

- **Helmet:** HTTP 安全头（`main.ts`）
- **CORS:** 限制为 `ALLOWED_ORIGINS` 配置的域名（`main.ts`）
- **速率限制:** 全局 60s/60 次 + 敏感接口独立限流（`@nestjs/throttler`）
- **异常过滤:** `AllExceptionsFilter` 捕获所有异常，统一返回 `ApiResponseDto` 格式
- **环境变量校验:** Joi Schema 校验必填配置项（`app.module.ts`）

## ID 生成

所有实体主键使用 UUIDv7（`src/shared/utils/id-generator.ts`），不使用 PostgreSQL 内置函数。
