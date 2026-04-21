# account-settings 分支审查报告

审查时间：2026-03-01  
审查范围：`frontend` 与 `backend` 的 `feature/account-settings` 分支（对比 `develop...HEAD`）

## 结论

本次分支功能整体可编译、可构建，但当前报告主要覆盖"功能回归风险（前后端契约）"。结合代码质量与设计模式维度补充后，共识别 6 个问题，其中 1 个高优先级、5 个中优先级。

## 问题清单

### 1) 用户列表接口前后端契约不一致（高）

- 现状：后端 `/users` 已改为分页结构 `PaginatedResult<UserPublicDto>`，前端仍按 `UserPublic[]` 数组解析。
- 影响：用户列表页可能出现空数据、渲染异常或数据结构错误。
- 证据：
  - `backend/src/modules/user/user.controller.ts:59`
  - `frontend/src/lib/users.ts:13`
  - `frontend/src/views/users/UserListView.vue:59`

### 2) 用户编辑弹窗仍允许改邮箱，但后端已禁用该入口（中）

- 现状：前端用户编辑弹窗仍提交 `email` 字段；后端 `UpdateUserDto` 已移除邮箱更新能力，邮箱改绑改为独立安全接口。
- 影响：用户看到“更新成功”但邮箱实际不变，产生误导。
- 证据：
  - `frontend/src/views/users/UserListView.vue:88`
  - `frontend/src/types/index.ts:32`
  - `backend/src/modules/user/user.dto.ts:74`

### 3) 主题偏好未在应用启动时初始化（中）

- 现状：主题恢复逻辑仅存在于外观页面组件挂载时，应用入口未统一初始化主题。
- 影响：用户刷新后若不进入外观页，主题偏好可能不生效。
- 证据：
  - `frontend/src/views/settings/components/AppearanceSection.vue:34`
  - `frontend/src/main.ts:1`

### 4) 弹窗关闭后状态残留（中，UX）

- 现状：4 个设置弹窗仅在提交成功时重置表单/状态，`overlay` 点击或 `Esc` 关闭后不会重置，下次打开会看到上次输入或校验错误。
- 影响：用户体验不一致，容易误操作或误判当前状态。
- 证据：
  - `frontend/src/views/settings/components/ChangePasswordDialog.vue:39`
  - `frontend/src/views/settings/components/ChangePhoneDialog.vue:38`
  - `frontend/src/views/settings/components/ChangeEmailDialog.vue:37`
  - `frontend/src/views/settings/components/DeleteAccountDialog.vue:53`

### 5) 验证码 TOCTOU（先消费验证码，再执行业务写入）（中，后端设计）

- 现状：控制器先 `verifyCode`，通过后再执行手机号/邮箱更新；而 `verifyCode` 在成功时会立即删除验证码。
- 影响：若后续业务写入失败（并发冲突/数据库异常），验证码已被消耗，用户必须重新获取验证码。
- 证据：
  - `backend/src/modules/user/user-account.controller.ts:89`
  - `backend/src/modules/user/user-account.controller.ts:97`
  - `backend/src/modules/user/user-account.controller.ts:115`
  - `backend/src/modules/user/user-account.controller.ts:123`
  - `backend/src/modules/verification/verification.service.ts:134`

### 6) 唯一约束并发冲突未做友好映射（中，可能返回 500）

- 现状：服务层采用"先查重再更新"，但缺少对数据库唯一键冲突异常的兜底转换（如 PG `23505`）；并发窗口下仍可能触发数据库异常。
- 影响：在并发场景中接口可能返回 500，而非预期 409，错误语义不稳定。
- 证据：
  - `backend/src/modules/user/user-security.service.ts:47`
  - `backend/src/modules/user/user-security.service.ts:51`
  - `backend/src/modules/user/user-security.service.ts:59`
  - `backend/src/modules/user/user-security.service.ts:63`
  - `backend/src/modules/user/user.entity.ts:23`
  - `backend/src/modules/user/user.entity.ts:39`
  - `backend/src/common/filters/http-exception.filter.ts:49`

## 已执行验证

- 前端类型检查：`npm run type-check`（通过）
- 前端构建：`npm run build`（通过）
- 后端构建：`npm run build`（通过）
- 后端 e2e：`npm run test:e2e -- user-security.e2e-spec.ts`（通过）

## 修复建议（按优先级）

1. 先修复 `/users` 分页契约：前端 `getUsers` 改为解析 `data.items`，并补充分页类型。
2. 移除用户列表编辑弹窗中的 `email` 字段，避免与安全模块职责冲突。
3. 在 `main.ts` 中 `app.mount()` 前做同步主题初始化，避免首屏闪烁（FOUC）：

```ts
const theme = localStorage.getItem('theme')
if (
  theme === 'dark' ||
  (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
) {
  document.documentElement.classList.add('dark')
}
```

4. 为 4 个设置弹窗统一补充"关闭即重置"逻辑（监听 `open` 变更，`false` 时 `resetForm`/清空本地状态）。
5. 调整换绑流程为"先查冲突，再消费验证码，再写入"，并将验证码校验逻辑从 Controller 下沉到 Service：

   - 步骤建议：`findByPhone/findByEmail` 预检查 -> `verifyCode`（此时才消耗）-> `updateBasicFields`。
   - 该方案改动小、无需引入事务，同时可降低 Controller 对 `VerificationService` 的直接耦合。

6. 对用户安全变更路径增加数据库唯一约束兜底（如 PostgreSQL `23505` -> `409 Conflict`）。

   - 与第 5 条关系：第 5 条可显著缩小并发窗口，但无法消除并发竞争；第 6 条仍是必须的防御性编程兜底。
   - 两条建议应同时落地，避免少数并发场景退化为 500。
