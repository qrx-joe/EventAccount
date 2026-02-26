# T3 Program 模块文档索引

本文档集中管理后端与前端的模块文档，按业务模块组织，前后端一体化撰写。

## 文档原则

- **文档即代码** — 说明架构思路、设计决策和业务逻辑，不复制代码实现
- **代码位置引用** — 通过 `文件:方法名()` 或 `文件:行号` 指引开发者查看具体实现
- **接口详情见 Swagger** — 接口参数和返回值以 `/api/docs` 自动生成文档为准

## 模块文档

| 模块 | 文档路径 | 说明 |
|------|----------|------|
| 认证 | [`auth.md`](auth.md) | 注册、登录（密码/短信/邮箱）、密码找回 |
| 验证码 | [`verification.md`](verification.md) | 短信/邮箱验证码发送与校验 |
| 用户 | [`user.md`](user.md) | 用户信息管理、邮箱绑定 |
| 协议 | [`agreement.md`](agreement.md) | 用户协议与隐私政策管理 |

## 技术栈概览

| 端 | 技术栈 |
|----|--------|
| 后端 | NestJS + TypeORM + PostgreSQL + JWT + 阿里云 SMS + 阿里云 SMTP |
| 前端 | Vue 3 + TypeScript + shadcn-vue + Tailwind CSS v4 + vee-validate + zod |

## API 文档

启动后端后访问 `/api/docs` 查看 Swagger 自动生成的接口文档。
