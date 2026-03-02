# 管理端模块

## 模块职责

提供平台管理后台功能，当前包含用户管理，后续将扩展活动管理、社区管理等模块。

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

### 管理端控制器模式

管理端 API 采用"分布式管理控制器"模式：每个业务模块内新增 `admin-*.controller.ts`，而非集中到一个 AdminModule。

好处：
- 控制器与 Entity/Service 同目录，职责内聚
- 各团队成员可独立扩展，互不冲突
- 无需跨模块引用

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

frontend/src/views/admin/
├── AdminLayout.vue                      # 管理后台布局
├── components/
│   └── AdminSidebar.vue                 # 左侧导航栏
└── users/
    ├── AdminUserListView.vue            # 用户管理主页面
    └── components/
        ├── AdminUserSearchBar.vue       # 搜索栏 + 筛选器
        ├── AdminUserTable.vue           # 用户表格
        ├── AdminUserDetailSheet.vue     # 用户详情（右侧抽屉）
        ├── AdminUserEditDialog.vue      # 编辑用户弹窗
        └── AdminUserStatusDialog.vue    # 启用/禁用确认弹窗
```

## 自我保护机制

管理员不能：
- 禁用自己的账号
- 取消自己的 admin 角色
- 修改自己的任何管理信息

后端 `AdminUserService` 在 `update()` 和 `toggleStatus()` 中硬拦截 `targetId === operatorId`。

## 如何扩展新模块的管理端

以"活动管理"为例：

### Step 1: 后端

1. 在 `src/modules/event/` 内新建：
   - `admin-event.controller.ts` — 路由 `/admin/events`，类级别 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.ADMIN)`
   - `admin-event.service.ts` — 管理端查询/更新逻辑
   - `admin-event.dto.ts` — 管理端请求/响应 DTO

2. 在 `event.module.ts` 中注册新控制器和服务

### Step 2: 前端

1. 在 `frontend/src/views/admin/` 下新建 `events/` 目录
2. 创建 `AdminEventListView.vue` 及子组件
3. 在 `router/index.ts` 的 `/admin` children 中添加路由
4. 在 `AdminSidebar.vue` 的 `navItems` 中添加导航项
5. 在 `lib/admin-events.ts` 中封装 API 调用
6. 在 `types/index.ts` 中添加相关类型

## 管理员种子

首次部署时通过 SQL 创建管理员：

```sql
UPDATE users SET role = 'admin' WHERE phone = '你的手机号';
```

重新登录后即可访问 `/admin` 管理后台。
