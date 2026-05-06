# EventAccount — 线上活动报名与管理平台

> 仿 [Luma](https://lu.ma) 的线上活动一站式服务平台,覆盖活动创建、报名、签到、社区运营全流程。

---

## 运行演示

项目仅支持本地运行，无线上部署。按照下方「快速开始」步骤启动前后端服务后访问 `http://localhost:5173`。

---

## 技术栈

### 前端 (`frontend/`)

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue | 3.5 | 渐进式 UI 框架(Composition API) |
| TypeScript | 5.9 | strict mode + `noUncheckedIndexedAccess` |
| Vite | 7.3 | 构建 / Dev Server |
| Tailwind CSS | 4.2 | CSS 变量驱动主题 |
| shadcn-vue | new-york / zinc | 无样式组件 + 业务化封装 |
| Pinia | 3.0 | 全局状态(认证、用户) |
| Vue Router | 4.6 | 前端路由 + 路由守卫 |
| vee-validate + zod | 4.15 / 3.25 | 表单校验 |
| Axios | 1.13 | HTTP + 拦截器(JWT、401 自动登出) |
| @tanstack/vue-table | 8.21 | 管理端数据表格 |
| Playwright | 1.58 | 端到端测试 |

### 后端 (`backend/`)

| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | 11.0 | 模块化服务框架 |
| TypeScript | 5.7 | strict mode |
| TypeORM | 0.3 | ORM + 迁移 + 事务 |
| PostgreSQL | 15+ | 主数据库 |
| Redis (ioredis) | 5.8 | 验证码、限流计数 |
| Passport + JWT | 11.0 / 4.0 | 认证(Cookie 携带 JWT) |
| class-validator + Joi | 0.14 / 18.0 | DTO / 配置校验 |
| @nestjs/throttler | 6.5 | 接口级限流 |
| Swagger (`@nestjs/swagger`) | 11.2 | API 文档 |
| 阿里云 OSS / SMS | - | 图片上传 / 短信验证码 |
| bcrypt | 6.0 | 密码哈希(12 轮) |
| Jest + Supertest | 30.0 / 7.0 | 单元 / E2E 测试 |

---

## 项目模块总览

平台采用模块化全栈开发模式,每个模块包含独立的前后端实现。以下列出全部业务模块及职责边界:

| 模块 | 职责 | 负责人 |
|------|------|--------|
| **认证模块** | 注册/登录(密码/短信/邮箱)/找回密码/会话管理 | ✅ 我 |
| **个人中心** | 账号设置、资料编辑、安全变更(换绑手机/邮箱/密码)、注销 | ✅ 我 |
| **发现模块** | 活动探索、社区浏览、城市发现、分类订阅、多维筛选搜索 | ✅ 我 |
| **落地页** | 首页/About/Features/Help/Terms/Privacy 未登录访客入口 | ✅ 我 |
| **活动管理** | 活动创建/发布/编辑/复制/取消、票务管理、报名与支付、签到、协办人 | 团队协作 |
| **社区管理** | 社区创建/成员管理/内容管理/日历视图 | 团队协作 |
| **管理后台** | 用户管理、活动审核、标签管理、系统配置、内容审核 | 团队协作 |
| **通知系统** | 站内通知、邮件通知、群发消息、报名确认触达 | 团队协作 |

> ✅ 标记的模块由我**端到端独立完成**:从 API 接口设计、数据库表结构、并发安全、再到前端组件设计、状态管理、E2E 测试。以下为详细设计说明。

---

## 我负责的模块详细设计

### 1. 个人中心模块(账号设置)

> 用户登录后的自管理入口。前端路由 `/settings/*`,后端路由 `/users/me/*` + `/users/:id`。详见 [`docs/account-settings-架构文档.md`](docs/account-settings-架构文档.md)。

**前端 Vue3 组件设计**

- `SettingsLayout.vue`:左导航 + 右内容的两栏壳布局
- `ProfileSection.vue`:个人资料编辑(头像 / 昵称 / 个性签名),头像 URL 防抖 600ms 校验 + `<img>` 实时预览
- `SecuritySection.vue` + 4 个 Dialog 组件:`ChangePasswordDialog` / `ChangePhoneDialog` / `ChangeEmailDialog` / `DeleteAccountDialog`(注销需手动输入"删除账号"确认文本)
- `AppearanceSection.vue`:亮色 / 暗色 / 跟随系统三档主题
- 抽离 `useTheme` / `useCountdown` / `useSmsCountdown` / `useEmailCountdown` 四个 Composable 复用倒计时与主题逻辑
- 头像上传:基于 shadcn-vue 自定义 `Avatar` + 文件类型 / 大小前置校验

**后端 API 设计**

- 拆分 `UserController` 与 `UserAccountController` 两个控制器,前者走 `/users/:id`(`ParseUUIDPipe` + 本人校验),后者走 `/users/me`(JWT payload 直接定位用户),路由注册顺序保证 `/me` 不被 `:id` 捕获
- 拆分 `UserService`(基础 CRUD)与 `UserSecurityService`(安全变更),职责分离
- **换绑手机/邮箱的事务化流程**:Redis 验证码消耗 → DB 事务内冲突检查 + 写入,消除 TOCTOU 竞态
- PG 23505 唯一约束兜底 + `@Match` 自定义装饰器(在 DTO 层完成 `confirmPassword` 比对,Controller 保持薄)
- 限流:`@Throttle(5, 60)` 装饰修改密码 / 换绑手机 / 换绑邮箱接口
- Entity 层 `password` 字段 `select: false` + `toSelfDto()` 显式映射形成双重保险
- 上传服务基于**文件魔数(magic bytes)**校验真实图片类型,不信任客户端 mimetype

### 2. 落地页(Landing Page,未登录访客入口)

> 首页 / About / Features / Help / Terms / Privacy 共 6 个页面。详见 [`docs/landing-page-架构文档.md`](docs/landing-page-架构文档.md)。

**前端 Vue3 组件设计**

- `LandingView` / `AboutView` / `FeaturesView` / `HelpView` / `AgreementView` 五个页面容器
- `LandingNav` / `LandingHero` / `LandingFeatures` / `LandingCta` / `LandingFooter` 五个组合子组件
- **认证状态感知 CTA**:导航栏与 Hero 的按钮文案 + 跳转目标根据 `auth.isLoggedIn` 动态切换("登录" ↔ "进入平台")
- **首屏无闪烁**:路由守卫 `beforeEach` 调用 `auth.ensureSessionChecked()`,组件挂载前完成 Cookie 会话校验
- **协议页路由复用**:`/terms` 与 `/privacy` 共用 `AgreementView.vue`,通过 `props` 传入类型;Markdown 渲染 + DOMPurify 消毒避免 XSS
- 动态 `document.title` + meta description,组件卸载时还原
- `/:pathMatch(.*)*` 兜底重定向到首页

### 3. 发现模块(用户端首页)

> 平台流量入口,承载活动探索、社区浏览、城市发现、分类订阅四大能力。前端路由 `/discover`、`/discover/calendars`、`/discover/category/:slug`、`/communities/:slug`、`/event/:id`。详见 [`docs/discover-架构文档.md`](docs/discover-架构文档.md)。

**前端 Vue3 组件设计**

- 视图层:`DiscoverView` / `CalendarsDiscoverView` / `CategoryDiscoverView` / `CommunityDetailView` / `EventDetailView`
- 抽离三个 Composable 解耦关注点:
  - `useDiscoverFilters`(217 行):筛选状态 ↔ URL Query 双向同步,支持后退/前进恢复
  - `useDiscoverSearch`(174 行):350ms 防抖 + `AbortController` 取消旧请求,避免请求竞态导致结果错乱
  - `useRecentSearches`:localStorage 搜索历史(最多 10 条,可点击 / 可删除)
- 子组件:`DiscoverEventCard` / `CommunityCard` / `FilterSummaryBar`(可单项移除筛选标签) / `SectionHeader`(板块标题 + View All 深链)
- 社区详情页支持"列表 / 日历 / 地图"三视图切换
- E2E 覆盖搜索、路由深链、筛选联动、社区详情、日历分页 6 个 spec 文件,共计 12+ 个用例

**后端 API 设计**

- 新增 `GET /events` 多维筛选:`keyword` / `city` / `categoryId` / `dateStart` / `dateEnd` / `locationType` / `sortBy`
  - QueryBuilder 动态拼接 + `escapeLike()` 转义 + `ESCAPE '\\'`,杜绝通配符注入
  - **安全默认值**:未传 status 时强制 `status = 'published' AND visibility = 'public'`,防止草稿与私密活动泄露
  - 三种排序策略:`latest`(创建时间) / `upcoming`(未来活动正序) / `trending`(门票销量子查询)
- 新增 `GET /events/cities` 城市聚合:**单条 SQL** 用 `SUM(CASE WHEN ILIKE :param THEN 1 ELSE 0 END)` 替代 N 次 COUNT,把 19 次查询降为 1 次
- 活动生命周期事务化:`publish` / `cancel` / `delete` 在 `dataSource.transaction()` 内原子更新 `Category.eventCount`,取消使用 `GREATEST(eventCount - 1, 0)` 防负数
- **报名并发安全**(关键改造):`register` / `cancel` / `approve` / `reject` / `promoteWaitlisted` 全部上 `pessimistic_write` 悲观锁
  - 报名:事务内锁活动行 → 容量检查 → 锁门票行 → 名额检查 → 创建记录 → `soldCount++`
  - 取消 + 候补递补放在**同一事务**内,消除"取消释放名额 → 双倍递补"的竞态窗口
  - 候补递补用 `Math.min(count, quantity - soldCount)` 计算安全数量,即使锁内仍多重防超卖
- `GET /registrations/:id/confirmation` 从公开接口改造为 JWT + 本人 / 创建者权限校验,防信息泄露

---

## 项目结构

```
EventAccount/
├── frontend/    # Vue 3 + shadcn-vue + Tailwind v4
├── backend/     # NestJS + TypeORM + PostgreSQL + Redis
└── docs/        # 架构文档、需求方案、审查报告
```

更细的目录约定见 [`frontend/README.md`](frontend/README.md) 和 [`backend/README.md`](backend/README.md)。

---

## 快速开始

### 环境要求

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

### 启动步骤

```bash
# 1. 克隆
git clone <repo-url> && cd EventAccount

# 2. 安装依赖
cd backend  && npm install
cd ../frontend && npm install

# 3. 配置 .env
cd ../backend && cp .env.example .env  # 配置 PG / Redis / OSS / 短信

# 4. 数据库迁移
npm run build && npm run migration:run

# 5. 启动(两个终端)
npm run dev                    # backend → :3000
cd ../frontend && npm run dev  # frontend → :5173
```

Windows 用户可在根目录直接运行 `start.bat` 一键启动。

API 文档:启动后端后访问 `http://localhost:3000/api/docs`(Swagger)。

---

## 我学到了什么

### 1. 验证码的消耗顺序决定了用户体验

`fe88696` 换绑手机/邮箱时，最初把「验证码校验」放在第一步，导致用户输完验证码才发现手机号已被占用。改成**先查冲突 → 再消耗验证码 → 最后写入**，把注定失败的请求拦在验证码校验之前。验证码是有成本的（短信费、邮箱额度），**不要把有成本的校验浪费在注定失败的路径上**。

### 2. 魔法数字必须提取为语义常量，否则审查时永远找不到

`28aaecd` 审查时发现多处硬编码 `'23505'`（PostgreSQL 唯一约束冲突码）。这个字符串在 Service 层、测试文件里各写了一遍，新来的开发者根本不知道什么意思。提取为 `PG_UNIQUE_VIOLATION` 常量后，IDE 跳转就能找到所有使用处，也杜绝了手滑写错数字的隐患。

### 3. `@Length(6, 6)` 和 `@Matches(/^\d{6}$/)` 不是一回事

`28aaecd` 把验证码校验从 `@Length(6, 6)` 改成 `@Matches(/^\d{6}$/)`。前者允许 `"aaaaaa"`，只是限制长度；后者才是真正的「6 位数字」。**校验规则的语义必须精确匹配业务定义**，模糊的校验等于没校验。

### 4. URL 校验要限制协议，否则 `file://` 也能过

`28aaecd` 头像 URL 字段的 `@IsUrl()` 默认接受任何协议。改成 `@IsUrl({ require_protocol: true, protocols: ['http', 'https'] })` 后，`javascript:alert(1)` 和 `file:///etc/passwd` 都会被拦截。**开放输入的字段，校验条件越具体越好**。

### 5. 文件类型校验必须读内容，不能信 MIME 类型

`7a703b8` 上传模块最初只校验 `file.mimetype`，但浏览器填写的 MIME 是客户端给的，改个后缀就能伪造。改成**基于文件魔数（magic bytes）检测真实类型**——读取 Buffer 的前几个字节，匹配 JPEG 的 `0xFFD8FF`、PNG 的 `0x89504E47` 等签名。**客户端声称的任何东西都不可信，包括 MIME 类型**。

### 6. 目录参数要白名单校验，否则就是路径注入

`7a703b8` 上传接口接收 `?directory=avatars` 参数。如果不校验，攻击者传入 `directory=../../etc` 就能让文件写到任意位置。用 `ALLOWED_DIRECTORIES = ['avatars', 'covers']` 白名单拦截，**用户可控的路径片段必须限定在预设集合内**。

### 7. 公开接口必须强制安全默认值，不能相信客户端传的过滤条件

`aa0a4ec` 发现页活动列表接口最初接收 `status` 参数，客户端不传就返回所有状态。这会导致**草稿活动暴露给未登录用户**。改为公开接口强制 `status = 'published' AND visibility = 'public'`，客户端传入的 `status` 参数直接 `void` 掉。**公开数据的查询，安全条件必须硬编码在服务端**，不能把决定权交给客户端。

### 8. `LIKE` 通配符必须转义，否则就是 SQL 注入

`aa0a4ec` 搜索关键词用 `event.title ILIKE :keyword`，但用户输入 `%` 或 `_` 就会匹配所有记录。修复：先用 `escapeLike()` 把 `%` → `\%`、`_` → `\_`，再拼上 `ESCAPE '\'`。**任何拼进 SQL 的字符串，通配符都要转义**，这是最容易被忽视的注入面。

### 9. 取消和候补递补必须在同一个事务内，锁释放就是竞态窗口

`aa0a4ec` 报名取消后触发候补递补。最初两者是分开的：先事务内取消（释放名额），再事务外调用 `promoteWaitlisted()`。这两个操作之间哪怕只有 1ms，也可能被另一个并发取消看到「有 2 个空位」，导致双倍递补超卖。改成**取消和候补递补放在同一事务内，通过 `EntityManager` 传递悲观锁上下文**，锁覆盖整个业务单元。

### 10. 候补递补也要做多重容量检查，锁内再锁内也不能100%信任

`aa0a4ec` 候补递补时，活动行已经上了悲观锁，但门票行没有。如果 3 个候补用户都关联同一张限量门票，直接 `soldCount += 3` 可能超卖。修复：在事务内**再锁门票行**，用 `Math.min(count, quantity - soldCount)` 计算安全递补数量。**悲观锁不是免死金牌，锁内仍要业务校验**。

### 11. N 次 COUNT 可以合并成 1 条 SUM(CASE WHEN) SQL

`aa0a4ec` 发现页城市聚合最初用 `for (city of cities) { await count(...) }`，19 个城市 = 19 次查询。改成单条 SQL：每个城市一个 `SUM(CASE WHEN locationName ILIKE :city THEN 1 ELSE 0 END)`，**19 次查询降为 1 次**。`select([])` 清除默认实体列，避免 SUM 无 GROUP BY 时 PostgreSQL 报错。

---

## 代码规范

- **最简原则** — 不做冗余设计
- **禁止 `any`** — TypeScript strict mode,前后端均开启
- **改前先读** — 完整阅读相关文件再动手
- **改后必测** — 后端写 E2E,前端写 Playwright
- **中文注释 / 英文命名** — commit、文档、注释中文;变量、函数、类英文

---

## 文档

| 文档 | 说明 |
|------|------|
| [`docs/项目需求.md`](docs/项目需求.md) | 整体需求说明 |
| [`docs/account-settings-架构文档.md`](docs/account-settings-架构文档.md) | 个人中心模块架构 |
| [`docs/landing-page-架构文档.md`](docs/landing-page-架构文档.md) | 落地页架构 |
| [`docs/discover-架构文档.md`](docs/discover-架构文档.md) | 发现模块架构 |
| [`docs/auth-架构文档.md`](docs/auth-架构文档.md) | 认证模块架构 |
| [`docs/event-架构文档.md`](docs/event-架构文档.md) | 活动模块架构 |
| [`docs/notification-架构文档.md`](docs/notification-架构文档.md) | 通知模块架构 |
| [`docs/admin-架构文档.md`](docs/admin-架构文档.md) | 管理后台架构 |
| [`docs/协作规范.md`](docs/协作规范.md) | 团队协作规范 |

---

## 许可证

UNLICENSED
