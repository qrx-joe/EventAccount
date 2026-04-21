# 个人中心模块 — 架构文档

## 模块定位

个人中心是用户登录后的自管理入口，承载 **个人资料编辑** 和 **账号安全管理** 两大职责。前端路由 `/settings/*`，后端路由 `/users/me/*` + `/users/:id`。

本模块与 Auth 模块（认证/注册/登录）共享 `users` 表，但职责边界清晰：Auth 负责"进门"，个人中心负责"装修"。

## 业务能力矩阵

| 能力 | 前端入口 | 后端端点 | 安全等级 |
|------|---------|---------|---------|
| 查看个人信息 | `/settings/profile` | `GET /users/me` | JWT |
| 编辑资料（昵称/头像/签名） | `/settings/profile` | `PUT /users/:id` | JWT + 本人校验 + UUID 校验 |
| 修改密码 | `/settings/security` | `PUT /users/me/password` | JWT + 旧密码验证 + 限流 5次/分 |
| 换绑手机号 | `/settings/security` | `PUT /users/me/phone` | JWT + 短信验证码 + 限流 5次/分 |
| 绑定/换绑邮箱 | `/settings/security` | `PUT /users/me/email` | JWT + 邮箱验证码 + 限流 5次/分 |
| 注销账号 | `/settings/security` | `DELETE /users/:id` | JWT + 本人校验 + UUID 校验 + 前端二次确认 |
| 外观主题切换 | `/settings/appearance` | —（纯前端） | 无（localStorage 存储） |
| 查看他人公开资料 | — | `GET /users/:id/profile` | 无（UUID 校验） |

## 架构分层

```
┌─────────────────────────────────────────────────────────┐
│  前端 (Vue 3 + Composition API)                         │
│                                                         │
│  views/settings/                                        │
│  ├── SettingsLayout.vue        ← 布局壳：左导航 + 右内容 │
│  └── components/                                        │
│      ├── ProfileSection.vue    ← 个人资料编辑表单        │
│      ├── SecuritySection.vue   ← 账号安全总览            │
│      ├── ChangePasswordDialog  ← 修改密码弹窗            │
│      ├── ChangePhoneDialog     ← 换绑手机弹窗            │
│      ├── ChangeEmailDialog     ← 换绑邮箱弹窗            │
│      ├── DeleteAccountDialog   ← 注销账号弹窗            │
│      └── AppearanceSection     ← 外观主题切换（纯前端）   │
│                                                         │
│  lib/users.ts                  ← API 调用层              │
│  lib/upload.ts                 ← 上传 API 调用层          │
│  lib/validators.ts             ← 校验正则常量              │
│  composables/useTheme.ts       ← 主题管理（懒初始化单例）   │
│  composables/useCountdown.ts   ← 通用验证码倒计时          │
│  composables/useSmsCountdown   ← 短信验证码倒计时（薄包装） │
│  composables/useEmailCountdown ← 邮箱验证码倒计时（薄包装） │
│  stores/auth.ts                ← 用户状态（Pinia）       │
├─────────────────────────────────────────────────────────┤
│  HTTP (Axios + Cookie JWT)                              │
├─────────────────────────────────────────────────────────┤
│  后端 (NestJS)                                          │
│                                                         │
│  modules/user/                                          │
│  ├── user-account.controller   ← /users/me/* 路由       │
│  │   @UseGuards(JwtAuthGuard, ThrottlerGuard)           │
│  ├── user.controller           ← /users/:id 路由        │
│  │   @Param('id', ParseUUIDPipe)                        │
│  ├── user-security.service     ← 安全变更业务逻辑（事务化）│
│  ├── user.service              ← 基础 CRUD 业务逻辑     │
│  │   create() 含唯一约束异常兜底                         │
│  ├── user.entity               ← TypeORM 实体           │
│  ├── user.dto                  ← 基础 DTO               │
│  └── user-security.dto         ← 安全变更 DTO（@Match）  │
│                                                         │
│  modules/upload/                                        │
│  ├── upload.controller          ← /upload 路由           │
│  └── upload.service             ← OSS 上传（魔数校验）    │
│                                                         │
│  common/constants/postgres.ts  ← PG 错误码常量           │
│  common/decorators/match.decorator.ts ← @Match 校验装饰器│
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (users 表)                                   │
└─────────────────────────────────────────────────────────┘
```

## 关键数据流

### 1. 个人资料编辑

```
ProfileSection.vue
  │  onMounted: auth.user ?? auth.fetchUser() → 填充表单
  │
  │  用户修改字段 → zod 实时校验
  │  头像 URL → 防抖 600ms → 协议校验(https://) → <img> 预览
  │
  ▼  提交
lib/users.ts:updateUser(userId, payload)
  │  PUT /users/{userId}
  ▼
UserController.update()
  │  ParseUUIDPipe → JWT 守卫 → 本人校验
  │  → UserService.update(): 逐字段赋值 → save()
  ▼
响应 UserSelfDto
  │
  ▼  前端
auth.fetchUser() → 更新 Pinia store → Toast 成功
```

### 2. 换绑手机号（安全变更的典型流程）

```
ChangePhoneDialog.vue
  │
  │  ① 用户输入新手机号
  │  ② 点击"获取验证码"
  ▼
useSmsCountdown.handleSendSms(newPhone)
  │  POST /auth/sms/send { phone, type: 'bind-phone' }
  │  → 开始 60s 倒计时
  │
  │  ③ 用户输入验证码，提交
  ▼
lib/users.ts:changePhone({ newPhone, smsCode })
  │  PUT /users/me/phone
  ▼
UserAccountController.changePhone()
  │  JwtAuthGuard → ThrottlerGuard(5次/分) → 路由处理
  ▼
UserSecurityService.changePhone(userId, newPhone, smsCode)
  │
  │  Step 1: 验证短信验证码（消耗验证码，Redis 操作）
  │    → VerificationService.verifyCode(newPhone, smsCode, 'bind-phone')
  │    → 验证失败抛 BadRequestException
  │
  │  Step 2: 事务内执行冲突检查 + 写入（消除 TOCTOU 竞态）
  │    → dataSource.transaction(async (manager) => {
  │        manager.findOne(UserEntity, { phone: newPhone })
  │        → 已占用则抛 ConflictException
  │        manager.update(UserEntity, userId, { phone: newPhone })
  │      })
  │    → catch PG 23505 → ConflictException（兜底）
  │
  ▼
响应 UserSelfDto → 前端 fetchUser() → 更新 store → Toast
```

### 3. 注销账号

```
DeleteAccountDialog.vue
  │  用户输入"删除账号"确认文本 → Button 启用
  ▼  点击确认
handleDelete()
  │  deleteUser(userId) → DELETE /users/{userId}
  │  成功 → open.value = false（关闭弹窗）
  │  → auth.logout() → router.push('/login') → Toast
  │
  │  失败 → Toast 错误（弹窗保持打开，用户可重试）
```

### 4. 外观主题切换（纯前端）

```
composables/useTheme.ts
  │  导出 Theme 类型: 'light' | 'dark' | 'system'
  │  导出 useTheme(): { current, setTheme }
  │  导出 initThemeSync(): 启动时同步主题（FOUC 防护）
  │
  │  内部：
  │  - getMediaQuery(): 懒初始化 matchMedia 单例（兼容 SSR/测试）
  │  - applyTheme(): 根据当前主题 + matchMedia 结果切换 dark class
  │  - onMounted: 注册 mediaQuery.addEventListener('change', ...)
  │  - onUnmounted: 移除监听器
  │
AppearanceSection.vue
  │  const { current, setTheme } = useTheme()
  │
  │  用户点击 亮色/暗色/跟随系统
  ▼
setTheme(theme)
  │  localStorage.setItem('theme', theme)
  │  applyTheme(): 操作 document.documentElement.classList 切换 dark
  │
  │  跟随系统模式：实时监听 matchMedia change 事件并响应
```

**启动初始化（FOUC 防护）**：`main.ts` 在 `app.mount()` 前调用 `initThemeSync()` 同步读取 `localStorage('theme')` 并应用 dark 类，避免首屏闪烁。

## 设计决策记录

### 为什么分两个 Controller？

| | UserController | UserAccountController |
|---|---|---|
| **路由前缀** | `/users` + `/:id` | `/users/me` |
| **身份来源** | URL 参数 `:id`（ParseUUIDPipe 校验），需本人校验 | JWT payload `req.user.sub`，天然安全 |
| **适用场景** | 通用 CRUD、公开资料查询 | 当前用户的安全敏感操作 |
| **限流** | 全局默认 60次/分 | 方法级 5次/分（ThrottlerGuard 类级别生效） |

路由注册顺序：`UserAccountController` 必须在 `UserController` 之前，否则 "me" 会被 `:id` 捕获。

### 为什么安全服务独立？

`UserSecurityService` 与 `UserService` 分离，原因：
- **单一职责**：基础 CRUD 和安全变更的关注点不同
- **依赖差异**：安全服务依赖 `VerificationService`（验证码），基础服务不需要
- **测试隔离**：安全变更的测试场景（验证码 mock、竞态测试）不应影响基础 CRUD 测试

### 密码安全

- Entity 层 `password` 字段设置 `select: false`，常规查询默认不返回
- 需要密码的场景通过 `findByPhoneWithPassword` / `findByIdWithPassword` 显式获取
- `toSelfDto()` 显式字段映射形成双重保险

### 并发安全

- `UserService.create()` 的 `save()` 包裹 try/catch，捕获 PG 23505 唯一约束异常转为 409
- `UserSecurityService` 的换绑操作采用事务化流程：验证码消耗（Redis） → 事务内冲突检查 + DB 写入
- 事务确保冲突检查与写入在同一 DB 连接内原子执行，消除 TOCTOU 竞态窗口
- 数据库 UNIQUE 约束作为最终安全网（`handleUniqueViolation` 捕获 PG 23505）
- PG 23505 错误码常量统一定义在 `common/constants/postgres.ts`，两个 Service 共用

### 前端注销弹窗

- 使用 `Button`（非 `AlertDialogAction`）控制弹窗关闭时机
- API 成功后才关闭弹窗，失败时保持打开供用户重试
- `loading` 期间禁用取消按钮，防止中途关闭

### 主题初始化时序

- `composables/useTheme.ts` 统一管理主题逻辑，导出 `initThemeSync()`（启动用）和 `useTheme()`（组件用）
- `getMediaQuery()` 懒初始化 `window.matchMedia` 单例，避免模块顶层访问 `window`（兼容 SSR/测试环境）
- `main.ts` 在 `app.mount()` 前调用 `initThemeSync()` 同步执行主题初始化，操作 `document.documentElement.classList`
- `AppearanceSection.vue` 通过 `useTheme()` composable 获取当前主题和切换方法
- `system` 模式下，`useTheme` 注册 `matchMedia('(prefers-color-scheme: dark)')` 的 `change` 监听，操作系统切换深浅色时实时响应
- 偏好存 `localStorage('theme')`，三档：`light` / `dark` / `system`

## 安全设计

| 安全措施 | 实现位置 | 说明 |
|---------|---------|------|
| JWT 认证 | `JwtAuthGuard` 类级别 | 所有个人中心接口需登录 |
| 本人校验 | Controller 层 `req.user.sub === id` | 防止越权操作 |
| UUID 格式校验 | `ParseUUIDPipe` | 拒绝非法 `:id` 参数，避免无意义数据库查询 |
| 密码哈希 | bcrypt 12 轮 | Entity `select: false` 双重保护 |
| 操作限流 | `ThrottlerGuard` + `@Throttle` 5次/分 | 密码修改、换绑操作 |
| 验证码消耗 | `VerificationService.verifyCode()` | 一次性消耗，10 分钟过期 |
| 唯一约束兜底 | `handleUniqueViolation()` / try-catch PG 23505 | 防止并发竞态 |
| DTO 字段匹配校验 | `@Match('newPassword')` 自定义装饰器 | confirmPassword 在 DTO 层完成校验，Controller 保持薄转发 |
| 上传文件魔数校验 | `upload.service.ts` IMAGE_SIGNATURES | 基于文件内容（magic bytes）检测真实类型，不信任客户端 mimetype/文件名 |
| 前端二次确认 | `DeleteAccountDialog` 输入确认文本 | 注销需手动输入"删除账号" |
| 头像 URL 协议校验 | 前端 `onAvatarInput` + 后端 `@IsUrl` | 前端正则 `/^https?:\/\//i` 过滤非 HTTP 协议；后端 `@IsUrl({ require_protocol: true, protocols: ['http', 'https'] })` + `@Length(1, 512)` |
| 手机号脱敏 | `SecuritySection.maskPhone()` | 中间四位替换为 `****` |
| 邮箱脱敏 | `SecuritySection.maskEmail()` | 首字符 + `***` + `@` 域名部分 |

## 模块依赖关系

```
UserModule
  ├── 导入 TypeOrmModule.forFeature([UserEntity])
  ├── 导入 VerificationModule（验证码服务）
  ├── 导出 UserService → 供 AuthModule 使用
  │
  └── 内部依赖：
      UserAccountController → UserService, UserSecurityService
      UserController → UserService
      UserSecurityService → UserService, VerificationService, DataSource
```

## 数据库设计

### users 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | varchar(36) | PK | UUIDv7，`@BeforeInsert` 自动生成 |
| phone | varchar(20) | UNIQUE NOT NULL | 手机号（主凭证） |
| nickname | varchar(64) | NULLABLE | 昵称，注册时未传则自动生成"用户XXXX" |
| email | varchar(128) | UNIQUE NULLABLE | 邮箱，通过换绑流程绑定 |
| avatar | varchar(512) | NULLABLE | 头像 URL |
| bio | varchar(200) | NULLABLE | 个性签名 |
| password | varchar(128) | NULLABLE, select:false | bcrypt 哈希 |
| createdAt | timestamp | | 创建时间 |
| updatedAt | timestamp | | 更新时间 |

## 接口文档

详细接口参数、请求体、响应体见 Swagger：`/api/docs`

- Tag `用户`：基础 CRUD 接口
- Tag `用户-账号`：当前用户安全操作接口

## 测试覆盖

| 测试文件 | 覆盖范围 |
|---------|---------|
| `test/user-guard-throttle.e2e-spec.ts` | UUID 格式校验（6 个用例）、限流验证（2 个用例） |
| `test/user-security.e2e-spec.ts` | 密码修改、手机换绑、邮箱换绑冲突 |
| `test/auth-user.e2e-spec.ts` | 注册流程、权限隔离、密码重置 |
