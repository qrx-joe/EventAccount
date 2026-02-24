# 用户模块

## 模块职责

管理用户信息的增删改查，支持密码管理、微信账号关联，提供登录认证所需的数据访问层。

## 架构设计

- **Controller:** `src/modules/user/user.controller.ts` — HTTP 请求处理，JwtAuthGuard 鉴权保护
- **Service:** `src/modules/user/user.service.ts` — 用户业务逻辑（CRUD、密码、微信关联）
- **Entity:** `src/modules/user/user.entity.ts` — 用户数据库实体（`users` 表）
- **DTO:** `src/modules/user/user.dto.ts` — `CreateUserDto`、`UpdateUserDto`

## 核心功能

### 用户信息查询

- **当前用户信息:** `user.controller.ts:getMe()` — `GET /api/users/me`，通过 JWT 获取当前登录用户
- **公开资料:** `user.service.ts:getPublicProfile()` (第 87 行) — 仅返回 id/nickname/avatar/bio，无需登录
- **用户列表:** `user.service.ts:findAll()` (第 68 行) — 查询所有用户

### 用户创建与管理

- **普通创建:** `user.service.ts:create()` (第 30 行) — 密码可选（微信注册场景无密码），有密码时 bcrypt 12 轮加密
- **微信创建:** `user.service.ts:createFromWechat()` (第 129 行) — 从微信用户信息创建无密码用户，自动生成昵称
- **更新用户:** `user.service.ts:update()` (第 101 行) — 仅允许更新 nickname/email/avatar/bio，逐字段检查防止 undefined 覆盖
- **删除用户:** `user.service.ts:remove()` (第 112 行)

### 认证支持方法

- **手机号查询（含密码）:** `user.service.ts:findByPhoneWithPassword()` (第 163 行) — 登录校验用，`select: false` 字段需显式查询
- **ID 查询（含密码）:** `user.service.ts:findByIdWithPassword()` (第 172 行) — 密码重置用
- **微信 OpenID 查询:** `user.service.ts:findByWechatOpenId()` (第 119 行) — 微信登录回调用
- **关联微信:** `user.service.ts:linkWechat()` (第 150 行) — 将微信账号绑定到已有用户
- **更新密码:** `user.service.ts:updatePassword()` (第 181 行) — bcrypt 加密后更新

## 数据库设计

### users 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar (UUIDv7) | PK | 主键，@BeforeInsert 自动生成 |
| phone | varchar | UNIQUE, NOT NULL | 主登录凭证 |
| nickname | varchar | NULLABLE | 用户昵称，注册时可不填 |
| email | varchar | UNIQUE, NULLABLE | 辅助凭证 |
| avatar | varchar | NULLABLE | 头像 URL |
| bio | varchar | NULLABLE | 个性签名 |
| password | varchar | NULLABLE, SELECT:false | bcrypt 哈希，微信用户可为空 |
| wechatOpenId | varchar(64) | UNIQUE, NULLABLE, SELECT:false | 微信开放平台 OpenID |
| wechatUnionId | varchar(64) | UNIQUE, NULLABLE, SELECT:false | 微信 UnionID |
| createdAt | timestamp | 自动生成 | 创建时间 |
| updatedAt | timestamp | 自动更新 | 更新时间 |

**设计要点:**
- `password`、`wechatOpenId`、`wechatUnionId` 设置 `select: false`，默认查询不返回敏感字段
- `password` 为 nullable，支持微信注册用户无密码
- `email` 保留 UNIQUE 约束，PostgreSQL 允许多个 NULL 值共存于 UNIQUE 列

### 关联关系

| 关系 | 类型 | onDelete | 说明 |
|------|------|----------|------|
| agreement_signs.userId → users.id | ManyToOne | CASCADE | 用户删除时签署记录一并删除 |

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

详细接口参数和返回值见 Swagger 自动生成的 API 文档：启动后端后访问 `/api-docs`
