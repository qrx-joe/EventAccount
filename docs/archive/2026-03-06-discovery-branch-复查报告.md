# Discovery 分支复查报告（前后端）

## 审查信息

- 审查时间：2026-03-06
- 审查分支：`discovery`
- 审查方式：
  - 已加载并按 `vue-code-review` 技能对前端进行复查
  - 已加载并按 `nestjs-code-reviewer` 技能对后端进行复查
- 审查范围（发现模块核心）：
  - 前端：`src/views/discover/*`、`src/lib/events.ts`、`src/lib/categories.ts`、`src/router/index.ts`、`src/types/index.ts`、`e2e/discover-*.spec.ts`
  - 后端：`src/modules/event/event.controller.ts`、`src/modules/event/event.dto.ts`、`src/modules/event/event.service.ts`、`test/event-discover-query.e2e-spec.ts`、`docs/discover.md`

## 结论概览

- 总体结论：**功能链路可用，发现页主流程与新增 e2e 用例均可通过，但 lint 质量门未通过，且存在 1 个明确行为与文档不一致问题。**
- 风险等级：**中**
- 问题统计：
  - 严重（阻断 CI/合并）：2
  - 一般（建议尽快修复）：2
  - 建议优化：3

---

## 一、验证结果（构建 / Lint / 测试）

### 1) 前端（Vue）

- `npm run build`：✅ 通过
- `npm run test:e2e:discover`：✅ 通过（6/6）
- `npm run lint:check`：❌ 未通过
  - `src/views/discover/DiscoverView.vue:55`
  - `src/views/discover/DiscoverView.vue:164`
  - 报错：`'AbortController' is not defined (no-undef)`

### 2) 后端（NestJS）

- `npm run build`：✅ 通过
- `npm run test:e2e -- test/event-discover-query.e2e-spec.ts`：✅ 通过（5/5）
- `npm run lint:check`：❌ 未通过（Prettier 格式问题）
  - `src/modules/event/event.service.ts:60`
  - `src/modules/event/event.service.ts:212`
  - `src/modules/event/event.service.ts:230`
  - `test/event-discover-query.e2e-spec.ts:223`

---

## 二、问题清单

## 🚨 严重问题（必须修复）

### 1. 前端 lint 失败，合并门禁阻断

- 位置：`frontend/src/views/discover/DiscoverView.vue:55`、`frontend/src/views/discover/DiscoverView.vue:164`
- 现象：直接使用 `AbortController` 触发 ESLint `no-undef`。
- 影响：CI lint 阶段失败，分支无法稳定合入。
- 建议：统一采用项目认可的浏览器全局类型声明策略，或通过显式全局对象访问方式规避 `no-undef`。

### 2. 后端 lint 失败，代码规范门禁阻断

- 位置：`backend/src/modules/event/event.service.ts:60`、`backend/src/modules/event/event.service.ts:212`、`backend/src/modules/event/event.service.ts:230`、`backend/test/event-discover-query.e2e-spec.ts:223`
- 现象：Prettier 规则不满足。
- 影响：CI lint 阶段失败，分支无法稳定合入。
- 建议：按仓库规范执行一次无语义变更的格式化修正并复跑 lint。

## ⚠️ 一般问题（建议尽快修复）

### 3. `upcoming` 排序语义与文档不一致

- 位置：`backend/src/modules/event/event.service.ts:229`
- 现象：`sortBy=upcoming` 仅按 `startTime ASC` 排序，**未限制“未来活动”**。
- 证据：`backend/docs/discover.md:44` 文档写明“upcoming（开始时间正序，仅未来）”。
- 影响：用户可能看到已结束活动排在“即将开始”列表中，预期被破坏。
- 建议：补充 `startTime >= now` 的显式过滤，或修正文档语义二选一，避免长期漂移。

### 4. 城市匹配策略为大小写敏感且依赖字符串包含

- 位置：`backend/src/modules/event/event.service.ts:212`、`backend/src/modules/event/event.service.ts:275`
- 现象：使用 `LIKE` 与 `includes` 做文本匹配，英文城市对大小写和别名容错弱。
- 影响：例如 `new york` / `New York`、`SF` / `San Francisco` 等检索体验不稳定。
- 建议：统一大小写归一或改为不区分大小写匹配策略，并补充边界测试样例。

## 💡 优化建议（可排期）

### 5. 公开 API 类型声明过于宽泛

- 位置：`backend/src/modules/event/event.controller.ts:142`
- 现象：`getDiscoverCityRegions` 返回 `ApiResponseDto<unknown>`。
- 建议：收敛为明确 DTO/接口类型，提升 Swagger 可读性与前后端契约约束力。

### 6. 发现路由存在双入口，信息架构可进一步收敛

- 位置：`frontend/src/router/index.ts:80` 与 `frontend/src/router/index.ts:105`
- 现象：`/calendars` 与 `/discover/calendars` 指向同一页面。
- 影响：路径语义重复，后续埋点、SEO、分享链接规范容易分叉。
- 建议：明确 canonical path，并统一站内跳转策略。

### 7. 分类页缺少 URL 查询态同步，深链能力弱于日历页

- 位置：`frontend/src/views/discover/CategoryDiscoverView.vue`
- 现象：`keyword/page` 不入 URL，刷新与分享后状态不可复现。
- 建议：对齐 `CalendarsDiscoverView.vue` 的 query 同步策略，保证跨页面一致体验。

---

## 三、做得好的地方

- 前端发现模块链路完整：搜索、防抖、取消请求、筛选 chips、路由深链、E2E 覆盖形成闭环。
- 后端查询能力扩展方向正确：`city/date/locationType/sortBy` 参数齐全，且新增城市聚合接口。
- 发现模块回归测试质量较好：
  - 后端新增 `event-discover-query.e2e-spec.ts`，覆盖组合筛选、时间范围、排序、城市聚合。
  - 前端新增 3 组 discovery E2E，覆盖筛选、路由、搜索历史关键交互。
- 文档意识较强：`backend/docs/discover.md` 已补模块职责与核心能力说明。

---

## 四、建议修复优先级

1. **P0（立即）**：修复前后端 lint 失败（否则分支质量门不过）。
2. **P1（本迭代）**：解决 `upcoming` 语义与实现不一致问题（代码或文档必须一致）。
3. **P1（本迭代）**：增强城市匹配容错（大小写/别名）。
4. **P2（下迭代）**：收敛 API 类型声明、统一路由 canonical、补齐分类页 URL 状态同步。

---

## 五、复查结论

当前 `discovery` 分支在“可运行”和“核心场景可测”方面表现良好，但还**不满足可合并质量线**（lint 未通过）。建议先完成 P0/P1，再进入合并流程。
