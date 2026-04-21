# account-settings 未提交变更代码审查报告

审查时间：2026-03-01  
审查对象：当前工作区未提交改动（frontend + backend）

## 审查范围

### 前端改动

- `frontend/src/components/AvatarUpload.vue`
- `frontend/src/lib/upload.ts`
- `frontend/src/views/settings/components/ProfileSection.vue`
- `frontend/src/types/index.ts`

### 后端改动

- `backend/src/modules/upload/upload.controller.ts`
- `backend/src/modules/upload/upload.service.ts`
- `backend/src/modules/upload/upload.dto.ts`
- `backend/src/modules/upload/upload.module.ts`
- `backend/src/config/oss.config.ts`
- `backend/src/app.module.ts`
- `backend/package.json`
- `backend/.env.example`

## 基础检查结果

- 前端：
  - `npm run lint:check` ✅
  - `npm run build` ✅
- 后端：
  - `npm run lint:check` ✅
  - `npm run build` ✅

## 审查结论

- 上传模块整体结构清晰、分层合理，具备可用性。
- 但存在 1 个高优先级安全问题，建议在合并前修复。

## 问题清单

### 1) 文件类型校验可被绕过（高，建议阻塞合并）

- 现状：后端仅基于 `file.mimetype` 做类型校验，且扩展名来自 `file.originalname`。
- 风险：`mimetype` 与原始文件名均可伪造，攻击者可上传非图片内容，存在安全风险。
- 证据：
  - `backend/src/modules/upload/upload.controller.ts:65`
  - `backend/src/modules/upload/upload.service.ts:60`
- 修复建议：
  1. 增加基于文件内容（魔数）的服务端校验，不仅依赖 `mimetype`。
  2. 由服务端识别结果决定扩展名，不使用原始文件名后缀。
  3. 上传到 OSS 时显式设置安全 `Content-Type`（仅允许 image/*）。
  4. 若使用 `OSS_CUSTOM_DOMAIN`，建议与主站域名隔离。

### 2) 前端手动设置 multipart Content-Type（中）

- 现状：上传请求手动设置 `Content-Type: multipart/form-data`。
- 风险：可能导致 boundary 异常，兼容性不稳定。
- 证据：`frontend/src/lib/upload.ts:16`
- 修复建议：删除该 header，让浏览器/axios 自动注入。

### 3) OSS 上传失败错误码语义偏差（中）

- 现状：上传异常统一抛 `BadRequestException`。
- 风险：第三方服务失败被误报为客户端错误，排障和监控语义不准确。
- 证据：`backend/src/modules/upload/upload.service.ts:70`
- 修复建议：按异常场景映射为 `InternalServerErrorException` 或更细分错误。

### 4) 自定义域名未规范化处理（中）

- 现状：`OSS_CUSTOM_DOMAIN` 直接拼接 URL。
- 风险：若配置包含协议，可能形成重复协议 URL（如 `https://https://...`）。
- 证据：`backend/src/modules/upload/upload.service.ts:77`
- 修复建议：对配置值做协议剥离或标准化后再拼接。

### 5) ObjectURL 生命周期兜底（低）

- 现状：上传流程中有释放 `ObjectURL`，但未见组件卸载兜底清理。
- 风险：极端交互路径下可能有残留对象 URL。
- 证据：`frontend/src/components/AvatarUpload.vue:55`
- 修复建议：在组件卸载时增加兜底 `URL.revokeObjectURL` 清理。

### 6) 上传模块缺少自动化测试（低）

- 现状：后端 `test/` 下暂无 upload 相关 e2e。
- 风险：上传安全校验与降级逻辑缺少回归保护。
- 修复建议：至少新增 4 类用例：
  1. 非法类型拒绝
  2. 超过 2MB 拒绝
  3. 非白名单目录拒绝
  4. OSS 未配置时返回友好错误

## 正面实践

- 上传能力模块化清晰（`UploadModule` 独立）。
- 前后端双层大小/类型校验与目录白名单方向正确。
- 头像上传组件化后，`ProfileSection` 复杂度明显下降。

## 建议修复顺序

1. 先修复高优先级：服务端文件内容校验 + 扩展名生成策略。
2. 修复前端上传请求头与后端异常语义。
3. 增加自定义域名规范化处理。
4. 补齐上传相关 e2e 回归测试。

## 补充意见确认（本轮）

### 1) 文件魔数校验为阻塞级（确认）

- 结论：同意，必须合并前修复。
- 说明：仅依赖 `file.mimetype` 等同于缺少真实类型校验，攻击者可伪造 `Content-Type` 上传任意文件。
- 建议：引入 `file-type` 基于 magic bytes 识别真实类型；识别失败直接拒绝，不回退信任 `mimetype`。

### 2) FormData 手动设置 multipart 头为经典坑（确认）

- 结论：同意，属于最小改动修复。
- 说明：axios 发送 `FormData` 会自动附带 boundary，手动设置 `Content-Type: multipart/form-data` 可能覆盖 boundary，导致后端解析异常。
- 建议：删除 `frontend/src/lib/upload.ts` 中手动 `Content-Type` 设置。

### 3) OSS 故障错误码语义（确认）

- 结论：同意。
- 说明：第三方服务故障应归类为服务端错误（5xx），不应返回 400 误导前端。
- 建议：将上传失败异常改为 `InternalServerErrorException`（或按错误类型细化映射）。

### 4) 自定义域名拼接规范化（确认）

- 结论：同意。
- 说明：若环境变量包含协议，直接拼接可能出现重复协议。
- 建议：使用 URL 规范化处理，或最小改动采用 `replace(/^https?:\/\//, '')` 后再拼接。

### 5) #5 与 #6 优先级（确认）

- 结论：同意当前优先级划分。
- 说明：`ObjectURL` 兜底清理与 upload e2e 补齐重要但不阻塞，可进入后续迭代。
