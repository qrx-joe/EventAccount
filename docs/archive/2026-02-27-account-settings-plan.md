# Account Settings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete account settings module with profile editing, security settings (password/phone/email/delete), and appearance preferences.

**Architecture:** Backend adds 3 new endpoints to UserController (change password, bind phone, bind email) plus 2 new verification code types. Frontend creates AppHeader with dropdown menu, SettingsLayout with sidebar navigation, and 3 settings sub-pages. Theme switching is pure frontend via localStorage.

**Tech Stack:** NestJS + TypeORM (backend), Vue 3 + TypeScript + Tailwind CSS v4 + shadcn-vue + vee-validate + zod (frontend)

---

### Task 1: Backend — extend verification code types

**Files:**
- Modify: `D:/code/Account/backend/src/modules/verification/verification.dto.ts`
- Modify: `D:/code/Account/backend/src/modules/verification/verification.service.ts`

**Step 1: Add new enum values**

In `verification.dto.ts`, add `BIND_PHONE` and `BIND_EMAIL` to the enum:

```typescript
export enum VerificationCodeType {
  REGISTER = 'register',
  LOGIN = 'login',
  RESET = 'reset',
  BIND_PHONE = 'bind-phone',
  BIND_EMAIL = 'bind-email',
}
```

**Step 2: Update email subject map**

In `verification.service.ts`, update the `subjectMap` inside `sendEmailCode()`:

```typescript
const subjectMap: Record<VerificationCodeType, string> = {
  [VerificationCodeType.LOGIN]: '登录验证码',
  [VerificationCodeType.RESET]: '密码重置验证码',
  [VerificationCodeType.REGISTER]: '注册验证码',
  [VerificationCodeType.BIND_PHONE]: '换绑手机验证码',
  [VerificationCodeType.BIND_EMAIL]: '换绑邮箱验证码',
}
```

**Step 3: Verify compilation**

Run: `cd D:/code/Account/backend && npx nest build 2>&1 | head -5`
Expected: Build succeeds

**Step 4: Commit**

```bash
cd D:/code/Account/backend
git add src/modules/verification/verification.dto.ts src/modules/verification/verification.service.ts
git commit -m "feat(verification): add bind-phone and bind-email code types"
```

---

### Task 2: Backend — new DTOs for security endpoints

**Files:**
- Modify: `D:/code/Account/backend/src/modules/user/user.dto.ts`

**Step 1: Add 3 new DTOs**

Append after the existing `UserPublicDto` class:

```typescript
/** 修改密码请求体（已登录状态） */
export class ChangePasswordDto {
  @ApiProperty({ description: '当前密码', example: 'oldpass123' })
  @IsString()
  @Length(6, 128)
  oldPassword: string;

  @ApiProperty({ description: '新密码（6-128 位）', example: 'newpass456' })
  @IsString()
  @Length(6, 128)
  newPassword: string;

  @ApiProperty({ description: '确认新密码', example: 'newpass456' })
  @IsString()
  @Length(6, 128)
  confirmPassword: string;
}

/** 换绑手机号请求体 */
export class ChangePhoneDto {
  @ApiProperty({ description: '新手机号', example: '13900139000' })
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  newPhone: string;

  @ApiProperty({ description: '短信验证码（6 位）', example: '123456' })
  @IsString()
  @Length(6, 6)
  smsCode: string;
}

/** 换绑邮箱请求体 */
export class ChangeEmailDto {
  @ApiProperty({ description: '新邮箱', example: 'new@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  newEmail: string;

  @ApiProperty({ description: '邮箱验证码（6 位）', example: '123456' })
  @IsString()
  @Length(6, 6)
  emailCode: string;
}
```

Note: `Matches`, `Length`, `Transform`, `IsEmail` are already imported at the top of the file.

**Step 2: Verify compilation**

Run: `cd D:/code/Account/backend && npx nest build 2>&1 | head -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
cd D:/code/Account/backend
git add src/modules/user/user.dto.ts
git commit -m "feat(user): add DTOs for change password, phone, and email"
```

---

### Task 3: Backend — UserService new methods

**Files:**
- Modify: `D:/code/Account/backend/src/modules/user/user.service.ts`

**Step 1: Add 3 new methods**

Add these methods to the `UserService` class (after `updatePassword`):

```typescript
  /** 修改密码（已登录状态，需验证旧密码） */
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findByIdWithPassword(userId);
    if (!user || !user.password) {
      throw new BadRequestException('当前账号未设置密码');
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('当前密码不正确');
    }

    const isSame = await bcrypt.compare(newPassword, user.password);
    if (isSame) {
      throw new BadRequestException('新密码不能与当前密码相同');
    }

    await this.updatePassword(userId, newPassword);
  }

  /** 换绑手机号 */
  async changePhone(userId: string, newPhone: string): Promise<UserEntity> {
    const existing = await this.findByPhone(newPhone);
    if (existing) {
      throw new ConflictException('该手机号已被其他账号使用');
    }
    await this.userRepo.update(userId, { phone: newPhone });
    this.logger.log(`用户手机号更新成功: ${userId}`);
    return this.findOne(userId);
  }

  /** 换绑邮箱 */
  async changeEmail(userId: string, newEmail: string): Promise<UserEntity> {
    const normalized = this.normalizeEmail(newEmail);
    const existing = await this.findByEmail(normalized);
    if (existing && existing.id !== userId) {
      throw new ConflictException('该邮箱已被其他账号使用');
    }
    await this.userRepo.update(userId, { email: normalized });
    this.logger.log(`用户邮箱更新成功: ${userId}`);
    return this.findOne(userId);
  }
```

Note: `BadRequestException` needs to be added to the imports from `@nestjs/common`.

**Step 2: Verify compilation**

Run: `cd D:/code/Account/backend && npx nest build 2>&1 | head -5`

**Step 3: Commit**

```bash
cd D:/code/Account/backend
git add src/modules/user/user.service.ts
git commit -m "feat(user): add changePassword, changePhone, changeEmail methods"
```

---

### Task 4: Backend — UserController new endpoints

**Files:**
- Modify: `D:/code/Account/backend/src/modules/user/user.controller.ts`
- Modify: `D:/code/Account/backend/src/modules/user/user.module.ts`

**Step 1: Add VerificationService to UserModule imports**

In `user.module.ts`, import VerificationModule so UserController can use VerificationService:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), VerificationModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

Check `verification.module.ts` exports VerificationService. If not, add it.

**Step 2: Add 3 new endpoints to UserController**

Add these imports at the top:

```typescript
import { Throttle } from '@nestjs/throttler';
import { VerificationService } from '../verification/verification.service';
import { VerificationCodeType } from '../verification/verification.dto';
import { ChangePasswordDto, ChangePhoneDto, ChangeEmailDto } from './user.dto';
import { BadRequestException } from '@nestjs/common';
```

Update constructor to inject VerificationService:

```typescript
constructor(
  private readonly userService: UserService,
  private readonly verificationService: VerificationService,
) {}
```

Add these endpoints **before** the dynamic `:id` routes (after `getMe`, before `getPublicProfile`):

```typescript
  /** 修改密码（已登录状态） */
  @ApiOperation({ summary: '修改密码' })
  @ApiResponse({ status: 200, description: '修改成功' })
  @ApiResponse({ status: 400, description: '密码不正确 / 新旧密码相同' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Put('me/password')
  async changePassword(
    @Req() req: { user: JwtPayload },
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponseDto<null>> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('两次输入的密码不一致');
    }
    await this.userService.changePassword(
      req.user.sub,
      dto.oldPassword,
      dto.newPassword,
    );
    return ApiResponseDto.ok(null, '密码修改成功');
  }

  /** 换绑手机号 */
  @ApiOperation({ summary: '换绑手机号' })
  @ApiResponse({ status: 200, description: '换绑成功' })
  @ApiResponse({ status: 400, description: '验证码无效' })
  @ApiResponse({ status: 409, description: '手机号已被使用' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Put('me/phone')
  async changePhone(
    @Req() req: { user: JwtPayload },
    @Body() dto: ChangePhoneDto,
  ): Promise<ApiResponseDto<UserEntity>> {
    const valid = await this.verificationService.verifyCode(
      dto.newPhone,
      VerificationCodeType.BIND_PHONE,
      dto.smsCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }
    const user = await this.userService.changePhone(req.user.sub, dto.newPhone);
    return ApiResponseDto.ok(user, '手机号换绑成功');
  }

  /** 换绑邮箱 */
  @ApiOperation({ summary: '换绑邮箱' })
  @ApiResponse({ status: 200, description: '换绑成功' })
  @ApiResponse({ status: 400, description: '验证码无效' })
  @ApiResponse({ status: 409, description: '邮箱已被使用' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Put('me/email')
  async changeEmail(
    @Req() req: { user: JwtPayload },
    @Body() dto: ChangeEmailDto,
  ): Promise<ApiResponseDto<UserEntity>> {
    const valid = await this.verificationService.verifyCode(
      dto.newEmail,
      VerificationCodeType.BIND_EMAIL,
      dto.emailCode,
    );
    if (!valid) {
      throw new BadRequestException('验证码无效或已过期');
    }
    const user = await this.userService.changeEmail(req.user.sub, dto.newEmail);
    return ApiResponseDto.ok(user, '邮箱换绑成功');
  }
```

**Step 3: Verify compilation**

Run: `cd D:/code/Account/backend && npx nest build 2>&1 | head -5`

**Step 4: Test endpoints with curl**

Start backend, then:

```bash
# Send bind-phone verification code
curl -s -X POST http://localhost:3138/api/auth/sms/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000","type":"bind-phone"}'

# Send bind-email verification code
curl -s -X POST http://localhost:3138/api/auth/email/send \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","type":"bind-email"}'
```

Expected: Both return `{"success":true,...}`

**Step 5: Commit**

```bash
cd D:/code/Account/backend
git add src/modules/user/
git commit -m "feat(user): add change password, phone, email endpoints"
```

---

### Task 5: Frontend — install dropdown-menu + add types

**Files:**
- Modify: `D:/code/Account/frontend/src/types/index.ts`
- Modify: `D:/code/Account/frontend/src/lib/users.ts`

**Step 1: Install dropdown-menu component**

Run: `cd D:/code/Account/frontend && npx shadcn-vue@latest add dropdown-menu`

**Step 2: Add new types**

Append to `src/types/index.ts`:

```typescript
/** 修改密码请求 */
export interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/** 换绑手机号请求 */
export interface ChangePhonePayload {
  newPhone: string
  smsCode: string
}

/** 换绑邮箱请求 */
export interface ChangeEmailPayload {
  newEmail: string
  emailCode: string
}
```

Update `SendSmsCodePayload` and `SendEmailCodePayload` to include new types:

```typescript
export interface SendSmsCodePayload {
  phone: string
  type: 'register' | 'login' | 'reset' | 'bind-phone'
}

export interface SendEmailCodePayload {
  email: string
  type: 'register' | 'login' | 'reset' | 'bind-email'
}
```

**Step 3: Add API functions**

Append to `src/lib/users.ts`:

```typescript
import type {
  ApiResponse,
  UserPublic,
  UserSelf,
  UpdateUserPayload,
  ChangePasswordPayload,
  ChangePhonePayload,
  ChangeEmailPayload,
} from '@/types'

/** 修改密码 */
export async function changePassword(id: string, payload: ChangePasswordPayload): Promise<void> {
  await http.put<ApiResponse<null>>(`/users/${id}/password`, payload)
}

/** 换绑手机号 */
export async function changePhone(id: string, payload: ChangePhonePayload): Promise<UserSelf> {
  const res = await http.put<ApiResponse<UserSelf>>(`/users/${id}/phone`, payload)
  const data = res.data.data
  if (!data) throw new Error('响应数据异常')
  return data
}

/** 换绑邮箱 */
export async function changeEmail(id: string, payload: ChangeEmailPayload): Promise<UserSelf> {
  const res = await http.put<ApiResponse<UserSelf>>(`/users/${id}/email`, payload)
  const data = res.data.data
  if (!data) throw new Error('响应数据异常')
  return data
}
```

Note: Update the existing import at the top of `users.ts` to include the new types.

**Step 4: Verify compilation**

Run: `cd D:/code/Account/frontend && npx vue-tsc --noEmit`

**Step 5: Commit**

```bash
cd D:/code/Account/frontend
git add src/types/index.ts src/lib/users.ts src/components/ui/dropdown-menu/
git commit -m "feat(settings): add security types, API functions, dropdown-menu component"
```

---

### Task 6: Frontend — AppHeader component

**Files:**
- Create: `D:/code/Account/frontend/src/components/AppHeader.vue`
- Modify: `D:/code/Account/frontend/src/views/users/UserListView.vue`

**Step 1: Create AppHeader**

```vue
<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut, User } from 'lucide-vue-next'
import { toast } from 'vue-sonner'

const auth = useAuthStore()
const router = useRouter()

async function handleLogout(): Promise<void> {
  await auth.logout()
  toast.success('已退出登录')
  void router.push({ name: 'login' })
}
</script>

<template>
  <header class="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
    <div class="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
      <RouterLink to="/" class="text-xl font-bold tracking-tight">
        T3 Program
      </RouterLink>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" class="size-9 rounded-full">
            <User class="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-40">
          <DropdownMenuItem as-child>
            <RouterLink to="/settings" class="flex items-center gap-2">
              <Settings class="size-4" />
              设置
            </RouterLink>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="flex items-center gap-2 text-destructive"
            @click="handleLogout"
          >
            <LogOut class="size-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </header>
</template>
```

**Step 2: Replace logout button in UserListView**

In `UserListView.vue`, replace the inline header/logout with `<AppHeader />`. Remove the logout button and its related imports. Add `import AppHeader from '@/components/AppHeader.vue'` and place `<AppHeader />` at the top of the template.

**Step 3: Verify compilation**

Run: `cd D:/code/Account/frontend && npx vue-tsc --noEmit`

**Step 4: Commit**

```bash
cd D:/code/Account/frontend
git add src/components/AppHeader.vue src/views/users/UserListView.vue
git commit -m "feat(settings): add AppHeader with dropdown menu"
```

---

### Task 7: Frontend — SettingsLayout + routes

**Files:**
- Create: `D:/code/Account/frontend/src/views/settings/SettingsLayout.vue`
- Create placeholder: `D:/code/Account/frontend/src/views/settings/components/ProfileSection.vue`
- Create placeholder: `D:/code/Account/frontend/src/views/settings/components/SecuritySection.vue`
- Create placeholder: `D:/code/Account/frontend/src/views/settings/components/AppearanceSection.vue`
- Modify: `D:/code/Account/frontend/src/router/index.ts`

**Step 1: Create SettingsLayout**

```vue
<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { cn } from '@/lib/utils'

const route = useRoute()

const navItems = [
  { to: '/settings/profile', label: '个人资料' },
  { to: '/settings/security', label: '账号安全' },
  { to: '/settings/appearance', label: '外观' },
] as const
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <AppHeader />
    <div class="mx-auto flex max-w-5xl gap-8 px-4 py-8">
      <nav class="w-48 shrink-0">
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.to">
            <RouterLink
              :to="item.to"
              :class="cn(
                'block rounded-md px-3 py-2 text-sm transition-colors',
                route.path === item.to
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )"
            >
              {{ item.label }}
            </RouterLink>
          </li>
        </ul>
      </nav>
      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
```

**Step 2: Create 3 placeholder components**

Each file under `src/views/settings/components/`:

`ProfileSection.vue`:
```vue
<template>
  <div>个人资料</div>
</template>
```

`SecuritySection.vue`:
```vue
<template>
  <div>账号安全</div>
</template>
```

`AppearanceSection.vue`:
```vue
<template>
  <div>外观</div>
</template>
```

**Step 3: Add routes**

In `src/router/index.ts`, add nested settings routes after the `/users` route:

```typescript
{
  path: '/settings',
  component: () => import('@/views/settings/SettingsLayout.vue'),
  meta: { requiresAuth: true },
  children: [
    { path: '', redirect: '/settings/profile' },
    {
      path: 'profile',
      name: 'settings-profile',
      component: () => import('@/views/settings/components/ProfileSection.vue'),
    },
    {
      path: 'security',
      name: 'settings-security',
      component: () => import('@/views/settings/components/SecuritySection.vue'),
    },
    {
      path: 'appearance',
      name: 'settings-appearance',
      component: () => import('@/views/settings/components/AppearanceSection.vue'),
    },
  ],
},
```

**Step 4: Verify compilation**

Run: `cd D:/code/Account/frontend && npx vue-tsc --noEmit`

**Step 5: Commit**

```bash
cd D:/code/Account/frontend
git add src/views/settings/ src/router/index.ts
git commit -m "feat(settings): add SettingsLayout with sidebar navigation and routes"
```

---

### Task 8: Frontend — ProfileSection

**Files:**
- Modify: `D:/code/Account/frontend/src/views/settings/components/ProfileSection.vue`

**Step 1: Implement profile form**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { updateUser } from '@/lib/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'

const auth = useAuthStore()
const loading = ref(false)
const initialLoading = ref(true)

const schema = toTypedSchema(
  z.object({
    avatar: z.string().url('请输入有效的 URL').or(z.literal('')).optional(),
    nickname: z.string().min(1, '昵称至少 1 个字符').max(64, '昵称最多 64 个字符'),
    bio: z.string().max(200, '个性签名最多 200 个字符').optional(),
  }),
)

const { handleSubmit, setValues } = useForm({ validationSchema: schema })

onMounted(async () => {
  const user = auth.user ?? (await auth.fetchUser())
  if (user) {
    setValues({
      avatar: user.avatar ?? '',
      nickname: user.nickname,
      bio: user.bio ?? '',
    })
  }
  initialLoading.value = false
})

const onSubmit = handleSubmit(async (values) => {
  if (!auth.user) return
  loading.value = true
  try {
    await updateUser(auth.user.id, {
      avatar: values.avatar || undefined,
      nickname: values.nickname,
      bio: values.bio || undefined,
    })
    await auth.fetchUser()
    toast.success('资料更新成功')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败，请稍后重试')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold">个人资料</h2>
    <p class="mt-1 text-sm text-muted-foreground">管理你的个人信息</p>

    <div v-if="initialLoading" class="mt-6 space-y-6">
      <Skeleton class="h-10 w-full" />
      <Skeleton class="h-10 w-full" />
      <Skeleton class="h-10 w-full" />
    </div>

    <form v-else class="mt-6 max-w-md space-y-6" @submit="onSubmit">
      <FormField v-slot="{ componentField }" name="avatar">
        <FormItem>
          <FormLabel>头像 URL</FormLabel>
          <FormControl>
            <Input placeholder="https://example.com/avatar.png" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="nickname">
        <FormItem>
          <FormLabel>昵称</FormLabel>
          <FormControl>
            <Input placeholder="输入你的昵称" maxlength="64" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="bio">
        <FormItem>
          <FormLabel>个性签名</FormLabel>
          <FormControl>
            <Input placeholder="介绍一下自己" maxlength="200" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <Button type="submit" :disabled="loading">
        <Loader2 v-if="loading" class="mr-2 size-4 animate-spin" />
        保存
      </Button>
    </form>
  </div>
</template>
```

**Step 2: Verify compilation**

Run: `cd D:/code/Account/frontend && npx vue-tsc --noEmit`

**Step 3: Commit**

```bash
cd D:/code/Account/frontend
git add src/views/settings/components/ProfileSection.vue
git commit -m "feat(settings): implement profile editing section"
```

---

### Task 9: Frontend — SecuritySection

**Files:**
- Modify: `D:/code/Account/frontend/src/views/settings/components/SecuritySection.vue`
- Create: `D:/code/Account/frontend/src/composables/useEmailCountdown.ts`

**Step 1: Create email countdown composable**

```typescript
import { ref, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import { sendEmailCode } from '@/lib/auth'
import type { SendEmailCodePayload } from '@/types'

export function useEmailCountdown(type: SendEmailCodePayload['type']) {
  const emailLoading = ref(false)
  const countdown = ref(0)
  let countdownTimer: ReturnType<typeof setInterval> | null = null

  function cleanup(): void {
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  onUnmounted(cleanup)

  async function handleSendEmail(email: string | undefined): Promise<void> {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('请先输入正确的邮箱地址')
      return
    }
    emailLoading.value = true
    try {
      await sendEmailCode({ email, type })
      toast.success('验证码已发送')
      countdown.value = 60
      countdownTimer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          cleanup()
        }
      }, 1000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '发送失败，请稍后重试')
    } finally {
      emailLoading.value = false
    }
  }

  return { emailLoading, countdown, handleSendEmail }
}
```

**Step 2: Implement SecuritySection**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { changePassword, changePhone, changeEmail, deleteUser } from '@/lib/users'
import { PHONE_REGEX } from '@/lib/validators'
import { useSmsCountdown } from '@/composables/useSmsCountdown'
import { useEmailCountdown } from '@/composables/useEmailCountdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const auth = useAuthStore()
const router = useRouter()

// --- 修改密码 ---
const pwdOpen = ref(false)
const pwdLoading = ref(false)
const pwdSchema = toTypedSchema(
  z.object({
    oldPassword: z.string().min(6, '密码至少 6 位'),
    newPassword: z.string().min(6, '密码至少 6 位').max(128, '密码最多 128 位'),
    confirmPassword: z.string(),
  }).refine((d) => d.newPassword === d.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  }),
)
const pwdForm = useForm({ validationSchema: pwdSchema })
const onPwdSubmit = pwdForm.handleSubmit(async (values) => {
  if (!auth.user) return
  pwdLoading.value = true
  try {
    await changePassword(auth.user.id, values)
    toast.success('密码修改成功')
    pwdOpen.value = false
    pwdForm.resetForm()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    pwdLoading.value = false
  }
})

// --- 换绑手机 ---
const phoneOpen = ref(false)
const phoneLoading = ref(false)
const { smsLoading, countdown: smsCountdown, handleSendSms } = useSmsCountdown('bind-phone')
const phoneSchema = toTypedSchema(
  z.object({
    newPhone: z.string().regex(PHONE_REGEX, '请输入正确的手机号'),
    smsCode: z.string().length(6, '验证码为 6 位数字'),
  }),
)
const phoneForm = useForm({ validationSchema: phoneSchema })
const onPhoneSubmit = phoneForm.handleSubmit(async (values) => {
  if (!auth.user) return
  phoneLoading.value = true
  try {
    await changePhone(auth.user.id, values)
    await auth.fetchUser()
    toast.success('手机号换绑成功')
    phoneOpen.value = false
    phoneForm.resetForm()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    phoneLoading.value = false
  }
})

// --- 换绑邮箱 ---
const emailOpen = ref(false)
const emailBtnLoading = ref(false)
const { emailLoading: emailCodeLoading, countdown: emailCountdown, handleSendEmail } =
  useEmailCountdown('bind-email')
const emailSchema = toTypedSchema(
  z.object({
    newEmail: z.string().email('请输入正确的邮箱'),
    emailCode: z.string().length(6, '验证码为 6 位数字'),
  }),
)
const emailForm = useForm({ validationSchema: emailSchema })
const onEmailSubmit = emailForm.handleSubmit(async (values) => {
  if (!auth.user) return
  emailBtnLoading.value = true
  try {
    await changeEmail(auth.user.id, values)
    await auth.fetchUser()
    toast.success('邮箱换绑成功')
    emailOpen.value = false
    emailForm.resetForm()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    emailBtnLoading.value = false
  }
})

// --- 注销账号 ---
const deleteOpen = ref(false)
const deleteConfirm = ref('')
const deleteLoading = ref(false)
async function handleDelete(): Promise<void> {
  if (!auth.user || deleteConfirm.value !== '删除账号') return
  deleteLoading.value = true
  try {
    await deleteUser(auth.user.id)
    await auth.logout()
    toast.success('账号已注销')
    void router.push({ name: 'landing' })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    deleteLoading.value = false
  }
}

/** 手机号脱敏 */
function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold">账号安全</h2>
    <p class="mt-1 text-sm text-muted-foreground">管理密码、手机号和邮箱</p>

    <div class="mt-6 space-y-0">
      <!-- 修改密码 -->
      <div class="flex items-center justify-between py-4">
        <div>
          <p class="text-sm font-medium">密码</p>
          <p class="text-sm text-muted-foreground">用于密码登录</p>
        </div>
        <Button variant="outline" size="sm" @click="pwdOpen = true">修改</Button>
      </div>
      <Separator />

      <!-- 手机号 -->
      <div class="flex items-center justify-between py-4">
        <div>
          <p class="text-sm font-medium">手机号</p>
          <p class="text-sm text-muted-foreground">
            {{ auth.user?.phone ? maskPhone(auth.user.phone) : '未绑定' }}
          </p>
        </div>
        <Button variant="outline" size="sm" @click="phoneOpen = true">换绑</Button>
      </div>
      <Separator />

      <!-- 邮箱 -->
      <div class="flex items-center justify-between py-4">
        <div>
          <p class="text-sm font-medium">邮箱</p>
          <p class="text-sm text-muted-foreground">
            {{ auth.user?.email ?? '未绑定' }}
          </p>
        </div>
        <Button variant="outline" size="sm" @click="emailOpen = true">
          {{ auth.user?.email ? '换绑' : '绑定' }}
        </Button>
      </div>
      <Separator />

      <!-- 注销账号 -->
      <div class="flex items-center justify-between py-4">
        <div>
          <p class="text-sm font-medium text-destructive">注销账号</p>
          <p class="text-sm text-muted-foreground">永久删除你的账号和所有数据</p>
        </div>
        <Button variant="destructive" size="sm" @click="deleteOpen = true">注销</Button>
      </div>
    </div>

    <!-- 修改密码 Dialog -->
    <Dialog v-model:open="pwdOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>输入当前密码和新密码</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit="onPwdSubmit">
          <FormField v-slot="{ componentField }" name="oldPassword">
            <FormItem>
              <FormLabel>当前密码</FormLabel>
              <FormControl>
                <Input type="password" autocomplete="current-password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="newPassword">
            <FormItem>
              <FormLabel>新密码</FormLabel>
              <FormControl>
                <Input type="password" placeholder="6-128 位" autocomplete="new-password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="confirmPassword">
            <FormItem>
              <FormLabel>确认新密码</FormLabel>
              <FormControl>
                <Input type="password" autocomplete="new-password" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <DialogFooter>
            <Button type="submit" :disabled="pwdLoading">
              <Loader2 v-if="pwdLoading" class="mr-2 size-4 animate-spin" />
              确认修改
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 换绑手机 Dialog -->
    <Dialog v-model:open="phoneOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>换绑手机号</DialogTitle>
          <DialogDescription>输入新手机号并验证</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit="onPhoneSubmit">
          <FormField v-slot="{ componentField }" name="newPhone">
            <FormItem>
              <FormLabel>新手机号</FormLabel>
              <FormControl>
                <Input type="tel" placeholder="请输入新手机号" maxlength="11" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="smsCode">
            <FormItem>
              <FormLabel>验证码</FormLabel>
              <div class="flex gap-2">
                <FormControl>
                  <Input placeholder="6 位验证码" maxlength="6" inputmode="numeric" v-bind="componentField" />
                </FormControl>
                <Button
                  type="button" variant="outline" class="shrink-0"
                  :disabled="smsLoading || smsCountdown > 0"
                  @click="handleSendSms(phoneForm.values.newPhone)"
                >
                  <Loader2 v-if="smsLoading" class="mr-1 size-4 animate-spin" />
                  {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          </FormField>
          <DialogFooter>
            <Button type="submit" :disabled="phoneLoading">
              <Loader2 v-if="phoneLoading" class="mr-2 size-4 animate-spin" />
              确认换绑
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 换绑邮箱 Dialog -->
    <Dialog v-model:open="emailOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ auth.user?.email ? '换绑邮箱' : '绑定邮箱' }}</DialogTitle>
          <DialogDescription>输入新邮箱并验证</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit="onEmailSubmit">
          <FormField v-slot="{ componentField }" name="newEmail">
            <FormItem>
              <FormLabel>新邮箱</FormLabel>
              <FormControl>
                <Input type="email" placeholder="请输入新邮箱" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <FormField v-slot="{ componentField }" name="emailCode">
            <FormItem>
              <FormLabel>验证码</FormLabel>
              <div class="flex gap-2">
                <FormControl>
                  <Input placeholder="6 位验证码" maxlength="6" inputmode="numeric" v-bind="componentField" />
                </FormControl>
                <Button
                  type="button" variant="outline" class="shrink-0"
                  :disabled="emailCodeLoading || emailCountdown > 0"
                  @click="handleSendEmail(emailForm.values.newEmail)"
                >
                  <Loader2 v-if="emailCodeLoading" class="mr-1 size-4 animate-spin" />
                  {{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          </FormField>
          <DialogFooter>
            <Button type="submit" :disabled="emailBtnLoading">
              <Loader2 v-if="emailBtnLoading" class="mr-2 size-4 animate-spin" />
              确认{{ auth.user?.email ? '换绑' : '绑定' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- 注销账号 AlertDialog -->
    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认注销账号</AlertDialogTitle>
          <AlertDialogDescription>
            此操作不可撤销。你的账号和所有数据将被永久删除。请输入"删除账号"以确认。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Input v-model="deleteConfirm" placeholder="请输入"删除账号"" />
        <AlertDialogFooter>
          <AlertDialogCancel @click="deleteConfirm = ''">取消</AlertDialogCancel>
          <AlertDialogAction
            :disabled="deleteConfirm !== '删除账号' || deleteLoading"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="handleDelete"
          >
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            确认注销
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
```

**Step 3: Verify compilation**

Run: `cd D:/code/Account/frontend && npx vue-tsc --noEmit`

**Step 4: Commit**

```bash
cd D:/code/Account/frontend
git add src/views/settings/components/SecuritySection.vue src/composables/useEmailCountdown.ts
git commit -m "feat(settings): implement security section with all dialogs"
```

---

### Task 10: Frontend — AppearanceSection

**Files:**
- Modify: `D:/code/Account/frontend/src/views/settings/components/AppearanceSection.vue`

**Step 1: Implement appearance settings**

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Monitor, Sun, Moon } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

type Theme = 'light' | 'dark' | 'system'

const current = ref<Theme>('system')

const options = [
  { value: 'light' as const, label: '亮色', icon: Sun },
  { value: 'dark' as const, label: '暗色', icon: Moon },
  { value: 'system' as const, label: '跟随系统', icon: Monitor },
] as const

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
}

function setTheme(theme: Theme): void {
  current.value = theme
  localStorage.setItem('theme', theme)
  applyTheme(theme)
}

onMounted(() => {
  const saved = localStorage.getItem('theme') as Theme | null
  if (saved) {
    current.value = saved
    applyTheme(saved)
  }
})
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold">外观</h2>
    <p class="mt-1 text-sm text-muted-foreground">选择你偏好的主题</p>

    <div class="mt-6 flex gap-4">
      <button
        v-for="option in options"
        :key="option.value"
        :class="cn(
          'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
          current === option.value
            ? 'border-primary bg-accent'
            : 'border-border hover:border-primary/50',
        )"
        @click="setTheme(option.value)"
      >
        <component :is="option.icon" class="size-6" />
        <span class="text-sm font-medium">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>
```

**Step 2: Verify compilation**

Run: `cd D:/code/Account/frontend && npx vue-tsc --noEmit`

**Step 3: Commit**

```bash
cd D:/code/Account/frontend
git add src/views/settings/components/AppearanceSection.vue
git commit -m "feat(settings): implement appearance theme switching"
```

---

### Task 11: Lint check and final verification

**Step 1: Backend lint + build**

```bash
cd D:/code/Account/backend && npm run lint 2>&1 | tail -5
cd D:/code/Account/backend && npx nest build 2>&1 | tail -3
```

**Step 2: Frontend lint + type check**

```bash
cd D:/code/Account/frontend && npm run lint:check
cd D:/code/Account/frontend && npx vue-tsc --noEmit
```

**Step 3: Fix any lint issues**

If any errors, fix and commit:

```bash
git add -A && git commit -m "fix(settings): lint and type fixes"
```

**Step 4: Visual verification**

Start both servers, navigate to:
- http://localhost:3139/settings/profile — profile form loads with user data
- http://localhost:3139/settings/security — 4 rows with buttons
- http://localhost:3139/settings/appearance — 3 theme cards
- Verify dropdown menu in top-right works
- Verify theme switching persists on refresh
