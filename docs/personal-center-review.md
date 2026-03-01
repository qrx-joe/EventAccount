# 个人中心模块 — 合并前 AI 审查报告

**审查日期**: 2026-03-01
**审查范围**: `backend/src/modules/user/` + `frontend/src/views/settings/` + 相关 lib/composables/stores
**审查工具**: Claude Opus 4.6 代码审查

---

## 审查总览

| 严重级别 | 后端 | 前端 | 合计 |
|---------|------|------|------|
| 🔴 严重（阻塞合并） | 3 | 2 | **5** |
| 🟠 中等（建议修复） | 7 | 8 | **15** |
| 🟡 低（可后续优化） | 5 | 8 | **13** |
| 🟢 正面模式 | 5 | 9 | **14** |

**结论**: 存在 5 个严重问题，建议修复后再合并。

---

## 🔴 严重问题（阻塞合并）

### S1. ThrottlerGuard 未生效 — 安全接口无速率限制

**位置**: `user-account.controller.ts:59, 81, 100`

`@Throttle({ default: { limit: 5, ttl: 60000 } })` 装饰器只有在 `ThrottlerGuard` 被应用时才生效。但 `UserAccountController` 既没有类级别的 `@UseGuards(ThrottlerGuard)`，`AppModule` 也没有全局注册 `ThrottlerGuard`。

**实际影响**: 密码修改、手机换绑、邮箱换绑接口**没有任何速率限制**。攻击者可无限次暴力尝试旧密码。

**对比**: `AuthController` 和 `VerificationController` 正确地使用了 `@UseGuards(ThrottlerGuard)`。

**修复方案**:

方案 A（推荐）— 全局注册：
```typescript
// app.module.ts
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
```
然后去掉各 Controller 方法/类级别的 `@UseGuards(ThrottlerGuard)`，只保留需自定义参数的 `@Throttle()` 装饰器。

方案 B — 局部修复：
```typescript
// user-account.controller.ts 类级别
@UseGuards(ThrottlerGuard)
```

---

### S2. `:id` 参数缺少 UUID 格式校验

**位置**: `user.controller.ts:48, 74, 93, 113`

所有 `@Param('id') id: string` 没有使用 `ParseUUIDPipe`，任意字符串直接传入数据库查询。虽然 TypeORM 参数化查询防止了 SQL 注入，但非法格式的 ID 会触发无意义的数据库查询。

**修复方案**:
```typescript
@Param('id', new ParseUUIDPipe()) id: string
```

---

### S3. `create()` 方法缺少唯一约束异常兜底

**位置**: `user.service.ts:44-81`

`findOne` 检查与 `save` 写入之间存在竞态窗口（TOCTOU）。并发注册相同手机号时，其中一个会抛出未捕获的数据库异常，返回 500 而非友好的 409。

**对比**: `UserSecurityService` 的 `changePhone()` / `changeEmail()` 正确地做了 `try/catch` + `handleUniqueViolation` 兜底。

**修复方案**: 给 `create()` 的 `save` 调用加 try/catch，捕获 PG 23505 唯一约束异常并转为 `ConflictException`。

---

### S4. `DeleteAccountDialog` 弹窗提前关闭

**位置**: `frontend/src/views/settings/components/DeleteAccountDialog.vue:59-66`

`AlertDialogAction` 组件点击后会自动关闭弹窗，但 `handleDelete` 是异步操作。弹窗在 API 调用完成前就已关闭：
- API 失败时用户看到 Toast 错误，但弹窗已关闭，需重新打开并重新输入确认文本
- `loading` 加载状态永远不会被用户看到

**修复方案**: 将 `AlertDialogAction` 替换为普通 `Button`，在 `handleDelete` 成功回调中手动关闭弹窗。

---

### S5. 头像预览存在 SSRF 风险

**位置**: `frontend/src/views/settings/components/ProfileSection.vue:105-113`

`previewUrl` 直接来自用户输入，未经协议校验就渲染为 `<img src>`。zod 的 `.url()` 校验仅在提交时触发，防抖预览阶段不受限制。攻击者可输入内网地址触发浏览器请求。

**修复方案**: 在 `onAvatarInput` 中增加协议白名单校验，仅允许 `https://` 开头的 URL 设置为 `previewUrl`。

---

## 🟠 中等问题（建议修复）

### M1. 手机号正则在 3 处重复定义

**位置**:
- `common/constants/phone.ts` — `PHONE_REGEX`（已有常量）
- `user.dto.ts:19` — 内联 `/^1[3-9]\d{9}$/`
- `user-security.dto.ts:27` — 内联 `/^1[3-9]\d{9}$/`

**建议**: 统一引用 `PHONE_REGEX` 常量，消除冗余。

### M2. `normalizeEmail` 逻辑在 3 处分散

**位置**:
- `user.service.ts:34-36` — `normalizeEmail()` 方法
- `user.dto.ts:48-49` — `@Transform` 内联
- `user-security.dto.ts:39-40` — `@Transform` 内联

**建议**: 提取为 `shared/utils/normalize.ts` 中的纯函数，统一引用。

### M3. Controller 权限校验逻辑重复 3 次

**位置**: `user.controller.ts:78-79, 98-99, 117-118`

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

### M5. `useSmsCountdown` 和 `useEmailCountdown` 近乎完全重复

**位置**:
- `frontend/src/composables/useSmsCountdown.ts`
- `frontend/src/composables/useEmailCountdown.ts`

两个文件结构相同，仅 API 调用、验证正则、Toast 文案不同。

**建议**: 提取泛型 `useVerificationCountdown(config)` composable，两者作为薄包装。

### M6. 验证码倒计时在弹窗关闭后不重置

**位置**: `ChangePhoneDialog.vue`, `ChangeEmailDialog.vue`

shadcn-vue Dialog 关闭时不卸载组件，`onUnmounted` 不触发。如果用户发送验证码后关闭再打开弹窗，倒计时仍在继续但表单已被 `resetForm()` 清空，造成状态不一致。

**建议**: 在 composable 中暴露 `reset()` 方法，在 `watch(open)` 回调中调用。

### M7. 三个 Dialog 组件的提交逻辑模式完全重复

**位置**: `ChangePasswordDialog.vue:44-56`, `ChangePhoneDialog.vue:43-56`, `ChangeEmailDialog.vue:42-55`

同样的 `loading → try → API → toast → close → catch → finally` 结构重复 3 次。

**建议**: 提取为 `useDialogSubmit(apiFn, successMsg)` composable。

### M8. `ChangePasswordDialog` 未校验新旧密码不同

**位置**: `frontend/src/views/settings/components/ChangePasswordDialog.vue:24-35`

zod schema 校验了 `newPassword === confirmPassword`，但未校验 `newPassword !== oldPassword`。用户可以把密码"改"成原来的。

**建议**: 增加 `.refine()` 校验新旧密码不同。

### M9. `confirmPassword` 发送到后端

**位置**: `ChangePasswordDialog.vue:47`, `types/index.ts:130-134`

`ChangePasswordPayload` 包含 `confirmPassword` 字段，但该字段仅用于前端校验。发送到后端是多余的。

**建议**: 在提交前剥离 `confirmPassword`，或从 payload 类型中移除。

### M10. 邮箱未脱敏显示

**位置**: `SecuritySection.vue:56-57`

手机号做了脱敏（`maskPhone()`），但邮箱直接显示完整地址。

**建议**: 增加 `maskEmail()` 函数，如 `u***@example.com`。

### M11. `update()` 使用 `save()` 触发全量 UPDATE

**位置**: `user.service.ts:151-158`

`save()` 会发出包含所有列的 UPDATE SQL，且内部会先做一次 SELECT 检查实体是否存在。加上前面的 `findOne()`，总共 3 次数据库调用。

**建议**: 使用 `update()` + `findOne()` 返回更新结果，减少为 2 次调用。

### M12. `SettingsLayout` 导航高亮使用严格路径匹配

**位置**: `frontend/src/views/settings/SettingsLayout.vue:28`

```typescript
route.path === item.to
```

如果 URL 有尾部斜杠或 query 参数则匹配失败。

**建议**: 使用 `RouterLink` 的 `active-class` / `exact-active-class` 原生属性。

### M13. `EMAIL_REGEX` 散落在 composable 中

**位置**: `frontend/src/composables/useEmailCountdown.ts:7`

手机号正则在 `@/lib/validators.ts`，但邮箱正则在 composable 内部定义。

**建议**: 移至 `@/lib/validators.ts` 统一管理。

### M14. `ProfileSection` 更新接口使用 `/users/:id` 而非 `/users/me`

**位置**: `frontend/src/lib/users.ts:26`, `ProfileSection.vue:70`

密码/手机/邮箱变更都走 `/users/me/*`，但资料更新走 `/users/:id`，模式不一致。客户端传递 user ID 增加了被篡改的风险面。

**建议**: 后端增加 `PUT /users/me` 端点，或前端统一走 `/users/me` 模式。

### M15. `@Throttle` 配合 `confirmPassword` 校验放在 Controller 层

**位置**: `user-account.controller.ts:65-67`

Controller 注释声称"只做薄转发"，但 `confirmPassword` 一致性校验放在了 Controller 层。

**建议**: 使用 class-validator 自定义装饰器在 DTO 层完成。

---

## 🟡 低优先级问题

### L1. `UpdateUserDto` 允许空 body 提交

**位置**: `user.dto.ts:75-104` — 所有字段均为 `@IsOptional()`，空 `{}` 也能通过校验并触发无意义的 UPDATE。

### L2. `ChangePasswordDto` 缺少密码复杂度要求

**位置**: `user-security.dto.ts:13-15` — 仅校验长度 6-128，无字母/数字混合要求。

### L3. 用户删除为硬删除

**位置**: `user.service.ts:161-165` — 当前阶段无外键关联尚可接受，引入活动/报名模块后需迁移为软删除。

### L4. `findAll()` 分页默认值冗余处理

**位置**: `user.service.ts:87-88` — `PaginationQueryDto` 已有默认值且 `ValidationPipe` 启用了 `transform`，`?? 1` 和 `?? 20` 多余。

### L5. Swagger `@ApiResponse` 缺少泛型响应类型

**位置**: `user.controller.ts` 多处 — `type` 未指定或泛型参数丢失，文档中 `data` 显示为 `unknown`。

### L6. Dialog 内 `form.resetForm()` 双重调用

**位置**: 三个 Dialog 组件 — 成功路径手动调用 `resetForm()`，同时 `watch(open)` 也会触发 `resetForm()`，重复执行。

### L7. `ChangePasswordDialog` 对旧密码施加了新密码策略

**位置**: `ChangePasswordDialog.vue:27` — `oldPassword: z.string().min(6)`。如果用户历史密码不足 6 位，则无法通过前端校验来修改密码。

### L8. `DeleteAccountDialog` 注销后调用 `auth.logout()` 语义不当

**位置**: `DeleteAccountDialog.vue:36` — 用户已被删除，再调用后端 `POST /auth/logout` 语义错误。`auth.logout()` 内部 `.catch(() => undefined)` 让其不报错，但应直接清理本地状态而非调 API。

### L9. 路由 redirect 使用字符串路径

**位置**: `router/index.ts:77` — `redirect: '/settings/profile'` 应使用命名路由 `{ name: 'settings-profile' }`。

### L10. `maskPhone` 为组件私有函数

**位置**: `SecuritySection.vue:19-21` — 如果其他页面（如管理后台）也需要手机号脱敏，此函数将被重复。建议移至 `@/lib/formatters.ts`。

### L11. `ProfileSection` 的 `debounceTimer` 非响应式变量

**位置**: `ProfileSection.vue:32` — 使用 `let` 而非 `ref`。当前路由结构下无问题，但在测试中多实例并行会共享变量。

### L12. `create()` 直接修改了入参 DTO

**位置**: `user.service.ts:62` — `dto.email = normalizedEmail` 直接修改传入对象，违反纯函数原则。

### L13. `UserSecurityService` 未在模块中导出

**位置**: `user.module.ts:15` — 仅导出 `UserService`。当前无外部调用需求，留待后续按需导出。

---

## 🟢 正面模式（值得保持）

### 后端

| 模式 | 位置 | 说明 |
|------|------|------|
| `select: false` + 专用查询方法 | `user.entity.ts:66` + `user.service.ts:168-183` | 密码字段默认隐藏，显式获取 |
| `toSelfDto()` 显式字段映射 | `user.service.ts:109-120` | 防止 Entity 新增字段意外泄露 |
| Controller 注册顺序注释 | `user.module.ts:12` | 防止重构时 `/users/me` 被 `/:id` 误捕获 |
| 职责分离 | `UserService` vs `UserSecurityService` | CRUD 与安全变更解耦 |
| 安全变更三步走 | `user-security.service.ts` | 冲突检查 → 验证码消耗 → 写入兜底 |

### 前端

| 模式 | 位置 | 说明 |
|------|------|------|
| `defineModel` 双向绑定 | 所有 Dialog 组件 | Vue 3.4+ 惯用模式 |
| `watch(open)` 重置表单 | 所有 Dialog 组件 | 防止弹窗残留脏数据 |
| Skeleton 加载态 | `ProfileSection.vue` | 遵循项目规范，优于全屏 Spin |
| 定时器自动清理 | `useSmsCountdown`, `useEmailCountdown` | `onUnmounted` 防内存泄漏 |
| `ensureSessionChecked()` | `stores/auth.ts` | 防止路由守卫重复调用 API |
| vee-validate + zod | 所有表单 | 类型安全的表单校验 |
| API 层 null-check | `lib/users.ts` | `if (!data) throw` 兜底 |
| `AlertDialog` 二次确认 | `DeleteAccountDialog.vue` | 危险操作强制确认 |
| 无障碍 | 所有 Dialog | `DialogTitle` / `DialogDescription` 完整 |

---

## 修复优先级建议

### 合并前必须修复

1. **S1** — 全局注册 `ThrottlerGuard` 或在 `UserAccountController` 类级别添加
2. **S2** — `:id` 参数添加 `ParseUUIDPipe`
3. **S3** — `create()` 添加唯一约束异常兜底
4. **S4** — `DeleteAccountDialog` 替换 `AlertDialogAction` 为 `Button`
5. **S5** — 头像预览添加 URL 协议校验

### 合并后尽快修复

6. **M1+M2+M13** — 统一正则常量和邮箱规范化函数
7. **M5** — 合并两个 countdown composable
8. **M6** — 弹窗关闭时重置倒计时状态
9. **M8** — 密码修改增加新旧不同校验
10. **M3** — 权限校验提取为 Guard

### 后续迭代优化

11. **L2** — 密码复杂度要求
12. **L3** — 软删除迁移（引入活动模块后）
13. **M7** — 提交模式去重
14. **M10** — 邮箱脱敏显示
