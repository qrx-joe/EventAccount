# T3 Program Frontend

> 📦 **存档说明**：本文件为 `frontend/README.md` 在 2026-05-05 重写为简历友好版本之前的旧版备份。
> 当前 GitHub 主页展示的 README 见仓库 `frontend/README.md`。

---

前端基于 Vue 3 + TypeScript + Vite，负责活动发现、活动详情、社区日历与用户端交互。

## 常用命令

- `npm run dev`：启动开发服务器
- `npm run build`：类型检查并构建
- `npm run type-check`：仅做 TypeScript 类型检查
- `npm run lint`：ESLint 自动修复
- `npm run lint:check`：ESLint 检查

## E2E 测试命令

- `npm run test:e2e`：运行全部 Playwright 用例
- `npm run test:e2e:headed`：有头模式运行全部用例
- `npm run test:e2e:discover`：运行发现模块专用回归用例

## 发现模块 E2E 结构

- `e2e/discover-search.spec.ts`：发现页搜索与关键词透传
- `e2e/discover-routing.spec.ts`：分页与深链路由
- `e2e/discover-filters.spec.ts`：筛选标签移除与 URL 同步
- `e2e/helpers/discover-mocks.ts`：发现模块 mock 逻辑
- `e2e/helpers/discover-fixtures.ts`：发现模块 mock 夹具常量

当前 discover 回归目标是稳定可复现，不依赖线上数据状态。
