# T3 Program — 线上活动报名与管理平台

仿照 Luma.com，面向一线及新一线城市的线上活动报名与管理平台，提供活动创建、报名、签到等一站式服务。

## 项目结构

```
t3-program/
├── frontend/    # Vue 3 + shadcn-vue + Tailwind CSS v4
├── backend/     # NestJS + TypeORM + PostgreSQL
└── doc/         # 项目文档（需求方案等）
```

**前端任务** → 阅读 `frontend/CLAUDE.md`
**后端任务** → 阅读 `backend/CLAUDE.md`

## 通用约定

### 语言

- 代码注释、commit message、文档一律中文
- 变量/函数/类名用英文

### API 契约

前后端共用统一响应体结构（定义在后端 `src/common/dto/api-response.dto.ts`）：

```typescript
{
  success: boolean    // 业务是否成功
  code: number        // HTTP 状态码（200/201/4xx/5xx）
  message: string     // 提示信息
  data: T | null      // 成功时为数据，失败时为 null
  timestamp: string   // ISO 8601 时间戳
}
```

前端类型定义在 `frontend/src/types/index.ts` 中的 `ApiResponse<T>` 必须与此保持一致。

### ID 生成

所有实体 ID 使用后端封装的 UUIDv7 工具类（`backend/src/shared/utils/id-generator.ts`），不使用 PostgreSQL 内置函数。

### 开发环境

- 前后端开发服务器通常已在运行，不需要额外启动
- 前端 Vite dev server 通过 `/api` 代理到后端
- 不做旧代码兼容，不做向后兼容，让问题暴露出来

### 文档规范

- 文档前后端一体化，统一在 `backend/docs/` 目录下按模块名命名（如 `auth.md`、`user.md`）
- 遵循**文档即代码**原则：架构文档写架构思路、设计准则和业务逻辑，代码细节通过注释体现
- 保证文档与代码版本接近，代码变更时同步更新对应模块文档

### 代码原则

- **最简原则** — 不做冗余设计，只对必要的多可能事件做冗余
- **禁止 any** — TypeScript strict mode，前后端均开启
- **改前先读** — 完整阅读相关文件再动手
- **改后必测** — 后端做完整接口测试，前端做端到端测试
