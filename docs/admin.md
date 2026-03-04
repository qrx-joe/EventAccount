# 管理端模块

## 模块职责

提供平台管理后台功能，覆盖 6 个管理域：用户管理、活动管理、社区管理、内容审核、标签管理、系统配置。

当前状态：
- **用户管理** — 后端已就绪，前端完整可用
- **活动 / 社区 / 审核 / 标签 / 系统** — 前端信息架构已搭建（路由、导航、占位页、API 预留），后端待各模块负责人开发

## 架构设计

### 角色系统

- **二元角色枚举**: `UserRole.USER` | `UserRole.ADMIN`，定义在 `user.entity.ts`
- **JWT 携带角色**: `JwtPayload = { sub: string; role: UserRole }`，登录时签入 token
- **角色守卫**: `RolesGuard` 从 `request.user.role` 读取，与 `@Roles()` 装饰器标记的要求比对
- **账号状态**: `isActive` 字段，禁用后所有登录方式返回 403

### 为何 role 放 JWT 而非每次查库

1. 避免循环依赖（AuthModule → UserModule → AuthModule）
2. 守卫零依赖、纯同步，无需注入 UserService
3. 角色变更极少，重新登录获取新 token 可接受

### 管理端控制器模式（后端）

管理端 API 采用"分布式管理控制器"模式：每个业务模块内新增 `admin-*.controller.ts`，而非集中到一个 AdminModule。

好处：
- 控制器与 Entity/Service 同目录，职责内聚
- 各团队成员可独立扩展，互不冲突
- 无需跨模块引用

### 前端 API 层 ENABLED 开关机制

每个尚未对接后端的管理域 API 文件导出 `ADMIN_*_ENABLED = false` 常量。页面根据此常量决定是否发起请求：

```typescript
// lib/admin-events.ts
export const ADMIN_EVENTS_ENABLED = false

// views/admin/events/AdminEventListView.vue
if (ADMIN_EVENTS_ENABLED) {
  watch(query, () => void fetchEvents(), { immediate: true, deep: true })
}
```

- `ENABLED = false` 时：页面展示"模块开发中"占位状态，不发送任何网络请求
- `ENABLED = true` 时：页面自动开始加载数据

**后端接口就绪后**，只需将对应 API 文件的 `ENABLED` 改为 `true` 即可接入。

### 前端独立信息架构

管理端采用独立布局，不复用普通用户的 `AppLayout`（TopNavBar）：

- `/admin` 路由设置 `meta: { layout: false }`，`App.vue` 检测到后跳过 `AppLayout` 包裹
- `AdminLayout.vue` 自带管理端专属顶栏（管理后台标识 + "返回前台"按钮 + 管理员头像菜单）
- 普通用户导航（活动、日历、发现、创建活动等）不会出现在管理端页面

### 文件结构

```
backend/src/modules/
├── auth/
│   ├── decorators/roles.decorator.ts    # @Roles() 装饰器
│   ├── guards/roles.guard.ts            # RolesGuard
│   └── guards/jwt-auth.guard.ts         # JwtAuthGuard
├── user/
│   ├── admin-user.controller.ts         # /admin/users 路由
│   ├── admin-user.service.ts            # 管理端查询/更新逻辑
│   ├── admin-user.dto.ts                # 管理端 DTO
│   └── ...
├── event/                               # 待开发
├── community/                           # 待开发
└── ...

frontend/src/
├── lib/
│   ├── admin-users.ts                   # ✅ 已对接后端
│   ├── admin-events.ts                  # ⏳ ENABLED=false
│   ├── admin-communities.ts             # ⏳ ENABLED=false
│   ├── admin-moderation.ts              # ⏳ ENABLED=false
│   ├── admin-tags.ts                    # ⏳ ENABLED=false
│   └── admin-system.ts                  # ⏳ ENABLED=false
├── types/
│   ├── index.ts                       # 公共类型 + 管理端类型重导出
│   └── admin.ts                       # 管理端 6 域类型定义
└── views/admin/
    ├── AdminLayout.vue                  # 管理后台独立布局（专属顶栏 + 侧边栏 + 内容区）
    ├── components/
    │   └── AdminSidebar.vue             # 6 项导航栏
    ├── users/                           # ✅ 完整实现
    │   ├── AdminUserListView.vue
    │   └── components/
    │       ├── AdminUserSearchBar.vue
    │       ├── AdminUserTable.vue
    │       ├── AdminUserDetailSheet.vue
    │       ├── AdminUserEditDialog.vue
    │       └── AdminUserStatusDialog.vue
    ├── events/                          # ⏳ 占位页
    │   └── AdminEventListView.vue
    ├── communities/                     # ⏳ 占位页
    │   └── AdminCommunityListView.vue
    ├── moderation/                      # ⏳ 占位页
    │   └── AdminModerationView.vue
    ├── tags/                            # ⏳ 占位页
    │   └── AdminTagListView.vue
    └── system/                          # ⏳ 占位页
        └── AdminSystemConfigView.vue
```

### 路由与导航

管理端路由挂载在 `/admin` 下，父级 `meta: { requiresAuth: true, requiresAdmin: true, layout: false }`：

| 路径 | 路由名 | 页面组件 |
|------|--------|----------|
| `/admin` | — | 重定向到 `/admin/users` |
| `/admin/users` | `admin-users` | `AdminUserListView.vue` |
| `/admin/events` | `admin-events` | `AdminEventListView.vue` |
| `/admin/communities` | `admin-communities` | `AdminCommunityListView.vue` |
| `/admin/moderation` | `admin-moderation` | `AdminModerationView.vue` |
| `/admin/tags` | `admin-tags` | `AdminTagListView.vue` |
| `/admin/system` | `admin-system` | `AdminSystemConfigView.vue` |

侧边栏导航在 `AdminSidebar.vue` 的 `navItems` 数组中定义，图标来自 lucide-vue-next。

### 前端管理端类型定义

| 管理域 | 类型 | 说明 |
|--------|------|------|
| 用户 | `AdminUser`, `AdminUserQuery`, `AdminUpdateUserPayload`, `AdminToggleStatusPayload` | 已对接 |
| 活动 | `EventStatus`, `AdminEvent`, `AdminEventQuery` | 待对接 |
| 社区 | `CommunityStatus`, `AdminCommunity`, `AdminCommunityQuery` | 待对接 |
| 审核 | `ModerationTargetType`, `ModerationStatus`, `AdminModerationRecord`, `AdminModerationQuery` | 待对接 |
| 标签 | `AdminTag`, `AdminTagQuery` | 待对接 |
| 系统配置 | `AdminSystemConfig`, `AdminSystemConfigQuery` | 待对接 |

所有管理端类型定义在 `frontend/src/types/admin.ts`，通过 `frontend/src/types/index.ts` 重导出，调用侧统一从 `@/types` 导入。

## 自我保护机制

管理员不能：
- 禁用自己的账号
- 取消自己的 admin 角色
- 修改自己的任何管理信息

后端 `AdminUserService` 在 `update()` 和 `toggleStatus()` 中硬拦截 `targetId === operatorId`。

## 后端待补齐清单

以下后端模块需各负责人开发。前端占位页和 API 预留已就绪，后端接口完成后将 `ENABLED` 改为 `true` 即可对接。

| 模块 | 后端路由前缀 | 需要的最小 API | 前端 ENABLED 开关 |
|------|-------------|---------------|-------------------|
| 活动管理 | `/admin/events` | `GET /admin/events`（分页列表） | `ADMIN_EVENTS_ENABLED` |
| 社区管理 | `/admin/communities` | `GET /admin/communities`（分页列表） | `ADMIN_COMMUNITIES_ENABLED` |
| 内容审核 | `/admin/moderation` | `GET /admin/moderation`（分页列表） | `ADMIN_MODERATION_ENABLED` |
| 标签管理 | `/admin/tags` | `GET /admin/tags`（分页列表） | `ADMIN_TAGS_ENABLED` |
| 系统配置 | `/admin/system` | `GET /admin/system`（分页列表） | `ADMIN_SYSTEM_ENABLED` |

后端接口统一返回 `ApiResponse<PaginatedResult<T>>`，响应体包含 `{ items: T[], total: number }`。

## 如何扩展新模块的管理端

### Step 1: 后端（各模块负责人）

1. 在 `src/modules/<模块>/` 内新建：
   - `admin-<模块>.controller.ts` — 类级别 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`
   - `admin-<模块>.service.ts` — 管理端查询/更新逻辑
   - `admin-<模块>.dto.ts` — 管理端请求/响应 DTO

2. 在 `<模块>.module.ts` 中注册新控制器和服务

### Step 2: 前端对接

前端路由、导航、占位页、API 文件、类型定义已全部就绪。后端接口完成后：

1. 将 `lib/admin-<模块>.ts` 中的 `ADMIN_*_ENABLED` 改为 `true`
2. 根据实际接口补充 CRUD 函数（参考 `admin-users.ts` 的 4 个函数）
3. 在占位页基础上实现真实的数据表格和操作 UI（参考 `users/` 目录的组件拆分）
4. 如需调整类型定义，修改 `types/admin.ts` 中对应接口（通过 `index.ts` 重导出，调用侧无需改路径）

## 管理员种子

首次部署时通过 SQL 创建管理员：

```sql
UPDATE users SET role = 'admin' WHERE phone = '你的手机号';
```

重新登录后即可访问 `/admin` 管理后台。
