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
| `src/config/sms.config.ts` | 阿里云 SMS 配置（registerAs） |
| `src/config/email.config.ts` | SMTP 邮件配置（registerAs） |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/composables/useSmsCountdown.ts` | 短信验证码发送 + 60s 倒计时 |
| `frontend/src/composables/useEmailCountdown.ts` | 邮箱验证码发送 + 60s 倒计时 |
| `frontend/src/lib/auth.ts` | `sendSmsCode()` / `sendEmailCode()` API 封装 |

## 核心功能

### 1. 验证码生成与存储

- **生成**: `crypto.randomInt(100000, 1000000)` 安全随机 6 位数字
- **存储**: 内存 Map，key 格式 `target:type`（target 为手机号或邮箱，type 为 register/login/reset）
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

- `OnModuleInit` 启动 10 分钟间隔定时器，清理过期的验证码和频率限制条目
- `OnModuleDestroy` 清除定时器，防内存泄漏

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
```

## 接口文档

详细接口参数和返回值见 Swagger：`/api-docs`（Tags: 认证）
