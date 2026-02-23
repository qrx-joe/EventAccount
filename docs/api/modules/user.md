# 用户模块

## 模块职责

负责平台用户认证（注册、登录、微信授权）、协议签署管理、密码重置，是所有业务模块的鉴权基础。

## 架构设计

### 认证子模块（auth）

- **Controller:** `src/modules/auth/auth.controller.ts` - 注册、登录、密码重置路由
- **Service:** `src/modules/auth/auth.service.ts` - 认证业务逻辑、JWT 签发
- **DTO:** `src/modules/auth/auth.dto.ts` - 请求参数校验
- **Guard:** `src/modules/auth/guards/jwt-auth.guard.ts` - JWT 鉴权守卫（供所有模块使用）
- **Strategy:** `src/modules/auth/strategies/jwt.strategy.ts` - Passport JWT 策略

### 用户子模块（user）

- **Controller:** `src/modules/user/user.controller.ts` - 用户信息查询与管理
- **Service:** `src/modules/user/user.service.ts` - 用户 CRUD 业务逻辑
- **Entity:** `src/modules/user/user.entity.ts` - 用户实体定义
- **DTO:** `src/modules/user/user.dto.ts` - 数据传输对象

### 协议子模块（agreement）

- **Controller:** `src/modules/agreement/agreement.controller.ts` - 协议查询与签署
- **Service:** `src/modules/agreement/agreement.service.ts` - 协议版本管理、签署记录
- **Entity:** `src/modules/agreement/agreement.entity.ts` - 协议实体
- **Entity:** `src/modules/agreement/agreement-sign.entity.ts` - 签署记录实体

### 验证码子模块（verification）

- **Controller:** `src/modules/verification/verification.controller.ts` - 验证码发送路由（POST /api/auth/sms/send、POST /api/auth/email/send）
- **Service:** `src/modules/verification/verification.service.ts` - 验证码生成、缓存、校验 + 阿里云短信 SDK 发送
- **Service:** `src/modules/verification/email-sender.service.ts` - 邮件验证码发送（Stage 4 新增）
- **DTO:** `src/modules/verification/verification.dto.ts` - phone/email + type 参数校验
- **Module:** `src/modules/verification/verification.module.ts` - 模块注册
- **Config:** `src/config/sms.config.ts` - 短信服务配置（AccessKey、签名、模板 ID、endpoint）

## 核心功能

### 用户注册（手机号 + 短信验证码）

- **设计说明:** 手机号为唯一登录凭证，注册时通过短信验证码验证手机号真实性，密码通过 bcrypt 加密存储。注册成功自动签署用户条款和隐私政策。
- **关键依赖:** 阿里云短信服务 `@alicloud/dysmsapi20170525`（验证码发送）

### 用户登录（双通道）

- **短信验证码登录:** 发送验证码 → 校验验证码 → 签发 JWT
- **密码登录:** 手机号 + 密码 → bcrypt 验证 → 签发 JWT
- **设计说明:** JWT 有效期 7 天，Payload 包含 `sub`（用户ID）、`phone`、`nickname`

### 微信授权登录

- **设计说明:** OAuth 2.0 授权码模式，用户扫码/点击授权后获取微信用户信息，绑定或创建平台账号，签发 JWT
- **关键依赖:** 微信开放平台 API

### 协议签署

- **协议类型:** `user-terms`（用户条款）、`privacy-policy`（隐私政策）、`payment-agreement`（缴费协议）
- **设计说明:** 协议内容支持版本管理，签署记录关联用户ID和协议版本。注册时自动签署前两项，缴费协议在支付前签署。

### 密码重置（手机号 / 邮箱双通道）

- **设计说明:** 两步验证流程——先通过手机号或邮箱发送验证码并校验身份，校验通过后签发临时 resetToken（10 分钟有效），再用 resetToken 设置新密码。
- **手机号通道:** 复用短信验证码服务
- **邮箱通道:** 发送验证码到用户绑定邮箱

## 数据库设计

### 表结构概览

- **主表:** `users` - 用户基本信息
- **关联表:** `agreements` - 协议内容与版本
- **关联表:** `agreement_signs` - 用户签署记录（user_id → users.id）
- **ID 策略:** 所有主键使用 UUIDv7（`varchar(36)`），通过 `src/shared/utils/id-generator.ts` 生成，不使用 PostgreSQL 内置函数

### users 表字段设计

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar(36) | PK | UUIDv7，@BeforeInsert 自动生成 |
| phone | varchar(20) | NOT NULL, UNIQUE | 主登录凭证，预留国际号码空间 |
| nickname | varchar(64) | NULLABLE | 昵称，注册时可不填，自动生成默认值 |
| avatar | varchar(512) | NULLABLE | 头像 URL，URL 可能较长 |
| bio | varchar(200) | NULLABLE | 个性签名 |
| email | varchar(128) | NULLABLE, UNIQUE | 辅助凭证，注册时非必填，报名时可补填 |
| password | varchar(128) | NOT NULL, select: false | bcrypt 哈希，默认查询不返回 |
| wechatOpenId | varchar(64) | NULLABLE, UNIQUE | 微信 OpenID（Stage 5 新增） |
| wechatUnionId | varchar(64) | NULLABLE, UNIQUE | 微信 UnionID（Stage 5 新增） |
| createdAt | timestamp | NOT NULL, DEFAULT now() | @CreateDateColumn |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | @UpdateDateColumn |

**设计决策：**
- `phone` 用 `varchar(20)` 而非 `varchar(11)`：国内手机号 11 位，但预留 `+86` 等国际区号空间
- `avatar` 用 `varchar(512)` 而非 `text`：URL 有实际上限，`varchar` 比 `text` 更利于校验
- `email` 保留 UNIQUE 约束：虽然 nullable，PostgreSQL 允许多个 NULL 值共存于 UNIQUE 列，不会冲突
- `password` 设置 `select: false`：防止查询时意外返回密码哈希，需要时通过 `addSelect` 显式获取

### agreements 表字段设计

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar(36) | PK | UUIDv7 |
| type | varchar(32) | NOT NULL | 协议类型：user-terms / privacy-policy / payment-agreement |
| title | varchar(128) | NOT NULL | 协议标题 |
| version | varchar(16) | NOT NULL | 版本号，如 "1.0.0" |
| content | text | NOT NULL | 协议正文，使用 text 类型支持长内容 |
| effectiveDate | timestamp | NOT NULL | 生效日期 |
| createdAt | timestamp | NOT NULL, DEFAULT now() | @CreateDateColumn |

**设计决策：**
- `content` 用 `text` 而非 `varchar`：协议正文可能很长，text 无长度限制
- `type` + `version` 组合标识一份协议的特定版本

### agreement_signs 表字段设计

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar(36) | PK | UUIDv7 |
| userId | varchar(36) | NOT NULL, FK → users.id | 签署用户 |
| agreementType | varchar(32) | NOT NULL | 协议类型 |
| version | varchar(16) | NOT NULL | 签署的协议版本 |
| signedAt | timestamp | NOT NULL, DEFAULT now() | 签署时间 |

### 索引策略

| 表 | 字段 | 索引类型 | 说明 |
|-----|------|----------|------|
| users | phone | UNIQUE（隐式索引） | 登录、注册查询主键 |
| users | email | UNIQUE（隐式索引） | 密码重置查询，nullable 不影响 UNIQUE |
| users | wechatOpenId | UNIQUE（隐式索引） | 微信登录查询 |
| agreement_signs | userId | INDEX | 查询用户签署记录，外键字段必须加索引 |
| agreement_signs | [userId, agreementType] | UNIQUE 复合索引 | 同一用户同一类型协议只签署一次（最新版本覆盖） |

**设计决策：**
- UNIQUE 约束自动创建 B-tree 索引，无需额外 `@Index()` 装饰器
- `agreement_signs.userId` 作为外键必须显式加索引（TypeORM 不自动创建）
- 不做过度索引：`nickname`、`bio`、`avatar` 不是查询条件，无需索引

### 关系与级联行为

| 关系 | 类型 | onDelete | 说明 |
|------|------|----------|------|
| agreement_signs.userId → users.id | ManyToOne | CASCADE | 用户删除时，签署记录一并删除 |

**设计决策：**
- 签署记录没有独立于用户的业务价值，用户删除时级联删除是合理的
- agreements 表不关联外键到 users，协议内容是全局共享的

### TypeORM 配置策略

| 环境 | synchronize | migrationsRun | 说明 |
|------|-------------|---------------|------|
| 本地开发 | true | false | 修改 Entity 重启即同步，快速迭代 |
| 服务器（测试/生产） | false | true | 通过 Migration 管理，安全可控 |

当前 `app.module.ts` 已配置 `synchronize: config.get('NODE_ENV') !== 'production'`。服务器部署前需补充 `migrationsRun` 和 `migrations` 路径配置。

## 其他模块如何使用

### 鉴权

其他模块通过 `JwtAuthGuard` 进行鉴权，从 `req.user.sub` 获取当前用户 ID：

```typescript
@UseGuards(JwtAuthGuard)
@Get('my-events')
async getMyEvents(@Req() req: Request) {
  const userId = req.user.sub;
}
```

### 用户公开信息

通过 `GET /api/users/:id/profile` 获取用户昵称、头像等公开信息，供活动、社区等模块展示。

## 接口文档

详细接口参数和返回值见 Swagger 自动文档：启动后端后访问 `/api/docs`

接口契约（供其他模块开发者快速对接）见：`docs/api/modules/user-api-contract.md`
