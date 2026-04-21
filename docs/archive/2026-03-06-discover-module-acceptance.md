# 发现模块验收测试与补完计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 对已实现的发现模块（首页展示、活动详情页、社区详情页）进行端到端验收测试，修复发现的问题，补完缺失功能。

**Architecture:** 先启动前后端服务，用 Playwright 浏览器自动化逐页面做冒烟测试和交互验证，记录所有 bug 和体验问题；然后按优先级修复问题、补完缺失功能（地图视图、社区创建者信息）；最后编写覆盖性 E2E 测试用例并补写模块文档。

**Tech Stack:** Vue 3 + shadcn-vue + Tailwind CSS v4（前端）、NestJS + TypeORM + PostgreSQL（后端）、Playwright（E2E 测试）

---

## Phase 1: 环境准备与冒烟验证

### Task 1: 启动前后端服务并验证 API 联通

**Files:**
- 无文件变更（环境验证）

**Step 1: 启动后端服务**

```bash
cd D:/code/Account/backend
npm run start:dev &
```

等待控制台输出 `Nest application successfully started`。

**Step 2: 验证核心 API 可用**

```bash
# 活动列表
curl -s "http://localhost:3000/api/events?status=published&limit=3" | python -m json.tool | head -20

# 分类列表
curl -s "http://localhost:3000/api/categories?limit=3" | python -m json.tool | head -20

# 城市区域数据
curl -s "http://localhost:3000/api/events/discover/city-regions" | python -m json.tool | head -20
```

预期：三个接口均返回 `{ success: true, data: ... }`。

**Step 3: 启动前端服务**

```bash
cd D:/code/Account/frontend
npm run dev &
```

等待 Vite 输出 `Local: http://localhost:5173/`。

**Step 4: 验证前端代理正常**

```bash
curl -s "http://localhost:5173/api/events?status=published&limit=1" | python -m json.tool | head -10
```

预期：返回后端数据（非 404 或 HTML）。

---

## Phase 2: Playwright 逐页面验收测试

### Task 2: 发现首页（DiscoverView）E2E 验收

**Files:**
- Test: `frontend/e2e/discover-acceptance.spec.ts`

**Step 1: 编写发现首页验收测试**

```typescript
import { test, expect } from '@playwright/test'

test.describe('发现首页验收', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/discover')
    await page.waitForLoadState('networkidle')
  })

  test('页面核心元素完整渲染', async ({ page }) => {
    // 页面标题
    await expect(page.getByRole('heading', { level: 1 })).toContainText('发现活动')

    // 搜索框
    await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible()

    // 城市输入
    await expect(page.locator('input[placeholder*="城市"]')).toBeVisible()
  })

  test('热门活动板块数据加载', async ({ page }) => {
    // 等待热门活动板块出现
    const trendingSection = page.locator('section').filter({
      has: page.getByText('热门活动'),
    })

    // 板块应可见（无论有无数据）
    await expect(trendingSection.or(page.getByText('暂无活动'))).toBeVisible()
  })

  test('精选社区板块数据加载', async ({ page }) => {
    const communitySection = page.locator('section').filter({
      has: page.getByText('精选社区'),
    })
    await expect(communitySection.or(page.getByText('暂无社区'))).toBeVisible()
  })

  test('按类别浏览板块显示', async ({ page }) => {
    // 类别浏览区域应存在
    const categorySection = page.locator('section').filter({
      has: page.getByText(/按类别|分类浏览|浏览类别/),
    })
    await expect(categorySection.or(page.getByText('暂无分类'))).toBeVisible()
  })

  test('搜索功能正常工作', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="搜索"]')
    await searchInput.fill('测试活动')
    await page.getByRole('button', { name: '搜索' }).first().click()

    // URL 应包含关键词参数
    await expect(page).toHaveURL(/keyword=/)
  })

  test('城市筛选功能正常工作', async ({ page }) => {
    const cityInput = page.locator('input[placeholder*="城市"]')
    await cityInput.fill('上海')
    await page.getByRole('button', { name: '搜索' }).first().click()

    await expect(page).toHaveURL(/city=/)
  })

  test('探索本地活动区域存在', async ({ page }) => {
    // 城市探索区域
    const cityExplorer = page.getByText(/探索.*城市|城市探索|本地活动/)
    await expect(cityExplorer).toBeVisible()
  })

  test('页面无控制台错误', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/discover')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 过滤掉已知的无害错误（如 favicon 404）
    const realErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR'),
    )
    expect(realErrors).toEqual([])
  })
})
```

**Step 2: 运行测试验证**

```bash
cd D:/code/Account/frontend
npx playwright test e2e/discover-acceptance.spec.ts --headed
```

预期：观察页面渲染情况，记录失败用例。

**Step 3: 截图记录当前页面状态**

```bash
cd D:/code/Account/frontend
npx playwright test e2e/discover-acceptance.spec.ts --update-snapshots
```

---

### Task 3: 活动详情页（EventDetailView）E2E 验收

**Files:**
- Test: `frontend/e2e/event-detail-acceptance.spec.ts`

**Step 1: 编写活动详情页验收测试**

```typescript
import { test, expect } from '@playwright/test'

test.describe('活动详情页验收', () => {
  // 需要先从发现页获取一个真实的活动 ID
  let eventId: string

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/events?status=published&limit=1')
    const json = await res.json()
    eventId = json.data?.items?.[0]?.id ?? ''
  })

  test('活动详情页完整渲染', async ({ page }) => {
    test.skip(!eventId, '数据库中无已发布活动，跳过')

    await page.goto(`/events/${eventId}`)
    await page.waitForLoadState('networkidle')

    // 活动海报/封面区域
    const coverOrTitle = page.locator('h1, img[alt*="封面"], img[alt*="cover"]').first()
    await expect(coverOrTitle).toBeVisible()
  })

  test('活动基本信息展示', async ({ page }) => {
    test.skip(!eventId, '数据库中无已发布活动，跳过')

    await page.goto(`/events/${eventId}`)
    await page.waitForLoadState('networkidle')

    // 日期信息
    await expect(page.getByText(/\d{4}/).first()).toBeVisible()

    // 地点信息（线上或线下）
    const locationInfo = page.getByText(/线上|线下|地点|Location/).first()
    await expect(locationInfo).toBeVisible()
  })

  test('报名状态显示', async ({ page }) => {
    test.skip(!eventId, '数据库中无已发布活动，跳过')

    await page.goto(`/events/${eventId}`)
    await page.waitForLoadState('networkidle')

    // 报名按钮或报名状态
    const registrationElement = page
      .getByRole('button', { name: /报名|申请|Register|加入/ })
      .or(page.getByText(/已报名|审核中|名额已满|已结束/))
    await expect(registrationElement.first()).toBeVisible()
  })

  test('相关活动推荐区域', async ({ page }) => {
    test.skip(!eventId, '数据库中无已发布活动，跳过')

    await page.goto(`/events/${eventId}`)
    await page.waitForLoadState('networkidle')

    // 滚动到底部查看相关推荐
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(1000)

    // 相关活动区域（可能没有数据，但区域应存在）
    const relatedSection = page.getByText(/相关活动|推荐活动|你可能感兴趣/)
    // 不强制要求存在，记录是否显示即可
  })

  test('不存在的活动 ID 应优雅处理', async ({ page }) => {
    await page.goto('/events/nonexistent-id-12345')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // 应该显示错误提示或跳转（不应白屏）
    const body = await page.locator('body').textContent()
    expect(body?.length).toBeGreaterThan(10)
  })
})
```

**Step 2: 运行测试**

```bash
npx playwright test e2e/event-detail-acceptance.spec.ts --headed
```

---

### Task 4: 社区详情页（CommunityDetailView）E2E 验收

**Files:**
- Test: `frontend/e2e/community-detail-acceptance.spec.ts`

**Step 1: 编写社区详情页验收测试**

```typescript
import { test, expect } from '@playwright/test'

test.describe('社区详情页验收', () => {
  let communitySlug: string

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/categories?limit=1')
    const json = await res.json()
    communitySlug = json.data?.items?.[0]?.slug ?? ''
  })

  test('社区基本信息展示', async ({ page }) => {
    test.skip(!communitySlug, '数据库中无社区数据，跳过')

    await page.goto(`/communities/${communitySlug}`)
    await page.waitForLoadState('networkidle')

    // 社区名称
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // 订阅人数
    await expect(page.getByText('订阅人数')).toBeVisible()

    // 创建时间
    await expect(page.getByText('创建时间')).toBeVisible()

    // 社区简介（描述文字或默认占位文案）
    const description = page.getByText(/汇聚|欢迎订阅/).or(page.locator('.text-muted-foreground').first())
    await expect(description).toBeVisible()
  })

  test('订阅社区按钮可见', async ({ page }) => {
    test.skip(!communitySlug, '数据库中无社区数据，跳过')

    await page.goto(`/communities/${communitySlug}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /订阅社区/ })).toBeVisible()
  })

  test('加入社区按钮可见', async ({ page }) => {
    test.skip(!communitySlug, '数据库中无社区数据，跳过')

    await page.goto(`/communities/${communitySlug}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: /加入社区/ })).toBeVisible()
  })

  test('社区创建者信息区域可见', async ({ page }) => {
    test.skip(!communitySlug, '数据库中无社区数据，跳过')

    await page.goto(`/communities/${communitySlug}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('社区创建者信息')).toBeVisible()
  })

  test('活动列表视图正常', async ({ page }) => {
    test.skip(!communitySlug, '数据库中无社区数据，跳过')

    await page.goto(`/communities/${communitySlug}`)
    await page.waitForLoadState('networkidle')

    // 默认是列表视图
    const listTab = page.getByRole('tab', { name: '活动列表' })
    await expect(listTab).toBeVisible()
    await expect(listTab).toHaveAttribute('data-state', 'active')
  })

  test('日历视图切换正常', async ({ page }) => {
    test.skip(!communitySlug, '数据库中无社区数据，跳过')

    await page.goto(`/communities/${communitySlug}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: '日历视图' }).click()
    // 日历内容区域应可见
    const calendarContent = page.getByText(/暂无可展示/).or(page.locator('[role="tabpanel"]').nth(1))
    await expect(calendarContent).toBeVisible()
  })

  test('地图视图切换正常', async ({ page }) => {
    test.skip(!communitySlug, '数据库中无社区数据，跳过')

    await page.goto(`/communities/${communitySlug}`)
    await page.waitForLoadState('networkidle')

    await page.getByRole('tab', { name: '地图视图' }).click()
    // 地图内容区域应可见（当前是聚合统计文本）
    const mapContent = page.getByText(/暂无地点|地点聚合|V1/).or(page.locator('[role="tabpanel"]').nth(2))
    await expect(mapContent).toBeVisible()
  })

  test('不存在的社区 slug 应优雅处理', async ({ page }) => {
    await page.goto('/communities/nonexistent-slug-xyz')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // 应该跳转到 /discover 或显示错误（根据代码逻辑）
    const url = page.url()
    const hasRedirected = url.includes('/discover')
    const hasError = await page.getByText(/加载.*失败/).isVisible().catch(() => false)
    expect(hasRedirected || hasError).toBeTruthy()
  })
})
```

**Step 2: 运行测试**

```bash
npx playwright test e2e/community-detail-acceptance.spec.ts --headed
```

---

### Task 5: 社区日历页和分类详情页 E2E 验收

**Files:**
- Test: `frontend/e2e/calendars-category-acceptance.spec.ts`

**Step 1: 编写测试**

```typescript
import { test, expect } from '@playwright/test'

test.describe('社区日历页验收', () => {
  test('页面加载并显示分类列表', async ({ page }) => {
    await page.goto('/discover/calendars')
    await page.waitForLoadState('networkidle')

    // 页面标题
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // 搜索框
    await expect(page.locator('input[placeholder*="搜索"]')).toBeVisible()
  })

  test('分类卡片点击可跳转', async ({ page }) => {
    await page.goto('/discover/calendars')
    await page.waitForLoadState('networkidle')

    // 找到第一个"查看活动"按钮并点击
    const viewButton = page.getByRole('button', { name: '查看活动' }).first()
    if (await viewButton.isVisible()) {
      await viewButton.click()
      await page.waitForLoadState('networkidle')
      // 应跳转到分类详情页
      await expect(page).toHaveURL(/\/discover\/category\//)
    }
  })
})

test.describe('分类详情页验收', () => {
  let categorySlug: string

  test.beforeAll(async ({ request }) => {
    const res = await request.get('/api/categories?limit=1')
    const json = await res.json()
    categorySlug = json.data?.items?.[0]?.slug ?? ''
  })

  test('分类详情页显示活动列表', async ({ page }) => {
    test.skip(!categorySlug, '无分类数据，跳过')

    await page.goto(`/discover/category/${categorySlug}`)
    await page.waitForLoadState('networkidle')

    // 分类名称标题
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // 活动数量提示
    await expect(page.getByText(/共\s*\d+\s*场活动/).or(page.getByText('暂无活动'))).toBeVisible()
  })
})
```

**Step 2: 运行测试**

```bash
npx playwright test e2e/calendars-category-acceptance.spec.ts --headed
```

---

## Phase 3: 整理验收结果并修复问题

### Task 6: 运行全部验收测试，整理问题清单

**Files:**
- 无文件变更（分析任务）

**Step 1: 运行全部发现模块测试**

```bash
cd D:/code/Account/frontend
npx playwright test e2e/discover-acceptance.spec.ts e2e/event-detail-acceptance.spec.ts e2e/community-detail-acceptance.spec.ts e2e/calendars-category-acceptance.spec.ts --reporter=list 2>&1 | tee e2e/acceptance-report.txt
```

**Step 2: 分析失败用例，分类问题**

根据测试结果，将问题分为三类：
- **P0 阻断型**: 页面白屏、API 404、路由死循环
- **P1 功能缺失**: 任务清单中要求但未实现的功能
- **P2 体验问题**: 样式错乱、交互不流畅、边界情况处理

**Step 3: 记录问题到验收报告**

在 `e2e/acceptance-report.txt` 末尾手动追加问题分类和修复优先级。

---

## Phase 4: 已知缺失功能补完

### Task 7: 社区详情页 — "订阅"和"加入"按钮语义重复修复

**Files:**
- Modify: `frontend/src/views/community/CommunityDetailView.vue:226-233`

**问题分析:** 当前页面有两个按钮："订阅社区" 和 "加入社区"，都调用 `toggleSubscribe()`，语义重复。参照 Luma 的社区模式，应只保留"订阅社区"（关注动态），或将"加入社区"改为导航到报名入口。

**Step 1: 修改按钮区域**

将两个重复按钮合并为一个语义明确的操作：

```vue
<div class="mt-6 flex flex-wrap gap-3">
  <Button :disabled="isSubscribing" @click="toggleSubscribe">
    {{ isSubscribed ? '已订阅' : '订阅社区' }}
  </Button>
</div>
```

**Step 2: 验证修改效果**

```bash
npx playwright test e2e/community-detail-acceptance.spec.ts --headed
```

**Step 3: Commit**

```bash
git add frontend/src/views/community/CommunityDetailView.vue
git commit -m "fix: 移除社区详情页重复的加入按钮，保留单一订阅操作"
```

---

### Task 8: 根据 Phase 2 验收结果修复所有 P0/P1 问题

**Files:**
- 根据验收报告确定

**Step 1: 逐项修复 P0 阻断型问题**

根据 Task 6 的验收报告，逐个修复页面白屏、API 对接错误等阻断问题。每修复一个后运行对应的测试用例验证。

**Step 2: 逐项修复 P1 功能缺失问题**

补完任务清单中要求但测试失败的功能点。

**Step 3: 每次修复后 commit**

```bash
git add <修改的文件>
git commit -m "fix: <具体修复描述>"
```

---

## Phase 5: 补写模块文档

### Task 9: 编写发现模块后端架构文档

**Files:**
- Create: `backend/docs/api/modules/discover.md`

**Step 1: 编写文档**

参照已有的 `backend/docs/auth.md` 风格，编写发现模块文档，涵盖：
- 模块职责（首页聚合、活动浏览、社区浏览）
- 架构设计（涉及的 Controller、Service、Entity 位置）
- 核心功能（活动查询、分类筛选、城市探索、订阅机制）
- 数据库关联（Event、Category、Registration 表关系）
- 接口文档（引用 Swagger）

**Step 2: Commit**

```bash
git add backend/docs/api/modules/discover.md
git commit -m "docs: 新增发现模块架构文档"
```

---

### Task 10: 最终回归测试

**Files:**
- 无文件变更

**Step 1: 运行全部 E2E 测试**

```bash
cd D:/code/Account/frontend
npx playwright test --reporter=list
```

**Step 2: 确认全部通过**

预期：所有测试用例通过，无 flaky test。

**Step 3: 截图存档**

```bash
npx playwright test e2e/discover-acceptance.spec.ts --headed --screenshot=on
```

将截图保存到 `e2e/screenshots/` 目录，作为验收证据。
