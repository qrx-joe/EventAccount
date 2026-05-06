const { chromium } = require('playwright-core')
const path = require('path')

const BASE_URL = 'http://[::1]:5173'
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots')

function ok(data) {
  return {
    success: true,
    code: 200,
    message: 'ok',
    data,
    timestamp: new Date().toISOString(),
  }
}

const mockUser = {
  id: 'mock-user-id',
  nickname: 'Demo User',
  avatar: null,
  email: 'demo@example.com',
  phone: '13800138000',
  bio: '这是一个演示账号',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const mockCategory = {
  id: 'mock-category-id',
  name: '技术社区',
  slug: 'tech-community',
  description: '技术交流与分享',
  coverImage: null,
  eventCount: 12,
  subscriberCount: 156,
  sortOrder: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const mockEvent = {
  id: 'mock-event-1',
  creatorId: 'mock-creator',
  categoryId: mockCategory.id,
  title: 'Vue 3 进阶实战工作坊',
  description: '深入探讨 Vue 3 Composition API、性能优化与最佳实践',
  coverImage: null,
  startTime: '2026-05-20T14:00:00.000Z',
  endTime: '2026-05-20T17:00:00.000Z',
  timezone: 'Asia/Shanghai',
  locationType: 'offline',
  locationName: '上海市',
  locationAddress: '浦东新区张江高科技园区',
  latitude: 31.2304,
  longitude: 121.4737,
  onlineLink: null,
  visibility: 'public',
  requireApproval: false,
  capacity: 100,
  status: 'published',
  publishedAt: '2026-03-01T10:00:00.000Z',
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
  creator: {
    id: 'mock-creator',
    nickname: '活动组织者',
    avatar: null,
  },
  category: mockCategory,
  tags: [{ id: 'tag-1', name: 'Vue' }, { id: 'tag-2', name: '前端' }],
}

const mockCategories = [
  mockCategory,
  {
    id: 'mock-cat-2',
    name: '设计沙龙',
    slug: 'design-salon',
    description: 'UI/UX 设计交流',
    coverImage: null,
    eventCount: 8,
    subscriberCount: 89,
    sortOrder: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mock-cat-3',
    name: '产品经理',
    slug: 'product-manager',
    description: '产品思维与方法论',
    coverImage: null,
    eventCount: 5,
    subscriberCount: 67,
    sortOrder: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

const mockEvents = [
  mockEvent,
  {
    ...mockEvent,
    id: 'mock-event-2',
    title: 'TypeScript 类型体操挑战赛',
    description: '挑战你的 TypeScript 类型系统极限',
    startTime: '2026-05-25T10:00:00.000Z',
    endTime: '2026-05-25T12:00:00.000Z',
    locationName: '北京市',
    locationAddress: '海淀区中关村',
    tags: [{ id: 'tag-3', name: 'TypeScript' }],
  },
  {
    ...mockEvent,
    id: 'mock-event-3',
    title: 'AI 驱动的前端开发新范式',
    description: '探索 AI 如何改变前端开发工作流',
    startTime: '2026-06-01T09:00:00.000Z',
    endTime: '2026-06-01T11:00:00.000Z',
    locationName: '深圳市',
    locationAddress: '南山区科技园',
    tags: [{ id: 'tag-4', name: 'AI' }],
  },
]

const mockTickets = [
  {
    id: 'ticket-1',
    eventId: 'mock-event-1',
    name: '普通票',
    description: '标准入场资格',
    price: 0,
    quantity: 100,
    soldCount: 67,
    status: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'ticket-2',
    eventId: 'mock-event-1',
    name: 'VIP 票',
    description: '含专属座位与茶歇',
    price: 199,
    quantity: 20,
    soldCount: 15,
    status: 'active',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
]

const mockCities = {
  regions: [
    {
      name: '华北地区',
      cities: [
        { name: '北京', count: 45 },
        { name: '天津', count: 12 },
      ],
    },
    {
      name: '华东地区',
      cities: [
        { name: '上海', count: 78 },
        { name: '杭州', count: 34 },
        { name: '南京', count: 28 },
      ],
    },
    {
      name: '华南地区',
      cities: [
        { name: '深圳', count: 56 },
        { name: '广州', count: 43 },
      ],
    },
  ],
}

async function setupMockRoutes(page) {
  await page.route('**/api/categories**', async (route) => {
    const url = route.request().url()
    if (url.includes('/subscribe')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(null)) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ok({ items: mockCategories, total: mockCategories.length, page: 1, pageSize: 20, totalPages: 1 })),
    })
  })

  await page.route('**/api/events/cities', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(mockCities)) })
  })

  await page.route('**/api/events**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ok({ items: mockEvents, total: mockEvents.length, page: 1, pageSize: 6, totalPages: 1 })),
    })
  })

  await page.route('**/api/events/mock-event-1**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(mockEvent)) })
  })

  await page.route('**/api/events/mock-event-1/tickets', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(mockTickets)) })
  })

  await page.route('**/api/events/mock-event-1/registration-form', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([])) })
  })

  await page.route('**/api/users/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(mockUser)) })
  })

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(null)) })
  })

  // 兜底：其他 API 请求返回空数据
  await page.route('**/api/**', async (route) => {
    const alreadyHandled = [
      '/categories', '/events/cities', '/events/mock-event-1', '/events**',
      '/users/me', '/auth/logout',
    ]
    const url = route.request().url()
    // 如果上面没有匹配到，继续（让真实请求走或返回空）
    await route.continue()
  })
}

async function takeScreenshot(browser, name, urlPath, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  if (!options.noMock) {
    await setupMockRoutes(page)
  }

  if (options.loggedIn) {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-token-for-screenshot')
    })
  }

  const url = `${BASE_URL}${urlPath}`
  console.log(`[screenshot] navigating to ${url}`)

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
  } catch (e) {
    console.log(`[screenshot] networkidle timeout for ${name}, trying domcontentloaded`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
  }

  // 额外等待以确保渲染完成
  await page.waitForTimeout(2000)

  const outputPath = path.join(OUTPUT_DIR, `${name}.png`)
  await page.screenshot({ path: outputPath, fullPage: true })
  console.log(`[screenshot] saved ${outputPath}`)

  await page.close()
}

;(async () => {
  console.log('Starting screenshots...')

  const browser = await chromium.launch({ headless: true })

  try {
    // 1. 落地页（未登录）
    await takeScreenshot(browser, 'landing', '/', { noMock: true })

    // 2. 发现页
    await takeScreenshot(browser, 'discover', '/discover')

    // 3. 活动详情页
    await takeScreenshot(browser, 'event-detail', '/events/mock-event-1')

    // 4. 个人中心 - 账号设置
    await takeScreenshot(browser, 'account-settings', '/settings', { loggedIn: true })

    console.log('\nAll screenshots done!')
  } catch (err) {
    console.error('Screenshot failed:', err)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
})()
