# 管理后台模块 — 架构文档

## 模块职责

管理后台为平台管理员提供用户管理、活动审核、社区管理、内容审核、标签管理和系统配置能力。前端路由 `/admin/*`，后端路由 `/admin/*`，全部接口需 JWT + Admin 角色双重验证。

## 业务能力矩阵

| 能力 | 前端入口 | 后端端点 | 安全等级 |
|------|---------|---------|---------|
| 用户列表搜索 | `/admin/users` | `GET /admin/users` | JWT + Admin |
| 用户详情 | 用户列表→详情 Sheet | `GET /admin/users/:id` | JWT + Admin |
| 修改用户角色/昵称 | 用户列表→编辑弹窗 | `PUT /admin/users/:id` | JWT + Admin + 不可改自己 |
| 启用/禁用用户 | 用户列表→状态弹窗 | `PUT /admin/users/:id/status` | JWT + Admin + 不可改自己 |
| 活动列表 | `/admin/events` | （复用 events 接口） | JWT + Admin |
| 社区列表 | `/admin/communities` | （预留） | JWT + Admin |
| 内容审核 | `/admin/moderation` | （预留） | JWT + Admin |
| 标签管理 | `/admin/tags` | （预留） | JWT + Admin |
| 系统配置 | `/admin/system` | （预留） | JWT + Admin |

## 架构分层

```
┌────────────────────────────────────────────────────────┐
│  前端 (Vue 3)                                          │
│                                                        │
│  views/admin/                                          │
│  ├── AdminLayout.vue           ← 管理后台壳（侧边栏+头部）│
│  ├── AdminSidebar.vue          ← 侧边导航               │
│  └── users/                                            │
│      ├── AdminUserListView.vue ← 用户列表主视图          │
│      ├── AdminUserSearchBar    ← 搜索/筛选栏             │
│      ├── AdminUserTable        ← 分页表格                │
│      ├── AdminUserDetailSheet  ← 用户详情 Sheet           │
│      ├── AdminUserEditDialog   ← 编辑昵称/角色弹窗       │
│      └── AdminUserStatusDialog ← 启用/禁用弹窗           │
│                                                        │
│  lib/admin-users.ts            ← 管理员用户 API          │
│  lib/admin-events.ts           ← 管理员活动 API          │
│  lib/admin-communities.ts      ← 管理员社区 API          │
│  lib/admin-moderation.ts       ← 管理员审核 API          │
│  lib/admin-tags.ts             ← 管理员标签 API          │
│  lib/admin-system.ts           ← 管理员系统配置 API       │
│  types/admin.ts                ← Admin 专用类型定义       │
├────────────────────────────────────────────────────────┤
│  后端 (NestJS)                                         │
│                                                        │
│  modules/user/                                         │
│  ├── admin-user.controller     ← /admin/users 路由      │
│  │   @UseGuards(JwtAuthGuard, RolesGuard)              │
│  │   @Roles(UserRole.ADMIN)                            │
│  ├── admin-user.service        ← 管理员用户查询/修改     │
│  └── admin-user.dto            ← 管理员 DTO（含完整字段） │
└────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 用户搜索与管理

- **实现位置**: `admin-user.service.ts:findAll()`
- **设计说明**:
  - 支持关键词搜索（昵称/手机号/邮箱，ILIKE 不区分大小写）
  - 支持角色筛选（`user`/`admin`）和状态筛选（`isActive`）
  - LIKE 特殊字符转义（`%_\` → `\\$&`）防注入
  - 分页查询，返回 `PaginatedResult<AdminUserDto>`

### 2. 角色与状态变更

- **实现位置**: `admin-user.service.ts:update()`、`toggleStatus()`
- **设计说明**:
  - **自我保护**: 禁止管理员修改自己的角色或禁用自己的账号（`if (id === operatorId) throw ForbiddenException`）
  - 角色变更支持 `user` ↔ `admin` 互转
  - 状态变更通过 `isActive` 字段控制，被禁用的用户在 `AuthService.checkActive()` 中被拦截

### 3. 角色-路由守卫

- **实现位置**: `guards/roles.guard.ts` + `decorators/roles.decorator.ts`
- **设计说明**:
  - `@Roles(UserRole.ADMIN)` 装饰器标记所需角色
  - `RolesGuard` 通过 Reflector 读取元数据，与 JWT payload 中的 `role` 比对
  - 未标记 `@Roles()` 的接口不做角色检查

### 4. 前端管理后台布局

- **实现位置**: `AdminLayout.vue` + `AdminSidebar.vue`
- **设计说明**:
  - 独立布局壳，不使用 `AppLayout`
  - 头部包含"返回前台"链接和用户下拉菜单
  - 侧边栏导航：用户管理、活动管理、社区、审核、标签、系统配置
  - 路由 meta `requiresAdmin` 在路由守卫中检查 `authStore.isAdmin`

## 设计决策记录

### 为什么 Admin 控制器放在 User 模块内？

`AdminUserController` 操作的是 `users` 表，与 `UserEntity` 紧密耦合。放在 User 模块内可以直接使用 `TypeOrmModule.forFeature([UserEntity])`，无需跨模块导入。当其他资源的管理功能增加时（如活动审核），对应的 Admin Controller 应放在各自的模块内。

### 为什么管理员不能修改自己？

防止管理员误操作导致自己无法登录（如降低自己的角色或禁用自己的账号）。这是一个常见的管理后台安全实践。

## 安全设计

| 安全措施 | 实现位置 | 说明 |
|---------|---------|------|
| JWT + Admin 角色双重验证 | Controller 类级别 `@UseGuards` | 所有管理接口 |
| 自我修改保护 | Service 层 `operatorId !== id` 检查 | 禁止修改自身角色/状态 |
| ILIKE 转义 | `admin-user.service.ts:escapeLike()` | 防通配符注入 |
| 前端路由守卫 | `router/index.ts` `requiresAdmin` meta | 非管理员重定向 |

## 接口文档

详细接口参数、请求体、响应体见 Swagger：`/api/docs`

- Tag `管理员-用户`：用户列表、详情、修改、状态切换
