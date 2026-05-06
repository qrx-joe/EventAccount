# account-settings 分支前后端复审报告

审查时间：2026-03-01（初审） / 2026-03-01（全量复审）
审查分支：`feature/account-settings`（frontend + backend）

## 审查范围

- 前端（33 文件变更）：个人中心设置页、4 个安全弹窗、`ProfileSection`、`AppHeader`、`AppearanceSection`、主题初始化、路由、类型、用户列表
- 后端（35 文件变更）：`UserAccountController`、`UserSecurityService`、`UserController`、`UserService`、`AuthController`、`VerificationService` 及相关 e2e

## 结论

- 整体架构方向正确，模块职责划分清晰，安全基础设施（限流、唯一约束兜底、时序攻击防护）到位。
- 原阻塞问题（前端构建失败）**已修复**，Lint 问题**已修复**。
- 全量审查后发现 6 个严重问题、16 个一般问题、12 个优化建议。
- 本轮已修复 **S3~S6 + M1/M2/M4/M5/M7/M10/M11 + O6**（共 15 项），Lint/Build 全量通过。
- 剩余未修复：**S1**（JWT 失效）、**S2**（TOCTOU 竞态）、**M3/M6/M8/M9/M12~M16** 及 O 级建议。

## 验证记录

- `frontend`：
  - `npm run type-check` ✅
  - `npm run lint:check` ✅（修复了 3 处 lint 问题）
  - `npm run build` ✅（修复了 `PaginatedResult` 未使用导入）
- `backend`：
  - `npm run build` ✅
  - `npm run lint` ✅（修复了 1 处未使用导入）
  - `npm run test:e2e -- user-security.e2e-spec.ts` ✅
  - `npm run test:e2e -- user-guard-throttle.e2e-spec.ts` ✅

## 测试覆盖盲区

- 后端 e2e 覆盖了安全接口限流、参数校验、换绑核心链路，但缺少：旧密码错误、验证码过期、`confirmPassword` 不一致等边界场景。
- 前端尚无 e2e 基建（无 Playwright/Cypress），以下问题无自动化回归保护：删除失败弹窗状态、倒计时残留、主题切换。

---

## 已修复项（本轮）

1. `UserListView.vue:26` — 删除未使用的 `PaginatedResult` 类型导入
2. `eslint.config.mjs` — globals 补充 `Event`、`HTMLInputElement` DOM 类型
3. `user-guard-throttle.e2e-spec.ts:11` — 删除未使用的 `parseApiResponse` 导入

## 已确认修复到位项（前轮）

1. 账号安全接口限流 Guard 已生效（代码审查 + e2e）：`backend/src/modules/user/user-account.controller.ts:36`
2. 用户 `:id` 参数 UUID 校验已补齐（代码审查 + e2e）：`backend/src/modules/user/user.controller.ts:49`
3. `create()` 并发唯一约束兜底已补齐（代码审查）：`backend/src/modules/user/user.service.ts:82`
4. 验证码 TOCTOU 顺序已优化并下沉 Service（代码审查 + e2e 间接覆盖）：`backend/src/modules/user/user-security.service.ts:55`
5. 注销账号弹窗提前关闭问题已修复（代码审查，无前端 e2e）：`frontend/src/views/settings/components/DeleteAccountDialog.vue:60`

---

## 严重问题（6 个，2 个待修复 / 4 个已修复）

### S1）后端：修改密码后旧 JWT 仍有效（待修复）

- 现象：用户修改密码后，所有已签发的 JWT token 在过期前仍然可用
- 风险：账号被盗后修改密码无法踢出攻击者，安全模型失效
- 证据：`backend/src/modules/user/user-security.service.ts:32-53`
- 建议：用户实体增加 `tokenVersion` 字段或 Redis token 黑名单，密码变更时递增版本号，JWT 校验时验证匹配

### S2）后端：换绑手机/邮箱 TOCTOU 竞态导致验证码浪费（待修复）

- 现象：流程为"查冲突 → 消耗验证码 → 写入"，若写入时唯一约束冲突，验证码已被销毁
- 风险：用户需重新获取验证码才能再次尝试，体验受损
- 证据：`backend/src/modules/user/user-security.service.ts:59-88, :95-128`
- 建议：将验证码消耗和写入包裹在事务中，或缩小竞态窗口（先验证不消耗，写入成功后再消耗）

### S3）✅ 后端：头像 URL 校验未限制协议（已修复）

- 现象：`@IsUrl()` 默认配置未显式限制协议
- ~~建议：`@IsUrl({ require_protocol: true, protocols: ['http', 'https'] })`，同时加 `@Length(1, 512)`~~
- **修复内容**: 已在 `CreateUserDto` 和 `UpdateUserDto` 中添加 `@IsUrl({ require_protocol: true, protocols: ['http', 'https'] })` + `@Length(1, 512)`

### S4）✅ 前端：`system` 主题不监听系统偏好变化（已修复）

- 现象：选择"跟随系统"后，操作系统切换深色/浅色模式，页面不响应
- **修复内容**: 提取 `composables/useTheme.ts` 统一管理主题，注册 `matchMedia` 的 `change` 监听。`main.ts` 使用 `initThemeSync()` 防闪烁，`AppearanceSection.vue` 使用 `useTheme()` composable

### S5）✅ 前端：路由 meta 类型未声明（已修复）

- 现象：`requiresAuth`/`requiresGuest` 无 `RouteMeta` 类型扩展，类型为隐式 `unknown`
- **修复内容**: 在 `src/types/index.ts` 中添加 `declare module 'vue-router' { interface RouteMeta { requiresAuth?: boolean; requiresGuest?: boolean } }`

### S6）✅ 前端：邮箱未脱敏（已修复）

- 现象：手机号做了 `maskPhone` 脱敏，邮箱直接原样展示
- **修复内容**: `SecuritySection.vue` 新增 `maskEmail()` 函数，使用 `indexOf` 方式实现 `u***@example.com` 脱敏

---

## 一般问题（16 个，7 个已修复 / 9 个待修复）

### 前端（8 个，5 个已修复）

#### M1）✅ 删除弹窗仍用 `AlertDialogAction` 触发异步删除（已修复）

- **修复内容**: `UserListView.vue` 删除按钮改为 `Button` + 手动控制 `open`，失败时弹窗保持打开

#### M2）✅ 换绑弹窗关闭后倒计时状态未重置（已修复）

- **修复内容**: `useSmsCountdown` 和 `useEmailCountdown` 新增 `reset()` 方法，弹窗 `watch(open)` 关闭回调中调用 `resetCountdown()`

#### M3）后端获取的头像 URL 未做前端协议校验

- 现象：`ProfileSection` 的 `onMounted` 中从后端获取的 avatar 直接赋给 `previewUrl`，未像 `onAvatarInput` 那样做协议检查
- 证据：`ProfileSection.vue:64-66`、`AppHeader.vue:33-37`
- 建议：提取 `isSafeUrl` 公共函数，两处都使用

#### M4）✅ 弹窗关闭时重复调用 `resetForm`（已修复）

- **修复内容**: 移除三个弹窗 `onSubmit` 成功路径中的 `form.resetForm()` 调用，统一由 `watch(open)` 处理

#### M5）✅ bio 校验最大长度不一致（已修复）

- **修复内容**: `UserListView.vue` 的 bio 校验从 max 256 统一为 max 200，与 `ProfileSection` 和后端 Entity 一致

#### M6）注销后 `auth.logout()` 对已删除用户发无效请求

- 现象：`deleteUser` 后再调 `auth.logout()`，此时账号已删除，后端请求必然失败
- 证据：`DeleteAccountDialog.vue:34-39`
- 建议：改为仅清除前端状态，不调后端

#### M7）✅ 主题逻辑 `main.ts` 和 `AppearanceSection` 重复实现（已修复）

- **修复内容**: 提取 `composables/useTheme.ts`，`main.ts` 使用 `initThemeSync()`，`AppearanceSection` 使用 `useTheme()` composable

#### M8）侧边栏路由匹配方式脆弱

- 现象：`route.path === item.to` 精确匹配，尾斜杠或 query 参数会导致匹配失败
- 证据：`SettingsLayout.vue:28`
- 建议：改用 `RouterLink` 的 `active-class`

### 后端（8 个，2 个已修复）

#### M9）`confirmPassword` 校验位置不一致

- 现象：`UserAccountController:65` 在 Controller 层校验，`auth-reset.service.ts:79` 在 Service 层校验
- 建议：统一在 DTO 层用自定义装饰器或至少保持位置一致

#### M10）✅ `PG_UNIQUE_VIOLATION` 常量重复定义（已修复）

- **修复内容**: 抽取到 `src/common/constants/postgres.ts`，`user-security.service.ts` 和 `user.service.ts` 统一引用

#### M11）✅ 验证码字段 `@Length(6,6)` 接受非数字（已修复）

- **修复内容**: `user-security.dto.ts` 中 `smsCode` 和 `emailCode` 统一使用 `@Matches(/^\d{6}$/, { message: '验证码为 6 位数字' })`

#### M12）`GET /users` 缺乏权限控制

- 现象：任何已登录用户可分页遍历所有用户公开信息
- 证据：`user.controller.ts:56-65`
- 建议：加管理员角色校验或更严格限流

#### M13）`:id` 路由靠注册顺序避免捕获 `me`，脆弱

- 现象：`UserAccountController` 必须在 `UserController` 之前注册，否则 `GET /users/me` 被 `:id` 捕获
- 证据：`user.module.ts:13`
- 建议：`:id` 参数加 UUID 正则约束或调整路由前缀

#### M14）`normalizeEmail` 是纯函数却定义为实例方法

- 现象：不依赖实例状态，但被 `UserSecurityService` 通过 `UserService` 实例调用，增加耦合
- 证据：`user.service.ts:37-39`
- 建议：提取到 `src/shared/utils/` 或改为 `static`

#### M15）`auth.controller.ts` 方法缺少返回类型注解

- 现象：`register`、`loginByPassword` 等方法靠类型推断，与 `UserAccountController` 风格不一致
- 证据：`auth.controller.ts:73, :90, :113`
- 建议：统一补充 `Promise<ApiResponseDto<...>>` 返回类型

#### M16）`DELETE /users/:id` 无二次确认

- 现象：只需 JWT 即可永久删除账号，无密码或验证码确认
- 证据：`user.controller.ts:106-123`
- 建议：至少要求输入当前密码确认

---

## 优化建议（12 个，可选）

### 前端（6 个）

| # | 建议 | 位置 |
|---|------|------|
| O1 | 表单校验规则散落各组件，建议集中到 `validators.ts` | 各组件 `z.object(...)` |
| O2 | `onAvatarInput` 用 DOM 事件 + 类型断言，不如 watch 表单字段值 | `ProfileSection.vue:35` |
| O3 | 获取验证码前应先触发 vee-validate 字段校验，统一错误提示 | `ChangePhoneDialog.vue:98`、`ChangeEmailDialog.vue:92` |
| O4 | `UserListView` 同时管列表+编辑弹窗+删除弹窗，建议拆分 | `UserListView.vue` |
| O5 | AppHeader `<img>` 缺 `@error` 处理，头像失效显示破碎图标 | `AppHeader.vue:33-37` |
| O6 | ~~`options` 数组内外两层 `as const` 冗余~~ ✅ 已随主题重写修复 | `AppearanceSection.vue` |

### 后端（6 个）

| # | 建议 | 位置 |
|---|------|------|
| O7 | `parseDurationMs` 缺少纯数字输入和 0 值的防御 | `duration.ts:17-22` |
| O8 | `UserService.create` 用 spread DTO，未来新增敏感字段可能权限提升 | `user.service.ts:76-80` |
| O9 | 唯一约束冲突判断类型断言重复，建议抽取 `isPgUniqueViolation` 守卫 | `user-security.service.ts:132`、`user.service.ts` |
| O10 | e2e 缺少旧密码错误、验证码过期、confirmPassword 不一致等边界场景 | `user-security.e2e-spec.ts` |
| O11 | Mock 模式日志输出手机号和验证码明文，建议脱敏 | `verification-sender.service.ts:94-97` |
| O12 | `@Req() req: { user: JwtPayload }` 重复出现，建议封装 `@CurrentUser()` 装饰器 | 多处 Controller |

---

## 做得好的地方

### 后端

1. 模块职责划分清晰：`UserController`（CRUD）/ `UserAccountController`（安全变更）/ `UserSecurityService`（密码/手机/邮箱），Controller 薄 Service 厚
2. 数据库唯一约束兜底 TOCTOU，`try-catch` 捕获 `23505` 冲突
3. 验证码用 `timingSafeEqual` 防时序攻击，`crypto.randomInt` 生成，最大尝试 5 次，60s 频率限制，成功即删
4. 密码字段 Entity 中 `select: false`，默认不暴露
5. `toSelfDto` 显式字段摘取，防新增字段意外泄露
6. 统一响应体 `ApiResponseDto` 全局一致
7. 限流分层：全局 60/min + 敏感接口 5/min

### 前端

1. API 层抽象清晰（`lib/users.ts`、`lib/auth.ts`），组件不直接调 http
2. composable 复用得当（`useSmsCountdown`、`useEmailCountdown`）
3. 头像 URL 协议校验（`onAvatarInput` 只允许 http/https），安全意识好
4. 无障碍规范良好，Dialog 都有 Title+Description
5. 主题初始化防闪烁（`main.ts` 在 Vue 挂载前同步设置 dark class）
6. 路由全部懒加载，无显式 `any`
7. 手机号脱敏、加载状态 Skeleton+Loader2 全覆盖

---

## 建议修复顺序

### ✅ 已修复（本轮复审）

| 编号 | 问题 | 验证 |
|------|------|------|
| S3 | 后端头像 URL 显式限制协议 | lint + build ✅ |
| S4 | 前端 system 主题监听系统偏好变化 | lint + build ✅ |
| S5 | 路由 meta 类型声明 | lint + build ✅ |
| S6 | 邮箱脱敏 | lint + build ✅ |
| M1 | UserListView 删除弹窗改为 Button | lint + build ✅ |
| M2 | 倒计时 composable 增加 reset | lint + build ✅ |
| M4 | 弹窗 resetForm 双重调用 | lint + build ✅ |
| M5 | bio 长度统一为 200 | lint + build ✅ |
| M7 | 主题逻辑提取 useTheme composable | lint + build ✅ |
| M10 | PG_UNIQUE_VIOLATION 常量统一 | lint + build ✅ |
| M11 | 验证码 @Length→@Matches | lint + build ✅ |
| O6 | as const 冗余移除 | lint + build ✅ |

### 第一优先级（合并前）

1. **S1** 修改密码后使旧 JWT 失效（安全）
2. **S2** 换绑 TOCTOU 竞态修复（体验）

### 第二优先级（合并后立即）

3. **M3/M6/M8** 前端剩余一般问题
4. **M9/M12~M16** 后端剩余一般问题

### 第三优先级（迭代优化）

5. **O1~O12** 优化建议按需处理（O6 已修复）
6. 补齐前端 e2e 基建
7. 补齐后端 e2e 边界场景
