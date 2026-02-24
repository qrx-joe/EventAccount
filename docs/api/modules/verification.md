# 短信验证码模块

## 模块职责

生成、发送（阿里云 SMS / Mock）、校验短信验证码，支持注册、登录、密码重置、微信绑定手机号等场景。

## 架构设计

- **Controller:** `src/modules/verification/verification.controller.ts` — 短信发送接口
- **Service:** `src/modules/verification/verification.service.ts` — 验证码生成、存储、校验、清理
- **DTO:** `src/modules/verification/verification.dto.ts` — `SendSmsCodeDto`、`VerificationCodeType` 枚举

## 核心功能

### 验证码发送

- **实现位置:** `verification.service.ts:sendSmsCode()` (第 145 行)
- **设计说明:** 生成 6 位随机数字（`crypto.randomInt()` 安全随机），存储到内存 Map，通过阿里云 SMS SDK 或 Mock 发送
- **频率限制:** 同一手机号同一类型 60 秒内最多发送 1 次（服务层校验）+ 接口级 `@Throttle 60s/5次`

### 验证码校验

- **实现位置:** `verification.service.ts:verifyCode()`
- **设计说明:** 使用 `timingSafeEqual` 常量时间比较，防止时序攻击
- **暴力破解防护:** 连续错误 5 次后自动删除验证码
- **一次性使用:** 校验成功后立即删除

### 过期清理

- **实现位置:** `verification.service.ts:cleanupExpiredEntries()`
- **设计说明:** `OnModuleInit` 启动 10 分钟周期定时器，清理 5 分钟前过期的条目

## 验证码类型

```typescript
enum VerificationCodeType {
  REGISTER = 'register',       // 注册
  LOGIN = 'login',             // 短信登录
  RESET = 'reset',             // 密码重置
  BIND_PHONE = 'bindphone',   // 微信绑定手机号
}
```

## 存储设计

- **存储方式:** 内存 Map（key = `phone:type`，value = `{ code, attempts, createdAt }`）
- **过期时间:** 5 分钟
- **清理周期:** 10 分钟
- **适用场景:** 单实例部署。多实例部署需替换为 Redis

## Mock 模式

- SMS 配置缺失时自动进入 Mock 模式
- 验证码打印到控制台日志：`[SMS Mock] 手机号: xxx, 验证码: yyy, 类型: zzz`
- 验证码正常存储和校验，仅发送通道为 Mock

## 接口文档

详细接口参数和返回值见 Swagger 自动生成的 API 文档：启动后端后访问 `/api-docs`
