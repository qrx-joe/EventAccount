# account-settings 分支完整代码审查报告

审查时间：2026-03-01  
审查范围：`frontend` 与 `backend` 的 `feature/account-settings` 分支（对比 `develop...HEAD`）

## 审查结论

- 本报告整合了两类视角：
  - 功能回归风险（前后端契约、运行时行为）
  - 代码质量与设计模式（分层、并发安全、可维护性）
- 总体评估：当前分支具备主要功能，但仍存在阻塞合并项，需在合并前修复。

## 问题分级汇总

- 严重（阻塞合并）：5 项
- 中等：15 项
- 低优先级：13 项
- 正面模式：14 项

## 严重问题（阻塞合并）

1. `@Throttle` 未生效，安全接口限流形同虚设（S1）
2. `:id` 路由参数无 UUID 格式校验
3. `UserService.create()` 并发竞态缺少数据库唯一约束兜底
4. `DeleteAccountDialog` 点击确认后存在提前关闭风险
5. 头像外链缺少安全边界（需收敛到允许域名/协议白名单）

> 关键发现：S1 `@Throttle` 未生效，需在合并前立即修复。

## 中等问题（15 项）

- 正则与校验逻辑存在冗余
- `normalizeEmail` 规则分散
- 权限校验重复，缺少统一抽象
- composable 逻辑重复
- 验证码倒计时状态在边界场景下不重置
- 其他结构与一致性问题共计 15 项

## 低优先级问题（13 项）

- 空 body 与返回语义可进一步统一
- 密码强度规则可加强
- 硬删除策略可评估为软删除
- `resetForm` 存在重复触发点
- 其他体验与代码整洁性问题共计 13 项

## 正面模式（14 项）

- 模块拆分方向总体正确
- DTO 与响应体结构基本统一
- 关键路径有测试覆盖
- 前后端类型与接口命名整体可读
- 其余正面实践共计 14 项，建议保持

## 分级修复建议

### 合并前（必须完成）

1. 修复限流生效问题：为账号安全控制器补齐 Throttler Guard（或全局 `APP_GUARD`）。
2. 为所有 `:id` 增加 UUID 校验（Pipe/DTO）。
3. 为 `create()` 与安全变更写入增加数据库唯一约束异常兜底映射（`23505 -> 409`）。
4. 修正注销确认弹窗行为，避免请求失败时弹窗提前关闭。

### 合并后（尽快）

1. 去重校验与正则规则，收敛到共享校验层。
2. 统一 `normalizeEmail` 入口。
3. 去重权限校验与 composable 逻辑。
4. 修复倒计时与表单状态边界行为。

### 后续迭代

1. 密码强度策略升级。
2. 删除策略升级（硬删 -> 软删评估）。
3. 完整化 UX 一致性与代码整洁性改造。

## 关键证据（节选）

- `backend/src/modules/user/user-account.controller.ts:59`
- `backend/src/modules/user/user-account.controller.ts:81`
- `backend/src/modules/user/user-account.controller.ts:100`
- `backend/src/modules/auth/auth.controller.ts:32`
- `backend/src/app.module.ts:64`
- `backend/src/modules/user/user.controller.ts:75`
- `backend/src/modules/user/user.service.ts:45`
- `frontend/src/views/settings/components/DeleteAccountDialog.vue:59`
- `frontend/src/components/ui/alert-dialog/AlertDialogAction.vue:15`
