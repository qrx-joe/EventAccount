# 验证码模块

## 模块职责

负责验证码的生成、发送（短信 + 邮件双通道）和校验，为认证模块提供底层验证能力。

## 架构设计

### 后端

| 文件 | 职责 |
|------|------|
| `src/modules/verification/verification.service.ts` | 验证码核心逻辑（生成/发送/校验/频率限制） |
| `src/modules/verification/verification.controller.ts` | 短信验证码路由 `POST /auth/sms/send` |
| `src/modules/verification/email-verification.controller.ts` | 邮箱验证码路由 `POST /auth/email/send` |
| `src/modules/verification/verification.dto.ts` | 请求体 DTO + 验证码类型枚举 |
| `src/modules/verification/verification.module.ts` | 模块声明，导出 VerificationService 供 AuthModule 使用 |
| `src/modules/verification/store/verification-store.gateway.ts` | 存储网关，根据配置选择 memory 或 redis 后端 |
| `src/modules/verification/store/verification-store.types.ts` | 存储接口定义（VerificationStore） |
| `src/modules/verification/store/in-memory-verification.store.ts` | 内存存储实现，惰性过期 |
| `src/modules/verification/store/redis-verification.store.ts` | Redis 存储实现，利用 Redis TTL |
| `src/config/sms.config.ts` | 阿里云 SMS 配置（registerAs） |
| `src/config/email.config.ts` | SMTP 邮件配置（registerAs） |
| `src/config/redis.config.ts` | Redis 连接 + OTP 存储后端配置（registerAs） |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/composables/useSmsCountdown.ts` | 短信验证码发送 + 60s 倒计时 |
| `frontend/src/composables/useEmailCountdown.ts` | 邮箱验证码发送 + 60s 倒计时 |
| `frontend/src/lib/auth.ts` | `sendSmsCode()` / `sendEmailCode()` API 封装 |

## 核心功能

### 1. 验证码生成与存储

- **生成**: `crypto.randomInt(100000, 1000000)` 安全随机 6 位数字
- **存储后端**: 通过 `VerificationStoreGateway` 按配置选择 memory 或 redis（`redis.otpStoreBackend` 环境变量，默认 memory）
  - **memory**: 内存 Map，key 格式 `target:type`，惰性过期（读/写时检查 `isExpired`，无定时清理）
  - **redis**: Redis Hash + TTL，由 Redis 自动过期清理
- **有效期**: 5 分钟
- **一次性使用**: 校验成功后立即删除

### 2. 发送通道

| 通道 | 服务商 | 配置 | Mock 条件 |
|------|--------|------|-----------|
| 短信 | 阿里云 SMS（dysmsapi） | `SMS_ACCESS_KEY_ID` 等 | 缺少 AccessKey 时 |
| 邮件 | 阿里云 SMTP（DirectMail） | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` 等 | 缺少 SMTP 配置时 |

- **Mock 模式**: 配置缺失时自动降级为 Mock，验证码输出到日志
- **先发后存**: 发送成功后才缓存验证码和频率限制，发送失败不会产生无效限频
- **邮件标题区分**: 根据 type 使用不同标题（登录验证码/密码重置验证码/注册验证码）

### 3. 频率限制

- **发送频率**: 同一 target + type，60 秒内只能发送一次
- **ThrottlerGuard**: 控制器层额外限制 60s / 5次
- **双重保护**: 应用层频率限制 + NestJS Throttler 限流

### 4. 校验安全

- **最大尝试次数**: 5 次（防暴力破解），超限后删除验证码
- **常量时间比较**: 使用 `crypto.timingSafeEqual` 防时序攻击
- **泛化 key**: `target` 参数统一处理手机号和邮箱，无需区分通道

### 5. 过期清理

- **memory 后端**: 惰性过期 — 读取/校验时检查 `isExpired`，过期条目在访问时删除，无后台定时清理
- **redis 后端**: 依赖 Redis 原生 TTL 自动过期
- `OnModuleDestroy` 关闭 Redis 连接（如使用 redis 后端），防连接泄漏

## 前端 Composable 设计

`useSmsCountdown` 和 `useEmailCountdown` 结构相同：

1. 校验输入格式（手机号正则 / 邮箱正则）
2. 调用发送 API
3. 成功后启动 60 秒倒计时，控制按钮禁用状态
4. `onUnmounted` 自动清理定时器

## 环境变量

```env
# 阿里云 SMS
SMS_ACCESS_KEY_ID=
SMS_ACCESS_KEY_SECRET=
SMS_SIGN_NAME=
SMS_TEMPLATE_CODE=

# 阿里云 SMTP（DirectMail）
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# 验证码存储后端（memory | redis，默认 memory）
OTP_STORE_BACKEND=memory
# Redis 配置（OTP_STORE_BACKEND=redis 时生效）
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## 接口文档

详细接口参数和返回值见 Swagger：`/api/docs`（Tags: 认证）
