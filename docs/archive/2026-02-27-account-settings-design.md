# 个人中心模块设计文档

## 概述

- **任务**: 个人中心模块（设置-账号）
- **范围**: 前端设置页面 + 后端 3 个新接口
- **风格**: Luma 风格，顶栏头像下拉 + 独立设置页侧边栏导航

## 页面入口

顶栏右上角头像下拉菜单（DropdownMenu），包含"设置"和"退出登录"。所有已登录页面共用 `AppHeader` 组件。

## 路由设计

```
/settings                → 重定向到 /settings/profile
/settings/profile        → 个人资料
/settings/security       → 账号安全
/settings/appearance     → 外观偏好
```

嵌套路由，`SettingsLayout.vue` 作为容器（左侧导航 + 右侧 RouterView）。

## 文件结构

```
src/
├── components/
│   └── AppHeader.vue              # 全局顶栏（头像下拉菜单）
├── views/
│   └── settings/
│       ├── SettingsLayout.vue      # 侧边栏 + RouterView 容器
│       └── components/
│           ├── ProfileSection.vue      # 个人资料
│           ├── SecuritySection.vue     # 账号安全
│           └── AppearanceSection.vue   # 外观偏好
```

需要新增 shadcn-vue 组件：`dropdown-menu`

## 各子页面设计

### 个人资料（ProfileSection）

| 字段 | 组件 | 校验 | 备注 |
|------|------|------|------|
| 头像 | 圆形预览 + Input（URL） | URL 格式，可选 | 第一期 URL 输入 |
| 昵称 | Input | 1-64 字符，必填 | |
| 个性签名 | Input | 0-200 字符，可选 | |

- 进入页面时 `getMe()` 加载数据预填表单
- 保存调用 `PUT /users/:id`，成功后刷新 store

### 账号安全（SecuritySection）

四个功能区块，每行：标题 + 当前状态 + 操作按钮

| 功能 | 状态显示 | 操作 | 交互 |
|------|---------|------|------|
| 修改密码 | 无 | 修改 | Dialog：旧密码 + 新密码 + 确认密码 |
| 手机号 | 138****8000 | 换绑 | Dialog：新手机号 + 短信验证码 |
| 邮箱 | 已绑定/未绑定 | 绑定/换绑 | Dialog：新邮箱 + 邮箱验证码 |
| 注销账号 | 无 | 注销（destructive） | AlertDialog：输入"删除账号"确认 |

### 外观偏好（AppearanceSection）

- 三档：亮色 / 暗色 / 跟随系统
- 操作 `document.documentElement.classList`，存 localStorage
- 纯前端，零后端依赖

## 新增后端接口

### PUT /api/users/:id/password — 修改密码

| 字段 | 类型 | 校验 |
|------|------|------|
| oldPassword | string | 必填 |
| newPassword | string | 6-128 位 |
| confirmPassword | string | 与 newPassword 一致 |

逻辑：验证本人 → bcrypt 比对旧密码 → 新旧不同 → 更新

### PUT /api/users/:id/phone — 换绑手机号

| 字段 | 类型 | 校验 |
|------|------|------|
| newPhone | string | 手机号格式 |
| smsCode | string | 6 位验证码 |

逻辑：验证本人 → 校验验证码（type: bind-phone）→ 新手机号未被占用 → 更新

### PUT /api/users/:id/email — 换绑邮箱

| 字段 | 类型 | 校验 |
|------|------|------|
| newEmail | string | 邮箱格式 |
| emailCode | string | 6 位验证码 |

逻辑：验证本人 → 校验验证码（type: bind-email）→ 新邮箱未被占用 → 更新

### 验证码类型扩展

| 新增 type | 发送端点 | 用途 |
|-----------|---------|------|
| bind-phone | POST /api/auth/sms/send | 换绑手机号 |
| bind-email | POST /api/auth/email/send | 换绑邮箱 |

## 技术方案

### 前端

- 严格使用 CSS 变量，不用直接彩色 Tailwind 类
- 表单使用 vee-validate + zod
- 验证码倒计时复用 `useSmsCountdown` composable
- 响应式：移动端侧边栏折叠为顶部 tab

### 后端

- 新接口放在 `UserController`，使用 JWT Guard + 本人校验
- DTO 校验使用 class-validator
- 验证码校验复用 `VerificationService.verifyCode()`
- 所有敏感操作接口加 `@Throttle` 限流

### 数据与状态

- 前端 `useAuthStore` 中的 user 数据在资料更新后需要 refetch
- 主题偏好存 localStorage，不经过后端
