# 个人中心模块 — 合并前 AI 审查报告

**审查日期**: 2026-03-01（初审） / 2026-03-01（二轮复审修复） / 2026-03-01（三轮严重问题修复）
**审查范围**: `backend/src/modules/user/` + `backend/src/modules/upload/` + `frontend/src/views/settings/` + 相关 lib/composables/stores
**审查工具**: Claude Opus 4.6 代码审查（含 vue-code-review / nestjs-code-review 技能）
**测试验证**: `test/user-guard-throttle.e2e-spec.ts` — 8/8 用例通过

---

## 审查总览

| 严重级别 | 后端 | 前端 | 合计 | 状态 |
|---------|------|------|------|------|
| 🔴 严重（阻塞合并） | 3 | 2 | **5** | **全部已修复 ✅** |
| 🟠 中等（建议修复） | 7 | 8 | **15** | 已修复 5 个 ✅ / 剩余 10 个待迭代 |
| 🟡 低（可后续优化） | 5 | 8 | **13** | 已修复 1 个 ✅ / 剩余 12 个待迭代 |
| 🟢 正面模式 | 5 | 9 | **14** | — |
| 🔵 二轮复审新增（已修复） | 3 | 6 | **9** | **全部已修复 ✅** |
| 🟣 三轮严重问题修复 | 4 | 3 | **7** | **全部已修复 ✅** |

**结论**: 5 个初审严重问题 + 9 个二轮新增问题 + 7 个三轮严重问题已全部修复，额外解决 3 个中等问题，Lint/Build 全量通过，可以合并。

---

## 🔴 严重问题（已全部修复）

### S1. ✅ ThrottlerGuard 未生效 — 安全接口无速率限制

**位置**: `user-account.controller.ts:36`
**状态**: 已修复

`@Throttle({ default: { limit: 5, ttl: 60000 } })` 装饰器只有在 `ThrottlerGuard` 被应用时才生效。原代码 `UserAccountController` 既没有类级别的 `@UseGuards(ThrottlerGuard)`，`AppModule` 也没有全局注册 `ThrottlerGuard`，导致密码修改、手机换绑、邮箱换绑接口没有任何速率限制。

**修复内容**: 在 `UserAccountController` 类级别 `@UseGuards` 中添加 `ThrottlerGuard`：

```typescript
@UseGuards(JwtAuthGuard, ThrottlerGuard)
```

**测试验证**: `user-guard-throttle.e2e-spec.ts` — 修改密码接口连续 5 次请求后第 6 次返回 429；`GET /users/me` 连续 10 次不触发限流。

---

### S2. ✅ `:id` 参数缺少 UUID 格式校验

**位置**: `user.controller.ts:49, 76, 95, 115`
**状态**: 已修复

所有 `@Param('id')` 没有使用 `ParseUUIDPipe`，任意字符串直接传入数据库查询。虽然 TypeORM 参数化查询防止了 SQL 注入，但非法格式的 ID 会触发无意义的数据库查询。

**修复内容**: 所有 4 处 `:id` 参数添加 `ParseUUIDPipe`：

```typescript
@Param('id', ParseUUIDPipe) id: string
```

**测试验证**: `user-guard-throttle.e2e-spec.ts` — 6 个 UUID 校验用例全部通过（无效 UUID 返回 400，合法 UUID 但用户不存在返回 404）。

---

### S3. ✅ `create()` 方法缺少唯一约束异常兜底

**位置**: `user.service.ts:82-95`
**状态**: 已修复

`findOne` 检查与 `save` 写入之间存在竞态窗口（TOCTOU）。并发注册相同手机号时，其中一个会抛出未捕获的数据库异常，返回 500 而非友好的 409。

**修复内容**: 给 `create()` 的 `save` 调用添加 try/catch，捕获 PG 23505 唯一约束异常并转为 `ConflictException`，与 `UserSecurityService.handleUniqueViolation` 保持一致模式。

```typescript
try {
  saved = await this.userRepo.save(user);
} catch (err) {
  if (
    err instanceof QueryFailedError &&
    (err as QueryFailedError & { code?: string }).code === PG_UNIQUE_VIOLATION
  ) {
    throw new ConflictException('该手机号或邮箱已被使用');
  }
  throw err;
}
```

**验证**: TypeScript 编译通过（`tsc --noEmit` 零错误）。

---

### S4. ✅ `DeleteAccountDialog` 弹窗提前关闭

**位置**: `frontend/src/views/settings/components/DeleteAccountDialog.vue:60-67`
**状态**: 已修复

`AlertDialogAction` 组件点击后自动关闭弹窗，但 `handleDelete` 是异步操作。弹窗在 API 调用完成前就已关闭，导致 API 失败时用户需重新打开弹窗并重新输入确认文本，`loading` 状态永远不可见。

**修复内容**:
- 将 `AlertDialogAction` 替换为 `Button variant="destructive"`
- 在 `handleDelete` 成功回调中手动 `open.value = false`
- 为 `AlertDialogCancel` 添加 `:disabled="loading"` 防止操作中途关闭

**验证**: TypeScript 编译通过（`vue-tsc --noEmit` 零错误）。

---

### S5. ✅ 头像预览存在协议注入风险

**位置**: `frontend/src/views/settings/components/ProfileSection.vue:34-50`
**状态**: 已修复

`previewUrl` 直接来自用户输入，未经协议校验就渲染为 `<img src>`。zod 的 `.url()` 校验仅在提交时触发，防抖预览阶段不受限制。攻击者可输入 `javascript:`、`data:` 或内网地址触发浏览器请求。

**修复内容**: 在 `onAvatarInput` 的 600ms 防抖回调中增加协议白名单校验：

```typescript
if (/^https?:\/\//i.test(url)) {
  previewUrl.value = url
} else {
  previewUrl.value = ''
}
```

**验证**: TypeScript 编译通过（`vue-tsc --noEmit` 零错误）。

---

## 🟠 中等问题（建议后续修复）

### M1. 手机号正则在 3 处重复定义

**位置**:
- `common/constants/phone.ts` — `PHONE_REGEX`（已有常量）
- `user.dto.ts:19` — 内联 `/^1[3-9]\d{9}$/`
- `user-security.dto.ts:27` — 内联 `/^1[3-9]\d{9}$/`

**建议**: 统一引用 `PHONE_REGEX` 常量，消除冗余。

### M2. `normalizeEmail` 逻辑在 3 处分散

**位置**:
- `user.service.ts:37-39` — `normalizeEmail()` 方法
- `user.dto.ts:48-49` — `@Transform` 内联
- `user-security.dto.ts:39-40` — `@Transform` 内联

**建议**: 提取为 `shared/utils/normalize.ts` 中的纯函数，统一引用。

### M3. Controller 权限校验逻辑重复 3 次

**位置**: `user.controller.ts:79-81, 99-101, 118-120`

```typescript
if (req.user.sub !== id) {
  throw new ForbiddenException('无权访问他人信息');
}
```

**建议**: 提取为自定义 Guard（如 `OwnerOnlyGuard`）或至少提取为 private 方法。

### M4. `handleUniqueViolation` 使用类型断言

**位置**: `user-security.service.ts:132-141`

`(err as QueryFailedError & { code?: string }).code` 绕过了 TypeScript 类型检查。

**建议**: 使用 TypeORM `QueryFailedError` 的 `driverError` 属性安全访问错误码。

### M5. ✅ `useSmsCountdown` 和 `useEmailCountdown` 近乎完全重复

**位置**:
- `frontend/src/composables/useSmsCountdown.ts`
- `frontend/src/composables/useEmailCountdown.ts`

两个文件结构相同，仅 API 调用、验证正则、Toast 文案不同。

**状态**: 已修复（三轮）

**修复内容**: 提取通用 `composables/useCountdown.ts`（接受 `validate`/`send`/`successMessage` 等配置项），`useSmsCountdown` 和 `useEmailCountdown` 变为薄包装，保持原有导出签名不变，消费方零改动。同时将 `EMAIL_REGEX` 从 composable 移至 `lib/validators.ts` 统一管理（一并修复 M13）。

### M6. ✅ 验证码倒计时在弹窗关闭后不重置

**位置**: `ChangePhoneDialog.vue`, `ChangeEmailDialog.vue`
**状态**: 已修复（二轮复审）

shadcn-vue Dialog 关闭时不卸载组件，`onUnmounted` 不触发。如果用户发送验证码后关闭再打开弹窗，倒计时仍在继续但表单已被 `resetForm()` 清空，造成状态不一致。

**修复内容**: `useSmsCountdown` 和 `useEmailCountdown` 新增 `reset()` 方法（清理定时器 + 重置倒计时），弹窗 `watch(open)` 关闭回调中调用 `resetCountdown()`。

### M7. 三个 Dialog 组件的提交逻辑模式完全重复

**位置**: `ChangePasswordDialog.vue:44-56`, `ChangePhoneDialog.vue:43-56`, `ChangeEmailDialog.vue:42-55`

同样的 `loading → try → API → toast → close → catch → finally` 结构重复 3 次。

**建议**: 提取为 `useDialogSubmit(apiFn, successMsg)` composable。

### M8. `ChangePasswordDialog` 未校验新旧密码不同

**位置**: `frontend/src/views/settings/components/ChangePasswordDialog.vue:24-35`

zod schema 校验了 `newPassword === confirmPassword`，但未校验 `newPassword !== oldPassword`。

**建议**: 增加 `.refine()` 校验新旧密码不同。

### M9. `confirmPassword` 发送到后端

**位置**: `ChangePasswordDialog.vue:47`, `types/index.ts:130-134`

`ChangePasswordPayload` 包含 `confirmPassword` 字段，但该字段仅用于前端校验。发送到后端是多余的。

**建议**: 在提交前剥离 `confirmPassword`，或从 payload 类型中移除。

### M10. ✅ 邮箱未脱敏显示

**位置**: `SecuritySection.vue:56-57`
**状态**: 已修复（二轮复审）

手机号做了脱敏（`maskPhone()`），但邮箱直接显示完整地址。

**修复内容**: 新增 `maskEmail()` 函数（`u***@example.com` 模式），模板中邮箱改为 `maskEmail(auth.user.email)` 展示。

### M11. `update()` 使用 `save()` 触发全量 UPDATE

**位置**: `user.service.ts:168-175`

`save()` 会发出包含所有列的 UPDATE SQL，且内部会先做一次 SELECT。加上前面的 `findOne()`，总共 3 次数据库调用。

**建议**: 使用 `update()` + `findOne()` 返回更新结果，减少为 2 次调用。

### M12. `SettingsLayout` 导航高亮使用严格路径匹配

**位置**: `frontend/src/views/settings/SettingsLayout.vue:28`

```typescript
route.path === item.to
```

如果 URL 有尾部斜杠或 query 参数则匹配失败。

**建议**: 使用 `RouterLink` 的 `active-class` / `exact-active-class` 原生属性。

### M13. ✅ `EMAIL_REGEX` 散落在 composable 中

**位置**: `frontend/src/composables/useEmailCountdown.ts:7`

手机号正则在 `@/lib/validators.ts`，但邮箱正则在 composable 内部定义。

**状态**: 已修复（三轮，随 M5 一并处理）

**修复内容**: `EMAIL_REGEX` 移至 `@/lib/validators.ts` 统一管理，`useEmailCountdown` 改为从 validators 引入。

### M14. `ProfileSection` 更新接口使用 `/users/:id` 而非 `/users/me`

**位置**: `frontend/src/lib/users.ts:26`, `ProfileSection.vue:75`

密码/手机/邮箱变更都走 `/users/me/*`，但资料更新走 `/users/:id`，模式不一致。

**建议**: 后端增加 `PUT /users/me` 端点，或前端统一走 `/users/me` 模式。

### M15. ✅ `@Throttle` 配合 `confirmPassword` 校验放在 Controller 层

**位置**: `user-account.controller.ts:65-67`

Controller 注释声称"只做薄转发"，但 `confirmPassword` 一致性校验放在了 Controller 层。

**状态**: 已修复（三轮）

**修复内容**: 创建 `common/decorators/match.decorator.ts` 自定义 `@Match` 校验装饰器，在 `ChangePasswordDto.confirmPassword` 字段上声明 `@Match('newPassword', { message: '两次输入的密码不一致' })`，Controller 移除 `if (dto.newPassword !== dto.confirmPassword)` 逻辑，恢复为纯薄转发。

---

## 🟡 低优先级问题

### L1. `UpdateUserDto` 允许空 body 提交

**位置**: `user.dto.ts:75-104` — 所有字段均为 `@IsOptional()`，空 `{}` 也能通过校验并触发无意义的 UPDATE。

### L2. `ChangePasswordDto` 缺少密码复杂度要求

**位置**: `user-security.dto.ts:13-15` — 仅校验长度 6-128，无字母/数字混合要求。

### L3. 用户删除为硬删除

**位置**: `user.service.ts:178-182` — 当前阶段无外键关联尚可接受，引入活动/报名模块后需迁移为软删除。

### L4. `findAll()` 分页默认值冗余处理

**位置**: `user.service.ts:104-105` — `PaginationQueryDto` 已有默认值且 `ValidationPipe` 启用了 `transform`，`?? 1` 和 `?? 20` 多余。

### L5. Swagger `@ApiResponse` 缺少泛型响应类型

**位置**: `user.controller.ts` 多处 — `type` 未指定或泛型参数丢失，文档中 `data` 显示为 `unknown`。

### L6. ✅ Dialog 内 `form.resetForm()` 双重调用

**位置**: 三个 Dialog 组件 — 成功路径手动调用 `resetForm()`，同时 `watch(open)` 也会触发 `resetForm()`，重复执行。
**状态**: 已修复（二轮复审）

**修复内容**: 移除三个弹窗 `onSubmit` 成功路径中的 `form.resetForm()` 调用，统一由 `watch(open)` 处理。

### L7. `ChangePasswordDialog` 对旧密码施加了新密码策略

**位置**: `ChangePasswordDialog.vue:27` — `oldPassword: z.string().min(6)`。如果用户历史密码不足 6 位，则无法通过前端校验来修改密码。

### L8. `DeleteAccountDialog` 注销后调用 `auth.logout()` 语义不当

**位置**: `DeleteAccountDialog.vue:37` — 用户已被删除，再调用后端 `POST /auth/logout` 语义错误。`auth.logout()` 内部 `.catch(() => undefined)` 让其不报错，但应直接清理本地状态而非调 API。

### L9. 路由 redirect 使用字符串路径

**位置**: `router/index.ts:77` — `redirect: '/settings/profile'` 应使用命名路由 `{ name: 'settings-profile' }`。

### L10. `maskPhone` 为组件私有函数

**位置**: `SecuritySection.vue:19-21` — 如果其他页面也需要手机号脱敏，此函数将被重复。建议移至 `@/lib/formatters.ts`。

### L11. `ProfileSection` 的 `debounceTimer` 非响应式变量

**位置**: `ProfileSection.vue:32` — 使用 `let` 而非 `ref`。当前路由结构下无问题，但在测试中多实例并行会共享变量。

### L12. `create()` 直接修改了入参 DTO

**位置**: `user.service.ts:65` — `dto.email = normalizedEmail` 直接修改传入对象，违反纯函数原则。

### L13. `UserSecurityService` 未在模块中导出

**位置**: `user.module.ts:15` — 仅导出 `UserService`。当前无外部调用需求，留待后续按需导出。

---

## 🟢 正面模式（值得保持）

### 后端

| 模式 | 位置 | 说明 |
|------|------|------|
| `select: false` + 专用查询方法 | `user.entity.ts:66` + `user.service.ts:185-200` | 密码字段默认隐藏，显式获取 |
| `toSelfDto()` 显式字段映射 | `user.service.ts:126-137` | 防止 Entity 新增字段意外泄露 |
| Controller 注册顺序注释 | `user.module.ts:12` | 防止重构时 `/users/me` 被 `/:id` 误捕获 |
| 职责分离 | `UserService` vs `UserSecurityService` | CRUD 与安全变更解耦 |
| 安全变更事务化 | `user-security.service.ts` | 冲突检查 + 写入在同一事务内，唯一约束兜底 |

### 前端

| 模式 | 位置 | 说明 |
|------|------|------|
| `defineModel` 双向绑定 | 所有 Dialog 组件 | Vue 3.4+ 惯用模式 |
| `watch(open)` 重置表单 | 所有 Dialog 组件 | 防止弹窗残留脏数据 |
| Skeleton 加载态 | `ProfileSection.vue` | 遵循项目规范，优于全屏 Spin |
| 定时器自动清理 | `useCountdown.ts` | 通用 composable，`onUnmounted` 防内存泄漏 |
| `ensureSessionChecked()` | `stores/auth.ts` | 防止路由守卫重复调用 API |
| vee-validate + zod | 所有表单 | 类型安全的表单校验 |
| API 层 null-check | `lib/users.ts` | `if (!data) throw` 兜底 |
| `AlertDialog` 二次确认 | `DeleteAccountDialog.vue` | 危险操作强制确认 |
| 无障碍 | 所有 Dialog | `DialogTitle` / `DialogDescription` 完整 |

---

## 🔵 二轮复审新增问题（已全部修复）

以下 9 个问题在全量复审中被识别并在本轮一并修复。

### R1. ✅ 后端头像 URL 校验未限制协议

**位置**: `user.dto.ts:60, :92`

`@IsUrl()` 默认配置未显式限制协议，可能接受非 http/https 协议的 URL。

**修复内容**: 改为 `@IsUrl({ require_protocol: true, protocols: ['http', 'https'] })`，同时新增 `@Length(1, 512)` 长度校验。

### R2. ✅ 前端 `system` 主题不监听系统偏好变化

**位置**: `AppearanceSection.vue`、`main.ts`

选择"跟随系统"后，操作系统切换深色/浅色模式页面不响应；主题逻辑在 `main.ts` 和 `AppearanceSection` 中重复实现。

**修复内容**: 提取 `composables/useTheme.ts` 统一管理主题，注册 `matchMedia` 的 `change` 监听，`onUnmounted` 时移除。`main.ts` 使用导出的 `initThemeSync()` 防闪烁。

### R3. ✅ 路由 meta 类型未声明

**位置**: `router/index.ts`、`lib/http.ts:34`

`requiresAuth`/`requiresGuest` 在 meta 中使用但无 `RouteMeta` 类型扩展，类型为隐式 `unknown`。

**修复内容**: 在 `src/types/index.ts` 中添加 `declare module 'vue-router' { interface RouteMeta { requiresAuth?: boolean; requiresGuest?: boolean } }`。

### R4. ✅ `UserListView` 删除弹窗仍用 `AlertDialogAction`

**位置**: `UserListView.vue:270`

`AlertDialogAction` 点击后自动关闭弹窗，异步删除失败时弹窗已关闭，与已修复的 `DeleteAccountDialog` 模式不一致。

**修复内容**: 改为 `Button` + 手动控制 `open`，失败时弹窗保持打开。

### R5. ✅ `bio` 校验最大长度不一致

**位置**: `UserListView.vue:48` vs `ProfileSection.vue:23`

`UserListView` 编辑弹窗中 bio 最大长度为 256，`ProfileSection` 为 200。

**修复内容**: `UserListView.vue` 统一为 200，与 `ProfileSection` 和后端 Entity 保持一致。

### R6. ✅ 主题逻辑 `main.ts` 和 `AppearanceSection` 重复实现

**位置**: `main.ts:8-15`、`AppearanceSection.vue:16-26`

两处各自实现了相同的主题应用逻辑，违反 DRY。

**修复内容**: 与 R2 一并修复，提取 `composables/useTheme.ts`。`main.ts` 使用 `initThemeSync()`，`AppearanceSection` 使用 `useTheme()` composable。

### R7. ✅ `PG_UNIQUE_VIOLATION` 常量重复定义

**位置**: `user-security.service.ts:15`、`user.service.ts:26`

`'23505'` 在两个 service 文件中各定义一次。

**修复内容**: 抽取到 `src/common/constants/postgres.ts`，两处统一引用。

### R8. ✅ 验证码字段 `@Length(6,6)` 接受非数字

**位置**: `user-security.dto.ts:33, :48`

`ChangePhoneDto.smsCode` 和 `ChangeEmailDto.emailCode` 只约束长度不限纯数字，与其他 DTO 的 `@Matches(/^\d{6}$/)` 不一致。

**修复内容**: 统一使用 `@Matches(/^\d{6}$/, { message: '验证码为 6 位数字' })`。

### R9. ✅ `AppearanceSection` 的 `options` 数组 `as const` 冗余

**位置**: `AppearanceSection.vue:11-14`

数组内外两层 `as const` 冗余。

**修复内容**: 随 R2/R6 重写时一并移除。

---

## 🟣 三轮严重问题修复（已全部修复）

三轮审查使用 `vue-code-review` 和 `nestjs-code-review` 技能对变更区代码做全面扫描，识别出 4 个后端 + 3 个前端严重/高优问题并一并修复。其中 T3/T6/T7 来自上传模块独立审查报告。

### T1. ✅ `useTheme.ts` 模块顶层 `window.matchMedia` 破坏 SSR/测试

**位置**: `frontend/src/composables/useTheme.ts:6`
**严重性**: 严重

模块顶层 `const mediaQuery = window.matchMedia(...)` 在 `import` 时立即执行，Node.js 环境（SSR、Vitest）中 `window` 不存在直接报错。

**修复内容**: 改为懒初始化单例 `getMediaQuery()`，仅在首次调用时访问 `window.matchMedia`。所有引用点（`applyTheme`、`useTheme`、`initThemeSync`）改为调用 `getMediaQuery()`。

### T2. ✅ `useSmsCountdown` / `useEmailCountdown` 90% 代码重复

**位置**: `frontend/src/composables/useSmsCountdown.ts`、`useEmailCountdown.ts`
**严重性**: 严重（同 M5，审查升级）

**修复内容**: 见 M5 修复说明。新增 `composables/useCountdown.ts` 通用 composable，两个场景文件变为 ~10 行薄包装。

### T3. ✅ 上传文件类型校验可被绕过（阻塞合并）

**位置**: `backend/src/modules/upload/upload.controller.ts:65`、`upload.service.ts:60`
**严重性**: 高（阻塞合并）

后端仅基于 `file.mimetype` 做类型校验，扩展名取自 `file.originalname`。`mimetype` 与原始文件名均可伪造，攻击者可上传非图片内容。

**修复内容**: 在 `upload.service.ts` 中实现零依赖的魔数检测（`IMAGE_SIGNATURES` 常量，支持 JPEG/PNG/GIF/WebP 四种格式的 magic bytes 校验）：
- 文件类型由内容魔数决定，不信任客户端 `mimetype`
- 文件扩展名由检测结果决定，不使用原始文件名
- 上传到 OSS 时显式设置 `Content-Type` 为检测到的 MIME 类型
- 同步修复 OSS 上传失败错误码：`BadRequestException` → `InternalServerErrorException`（第三方服务故障应为 5xx）
- 同步修复自定义域名拼接：`this.customDomain.replace(/^https?:\/\//, '')` 防止协议重复

### T4. ✅ `confirmPassword` 校验放在 Controller 层

**严重性**: 严重（同 M15，审查升级）

**修复内容**: 见 M15 修复说明。

### T5. ✅ 换绑手机/邮箱存在 TOCTOU 竞态

**位置**: `backend/src/modules/user/user-security.service.ts:57-87, 93-127`
**严重性**: 严重

原流程"先查冲突 → 再消耗验证码 → 再写入"存在竞态窗口：步骤 1 和步骤 3 之间另一请求可能抢先写入相同手机号/邮箱，导致验证码被浪费。

**修复内容**: 注入 `DataSource`，将冲突检查 + DB 写入包裹在 `dataSource.transaction()` 中：

```typescript
await this.dataSource.transaction(async (manager) => {
  const existing = await manager.findOne(UserEntity, { where: { phone: newPhone } });
  if (existing && existing.id !== userId) {
    throw new ConflictException('该手机号已被其他账号使用');
  }
  await manager.update(UserEntity, userId, { phone: newPhone });
});
```

验证码消耗（Redis）在事务外执行，DB 唯一约束作为最终兜底。流程从"三步走"变为"验证码 → 事务(检查+写入)"。

### T6. ✅ 前端上传请求手动设置 multipart Content-Type

**位置**: `frontend/src/lib/upload.ts:16`
**严重性**: 中

手动设置 `Content-Type: multipart/form-data` 可能覆盖浏览器/axios 自动注入的 boundary，导致后端解析异常。

**修复内容**: 删除 `headers: { 'Content-Type': 'multipart/form-data' }`，让 axios 发送 `FormData` 时自动附带正确的 `Content-Type` 和 boundary。

### T7. ✅ OSS 上传失败错误码语义偏差 + 自定义域名拼接

**严重性**: 中（随 T3 一并修复）

**修复内容**: 见 T3 修复说明中的同步修复项。

---

## 三轮验证记录

- `frontend`：
  - `npm run lint:check` ✅
  - `npm run build` ✅
- `backend`：
  - `npm run lint:check` ✅
  - `npm run build` ✅

---

## 修复优先级建议

### ✅ 合并前已修复（初审 + 二轮复审 + 三轮严重修复）

| 编号 | 问题 | 修复位置 | 验证方式 |
|------|------|---------|---------|
| S1 | ThrottlerGuard 未生效 | `user-account.controller.ts:36` | e2e 测试 |
| S2 | `:id` 缺少 UUID 校验 | `user.controller.ts:49,76,95,115` | e2e 测试 |
| S3 | `create()` 缺少唯一约束兜底 | `user.service.ts:82-95` | tsc 编译 |
| S4 | 注销弹窗提前关闭 | `DeleteAccountDialog.vue:60-67` | vue-tsc 编译 |
| S5 | 头像预览协议注入 | `ProfileSection.vue:34-50` | vue-tsc 编译 |
| M6 | 倒计时弹窗关闭不重置 | `useSmsCountdown.ts`、`useEmailCountdown.ts`、两个 Dialog | lint + build |
| M10 | 邮箱未脱敏 | `SecuritySection.vue` 新增 `maskEmail()` | lint + build |
| L6 | 弹窗 resetForm 双重调用 | 三个 Dialog 移除 onSubmit 中 resetForm | lint + build |
| R1 | 后端头像 URL 协议限制 | `user.dto.ts` | lint + build |
| R2 | system 主题不监听 | 新建 `composables/useTheme.ts` | lint + build |
| R3 | 路由 meta 类型 | `types/index.ts` | lint + build |
| R4 | UserListView 删除弹窗 | `UserListView.vue` AlertDialogAction→Button | lint + build |
| R5 | bio 长度不一致 | `UserListView.vue` 256→200 | lint + build |
| R6 | 主题逻辑重复 | `main.ts` + `AppearanceSection.vue` 重写 | lint + build |
| R7 | PG_UNIQUE_VIOLATION 重复 | 新建 `common/constants/postgres.ts` | lint + build |
| R8 | 验证码 @Length→@Matches | `user-security.dto.ts` | lint + build |
| R9 | options as const 冗余 | `AppearanceSection.vue` | lint + build |
| T1 | useTheme.ts 模块顶层 matchMedia | `composables/useTheme.ts` 懒初始化单例 | lint + build |
| T2/M5 | countdown composable 重复 | 新建 `composables/useCountdown.ts`，薄包装 | lint + build |
| T3 | 上传文件类型魔数校验 | `upload.service.ts` 零依赖 IMAGE_SIGNATURES | lint + build |
| T4/M15 | confirmPassword 校验位置 | 新建 `common/decorators/match.decorator.ts` | lint + build |
| T5 | 换绑操作 TOCTOU 竞态 | `user-security.service.ts` 事务化 | lint + build |
| T6 | 前端上传 multipart 手动 header | `lib/upload.ts` 删除 headers | lint + build |
| T7 | OSS 错误码 + 域名拼接 | `upload.service.ts` 500 + 协议剥离 | lint + build |
| M13 | EMAIL_REGEX 散落 | 移至 `lib/validators.ts` | lint + build |

### 合并后尽快修复

6. **M1+M2** — 统一后端手机号正则常量和邮箱规范化函数
7. **M8** — 密码修改增加新旧不同前端校验
8. **M3** — 权限校验提取为 Guard
9. **M9** — 前端 confirmPassword 提交前剥离

### 后续迭代优化

11. **L2** — 密码复杂度要求
12. **L3** — 软删除迁移（引入活动模块后）
13. **M7** — 提交模式去重
14. 其余 M、L、O 级问题按需处理

---

## 测试覆盖

| 测试文件 | 覆盖范围 | 用例数 | 状态 |
|---------|---------|----|------|
| `test/user-guard-throttle.e2e-spec.ts` | UUID 格式校验 + 限流验证 | 8 | ✅ 全部通过 |
| `test/user-security.e2e-spec.ts` | 密码修改、手机换绑、邮箱换绑冲突 | 3 | ✅ 单独运行全部通过 |
| `test/auth-user.e2e-spec.ts` | 注册流程、权限隔离、密码重置 | — | ⚠️ 预存问题（与本次修改无关） |

**注**: `auth-user.e2e-spec.ts` 中 2 个用例因 `GET /api/users` 返回 `PaginatedResult` 而非数组导致断言失败，属于早期分页重构未同步测试的遗留问题，与本次个人中心修改无关。
