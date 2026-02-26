# 协议模块

## 模块职责

管理用户协议（用户服务协议、隐私政策）的内容维护和用户签署记录。

## 架构设计

### 后端

| 文件 | 职责 |
|------|------|
| `src/modules/agreement/agreement.controller.ts` | 协议路由（查询、签署） |
| `src/modules/agreement/agreement.service.ts` | 协议业务逻辑 + 启动时 seed 默认数据 |
| `src/modules/agreement/agreement.entity.ts` | 协议内容实体 |
| `src/modules/agreement/agreement-sign.entity.ts` | 签署记录实体 |
| `src/modules/agreement/agreement.dto.ts` | DTO + 协议类型枚举 |
| `src/modules/agreement/agreement.module.ts` | 模块声明，导出 AgreementService 供 AuthModule 使用 |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/views/auth/RegisterView.vue` | 注册页含协议勾选和弹窗查看 |
| `frontend/src/lib/agreements.ts` | 协议 API 封装（`getAgreement`） |
| `frontend/src/types/index.ts` | Agreement、AgreementSign 类型定义 |

## 数据库设计

### agreements 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) PK | UUIDv7 |
| type | varchar | 协议类型（`user-terms` / `privacy-policy`） |
| title | varchar | 协议标题 |
| version | varchar | 版本号（语义化） |
| content | text | 协议正文（Markdown） |
| effectiveDate | timestamp | 生效日期 |
| createdAt | timestamp | 创建时间 |

### agreement_signs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) PK | UUIDv7 |
| userId | varchar FK | 用户 ID |
| agreementType | varchar | 协议类型 |
| version | varchar | 签署的协议版本 |
| signedAt | timestamp | 签署时间 |

## 核心功能

### 1. Seed 默认协议

- `OnModuleInit` 时幂等写入"用户服务协议"和"隐私政策"的 v1.0.0 数据
- **实现**: `agreement.service.ts:seedDefaults()`

### 2. 注册自动签署

- 用户注册成功后，AuthService 调用 `autoSignOnRegister(userId)` 自动签署两种协议
- 签署失败（如 seed 未就绪）不阻塞注册流程，仅记录警告日志

### 3. 协议查询

- `GET /agreements/:type` — 按类型查询最新版本协议内容（无需登录）
- 前端注册页点击"用户服务协议"/"隐私政策"链接时调用，在 Dialog 中展示

### 4. 手动签署

- `POST /agreements/sign` — 签署指定类型协议（需登录）
- Upsert 逻辑：同一用户同一类型存在记录则更新版本和签署时间

### 5. 签署记录查询

- `GET /agreements/signed` — 查询当前用户所有签署记录（需登录）

## 路由设计

| 方法 | 路由 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/agreements/signed` | JWT | 查询当前用户签署记录 |
| GET | `/agreements/:type` | 无 | 获取协议内容（按类型） |
| POST | `/agreements/sign` | JWT | 签署协议 |

注意：`/agreements/signed` 声明在 `/agreements/:type` 之前，避免路径冲突。

## 前端交互

注册页的协议勾选流程：
1. 用户点击"用户服务协议"/"隐私政策"链接
2. 打开 Dialog，加载协议内容
3. 勾选 Checkbox 后才能提交注册
4. 注册成功后后端自动签署，无需前端额外调用

## 接口文档

详细接口参数和返回值见 Swagger：`/api-docs`（Tags: 协议）
