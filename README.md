# EventAccount — 线上活动报名与管理平台

> 仿 [Luma](https://lu.ma) 的线上活动一站式服务平台,覆盖活动创建、报名、签到、社区运营全流程。

---

## 在线演示

> ⚠️ 占位 — 部署后请替换以下内容
>
> - **线上地址**:`<待补充>`
> - **测试账号**:手机号 `<待补充>` / 验证码 `<待补充>`

### 功能截图

| 模块 | 截图 |
|------|------|
| 落地页(未登录) | `docs/screenshots/landing.png` *(待补充)* |
| 发现页(用户端首页) | `docs/screenshots/discover.png` *(待补充)* |
| 活动详情页 | `docs/screenshots/event-detail.png` *(待补充)* |
| 个人中心 - 账号设置 | `docs/screenshots/account-settings.png` *(待补充)* |

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

## 我负责的部分

> 项目以模块为单位拆分协作。下列三个模块由我**端到端独立完成**:从 API 接口设计、数据库表结构、并发安全、再到前端组件设计、状态管理、E2E 测试。

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

### 1. 错误的设计要果断回滚，不要在上面堆补丁

`2474f16` 给短信登录加了「未注册用户自动注册」，看起来减少了注册步骤，但半小时后的 `62c143b` 就回滚了。回滚原因：自动注册会让用户产生「我还没注册怎么登录成功了」的困惑，与密码登录的「未注册拒绝」行为不一致，还导致 `.gitignore` 漏掉了 `.env.dev`。教训是**不确认的设计不要上线**，发现方向错了立刻回滚，而不是继续打补丁把它「修好」。

### 2. 数据规范化必须在入库前做，不能信客户端

`db8e0ab` 修复了一个隐蔽 bug：用户输入 `"Joe@Example.com "`（带空格和大写）注册后，再用 `"joe@example.com"` 登录匹配失败。修复是在所有接收邮箱的 DTO 上加 `@Transform` 做 `trim + toLowerCase`，同时在 `UserService` 里增加 `normalizeEmail()` 统一兜底。客户端、浏览器自动填充、中间转发环节都可能变形数据，**规范化必须在最接近数据库的那一层完成**。

### 3. 本地方便的默认值，上了生产就是漏洞

`72b6ffc` 的 S-01：JWT 验证策略里写死了 `secretOrKey: config.get('JWT_SECRET') || 'fallback-secret'`。本地开发确实能跑，但万一生产环境变量没配，任何人都能用 `fallback-secret` 签发合法 Token。改成「缺失 `JWT_SECRET` 直接 throw Error，服务拒绝启动」。安全相关的配置必须是**要么配好，要么死掉**，不存在「凑活用」的选项。

### 4. 404 会泄露资源存在性，越权应该返回 403

`772334d` 修复 P1 问题：用户 A 访问 `/users/:id` 时，如果 `id` 存在但不属于 A，原来可能返回 404。攻击者可以批量枚举 UUID——返回 404 表示「资源不存在」，返回 403 表示「资源存在但你无权访问」。改为统一抛 `ForbiddenException`，**无论资源是否存在，越权一律 403**，杜绝信息泄露。

### 5. 锁要覆盖整个业务单元，不能只锁一步

`aa0a4ec` 把报名流程从「先查容量再 INSERT」改成 `pessimistic_write` 悲观锁全链路。最初以为锁了活动行就够了，但 `4c95c08` 又补了一刀：候补递补时不仅要锁活动行，还要锁门票行，并用 `Math.min(count, quantity - soldCount)` 做容量安全检查。取消和候补递补必须放在**同一事务**内，否则锁释放后会有「两个候补同时看到空位」的竞态窗口。锁的粒度不是「有就行」，而是**要覆盖整个业务决策链**。

### 6. 防抖不是「少发请求」，而是「发对的请求」

`8628581` 修复头像 URL 输入：用户每输入一个字符 `<img>` 就尝试加载一次图片，输到第 10 个字符时已经发了 10 个 404 请求。改成 600ms 防抖后，用户停手才加载。这个教训让我意识到，**防抖优化的目标不是减少请求数量，而是让请求发生在用户真正完成输入的时刻**。站在交互时序上想问题，而不是站在代码执行次数上。

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
