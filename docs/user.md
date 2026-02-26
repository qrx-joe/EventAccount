# 用户模块

## 模块职责

负责用户信息的增删改查，提供用户数据访问层供其他模块（特别是 Auth 模块）使用。

## 架构设计

### 后端

| 文件 | 职责 |
|------|------|
| `src/modules/user/user.controller.ts` | 用户路由（需登录，更新/删除限本人） |
| `src/modules/user/user.service.ts` | 用户业务逻辑，通过 Repository 操作数据库 |
| `src/modules/user/user.entity.ts` | TypeORM 实体定义 |
| `src/modules/user/user.dto.ts` | 请求体 DTO |
| `src/modules/user/user.module.ts` | 模块声明，导出 UserService 供 AuthModule 使用 |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/views/users/UserListView.vue` | 用户列表页（含编辑弹窗，可绑定邮箱） |
| `frontend/src/lib/users.ts` | 用户管理 API 封装 |
| `frontend/src/types/index.ts` | User 接口、UpdateUserPayload 类型定义 |

## 数据库设计

### users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) PK | UUIDv7，`@BeforeInsert` 自动生成 |
| phone | varchar(20) UNIQUE NOT NULL | 手机号（主凭证） |
| nickname | varchar(64) | 昵称，注册时未传则自动生成"用户XXXX" |
| email | varchar(128) UNIQUE | 邮箱，注册后通过编辑绑定 |
| avatar | varchar(512) | 头像 URL |
| bio | varchar(200) | 个性签名 |
| password | varchar(128) | bcrypt 哈希，`select: false` 默认不返回 |
| createdAt | timestamp | 创建时间 |
| updatedAt | timestamp | 更新时间 |

### 设计决策

- **手机号为主凭证**: `phone` 是 NOT NULL + UNIQUE，注册必须提供
- **邮箱为可选绑定**: `email` 是 UNIQUE + NULLABLE，注册后通过 `PUT /users/:id` 绑定
- **密码默认隐藏**: Entity 使用 `select: false`，需要密码的查询方法使用 QueryBuilder 显式 `addSelect`

## 核心功能

### 1. 用户创建

- **入口**: 仅通过 `POST /auth/register` 注册创建，UserController 不提供 create 端点
- **实现**: `user.service.ts:create()` — 检查手机号/邮箱唯一性 → 自动生成昵称 → bcrypt 哈希密码 → 保存

### 2. 用户查询

| 方法 | 场景 |
|------|------|
| `findOne(id)` | 按 ID 查询，不含密码 |
| `findByPhone(phone)` | 按手机号查询，不含密码，供短信登录使用 |
| `findByEmail(email)` | 按邮箱查询，不含密码，供邮箱登录使用 |
| `findByPhoneWithPassword(phone)` | 含密码字段，仅供密码登录校验 |
| `findByIdWithPassword(id)` | 含密码字段，仅供重置密码校验 |
| `getPublicProfile(id)` | 公开接口，仅返回 id/nickname/avatar/bio |

### 3. 用户更新

- **权限控制**: Controller 层校验 `req.user.sub === id`，仅允许更新本人信息
- **逐字段赋值**: 避免 `undefined` 覆盖已有值
- **邮箱绑定**: 通过 `PUT /users/:id` 的 `email` 字段完成，前端在 UserListView 编辑弹窗中提供输入

### 4. 用户删除

- 硬删除，仅限本人操作

## 路由设计

静态路由 `/users/me` 声明在动态路由 `/users/:id` 之前，避免 Express 将 "me" 作为 `:id` 参数匹配。

| 方法 | 路由 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/users/me` | JWT | 获取当前用户信息 |
| GET | `/users/:id/profile` | 无 | 获取用户公开信息 |
| GET | `/users` | JWT | 查询所有用户 |
| GET | `/users/:id` | JWT | 查询单个用户 |
| PUT | `/users/:id` | JWT + 本人 | 更新用户（含邮箱绑定） |
| DELETE | `/users/:id` | JWT + 本人 | 删除用户 |

## 接口文档

详细接口参数和返回值见 Swagger：`/api/docs`（Tags: 用户）
