# 用户协议模块

## 模块职责

管理用户协议（用户条款、隐私政策等）的版本化内容和用户签署记录，启动时自动 seed 默认协议。

## 架构设计

- **Controller:** `src/modules/agreement/agreement.controller.ts` — 协议查询和签署接口
- **Service:** `src/modules/agreement/agreement.service.ts` — 协议管理业务逻辑
- **Entity:**
  - `src/modules/agreement/agreement.entity.ts` — 协议内容实体（`agreements` 表）
  - `src/modules/agreement/agreement-sign.entity.ts` — 签署记录实体（`agreement_signs` 表）
- **DTO:** `src/modules/agreement/agreement.dto.ts` — `SignAgreementDto`、`AgreementType`

## 核心功能

### 协议内容管理

- **获取最新版本:** `agreement.service.ts:getLatestByType()` (第 35 行) — 按类型查询最新生效的协议
- **自动 seed:** `agreement.service.ts:seedDefaults()` (第 97 行) — `OnModuleInit` 时检查并插入默认协议（用户条款 v1.0、隐私政策 v1.0）

### 协议签署

- **手动签署:** `agreement.service.ts:signAgreement()` (第 47 行) — 用户主动签署指定类型协议
- **注册自动签署:** `agreement.service.ts:autoSignOnRegister()` (第 73 行) — 注册成功后自动签署 `user-terms` 和 `privacy-policy`
- **查询签署记录:** `agreement.service.ts:getUserSigned()` (第 89 行)

## 数据库设计

### agreements 表（协议内容）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar (UUIDv7) | 主键 |
| type | varchar | 协议类型（user-terms / privacy-policy / payment-agreement） |
| title | varchar | 协议标题 |
| version | varchar | 语义化版本号 |
| content | text | 协议正文（Markdown 格式） |
| effectiveDate | date | 生效日期 |
| createdAt | timestamp | 创建时间 |

### agreement_signs 表（签署记录）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar (UUIDv7) | PK | 主键 |
| userId | varchar | FK → users, CASCADE | 用户 ID |
| agreementType | varchar | | 签署的协议类型 |
| version | varchar | | 签署时的协议版本 |
| signedAt | timestamp | CreateDateColumn | 签署时间 |

**约束:** `(userId, agreementType)` 唯一性约束，同一用户同一类型只保留最新签署记录（Upsert）

**索引:** `userId` 上有索引加速查询

## 设计要点

- **版本化管理:** 同一协议类型可存储多个版本，新版本创建新记录
- **签署记录 Upsert:** 同用户同类型只保留最新，避免重复记录
- **级联删除:** 用户删除时自动清理签署记录
- **payment-agreement 预留:** 协议类型枚举已定义但本阶段未实现，留给活动模块/支付模块

## 接口文档

详细接口参数和返回值见 Swagger 自动生成的 API 文档：启动后端后访问 `/api-docs`
