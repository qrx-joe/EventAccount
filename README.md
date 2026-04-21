# T3 Program — 线上活动报名与管理平台

仿照 [Luma](https://lu.ma)，面向一线及新一线城市的线上活动报名与管理平台，提供活动创建、报名、签到等一站式服务。

---

## 目录结构

```
t3-program/
├── frontend/    # Vue 3 + shadcn-vue + Tailwind CSS v4
├── backend/     # NestJS + TypeORM + PostgreSQL
└── docs/        # 项目文档（需求方案、架构设计、执行方案等）
```

---

## 技术栈

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.5+ | 渐进式前端框架 |
| TypeScript | 5.9+ | 类型安全，strict 模式 |
| Vite | 7+ | 构建工具 |
| Tailwind CSS | v4 | 原子化 CSS |
| shadcn-vue | - | UI 组件库（new-york / zinc 风格） |
| Pinia | 3+ | 状态管理 |
| Vue Router | 4+ | 前端路由 |
| Axios | - | HTTP 客户端 |
| vee-validate + zod | - | 表单校验 |
| Playwright | - | E2E 测试 |

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| NestJS | 11+ | Node.js 服务端框架 |
| TypeScript | 5.7+ | strict 模式 |
| TypeORM | 0.3+ | ORM 框架 |
| PostgreSQL | - | 关系型数据库 |
| Redis | - | 缓存 / 验证码存储 |
| JWT | - | 身份认证 |
| Jest | 30+ | 单元测试 / E2E 测试 |

---

## 功能模块

| 模块 | 功能说明 |
|------|---------|
| **用户认证** | JWT 登录/注册、角色权限（RBAC）、密码找回 |
| **用户管理** | 个人信息、账户安全、偏好设置 |
| **活动管理** | 活动创建/编辑/发布、门票配置、联合主办 |
| **活动报名** | 报名表单、名额限制、候补机制 |
| **支付** | 订单管理、支付流程 |
| **签到** | 二维码签到、扫码入场 |
| **发现页** | 活动搜索、城市筛选、分类筛选、时间筛选 |
| **社区** | 社区创建、成员管理 |
| **日历** | 日历订阅、活动同步 |
| **通知** | 邮件通知、短信通知 |
| **文件上传** | 图片/封面上传（阿里云 OSS） |
| **协议条款** | 用户协议、隐私政策版本管理 |

---

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 1. 克隆仓库

```bash
git clone https://github.com/qrx-joe/EventAccount.git
cd EventAccount
```

### 2. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

### 3. 配置环境变量

```bash
# 后端
# 复制 .env.example 为 .env，并根据实际情况配置数据库、Redis、OSS、短信等

cd backend
cp .env.example .env
```

### 4. 数据库迁移

```bash
cd backend
npm run build
npm run migration:run
```

### 5. 启动开发服务器

```bash
# 后端（端口默认 3000）
cd backend
npm run dev

# 前端（端口默认 5173）
cd frontend
npm run dev
```

前端通过 `/api` 代理到后端，访问 http://localhost:5173 即可。

### Windows 一键启动

```bash
# 在项目根目录
start.bat
```

---

## 常用命令

### 前端

```bash
cd frontend

npm run dev              # 启动开发服务器
npm run build            # 类型检查 + 生产构建
npm run type-check       # 仅类型检查
npm run lint             # ESLint 检查并自动修复
npm run lint:check       # ESLint 仅检查
npm run format           # Prettier 格式化
npm run test:e2e         # Playwright E2E 测试
npm run test:e2e:discover    # 发现模块 E2E 测试
```

### 后端

```bash
cd backend

npm run dev              # 启动开发服务器（带热重载）
npm run build            # 生产构建
npm run lint             # ESLint 检查并自动修复
npm run lint:check       # ESLint 仅检查
npm run test             # Jest 单元测试
npm run test:e2e         # E2E 测试
npm run test:cov         # 测试覆盖率
npm run migration:run    # 执行数据库迁移
npm run migration:revert # 回滚上一次迁移
npm run seed:themes      # 初始化活动主题数据
```

---

## API 规范

前后端共用统一响应体结构：

```typescript
{
  success: boolean    // 业务是否成功
  code: number        // HTTP 状态码（200/201/4xx/5xx）
  message: string     // 提示信息
  data: T | null      // 成功时为数据，失败时为 null
  timestamp: string   // ISO 8601 时间戳
}
```

后端 Swagger 文档启动后访问：`http://localhost:3000/api/docs`

---

## 代码规范

- **最简原则** — 不做冗余设计，只对必要的多可能事件做冗余
- **禁止 any** — TypeScript strict mode，前后端均开启
- **改前先读** — 完整阅读相关文件再动手
- **改后必测** — 后端做完整接口测试，前端做端到端测试
- **中文注释** — 代码注释、commit message、文档一律中文
- **英文命名** — 变量/函数/类名用英文

---

## 测试

### 前端 E2E（Playwright）

```bash
cd frontend
npm run test:e2e              # 无头模式运行全部测试
npm run test:e2e:headed       # 有头模式（可视化浏览器）
npm run test:e2e:discover     # 仅运行发现模块测试
```

### 后端 E2E（Jest + Supertest）

```bash
cd backend
npm run test:e2e              # 运行全部 E2E 测试
npm run test:e2e -- test/event-discover-query.e2e-spec.ts   # 仅运行指定测试
```

---

## 文档

项目文档位于 `docs/` 目录，包含：

| 文档 | 说明 |
|------|------|
| `项目需求.md` | 整体需求说明 |
| `auth-架构文档.md` | 认证模块架构 |
| `event-架构文档.md` | 活动模块架构 |
| `discover-架构文档.md` | 发现模块架构 |
| `notification-架构文档.md` | 通知模块架构 |
| `admin-架构文档.md` | 管理后台架构 |
| `协作规范.md` | 团队协作规范 |

---

## 贡献指南

1. 基于 `develop` 分支创建功能分支：`git checkout -b feature/xxx`
2. 遵循现有代码风格和命名规范
3. 确保代码通过类型检查和 lint
4. 补充对应测试用例
5. 提交 Pull Request 到 `develop` 分支

---

## 许可证

UNLICENSED
