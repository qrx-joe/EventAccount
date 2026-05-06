# 个人中心模块扩展 — 阶段 1 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为个人中心新增 user_profiles 和 user_preferences 两张表，配套后端 CRUD 接口，前端设置页新增通知偏好、隐私设置、日历占位页面，并扩展个人资料编辑（城市、详细简介、社交链接）。

**Architecture:** 后端新增 profile/ 和 preferences/ 两个子目录挂在现有 user/ 模块下，各自包含 Entity → DTO → Service → Controller。注册流程在事务中自动创建默认记录。前端在 settings/ 下新增三个 Section 组件，导航重构为分组形式。

**Tech Stack:** NestJS + TypeORM + PostgreSQL（后端），Vue 3 + shadcn-vue + vee-validate + zod（前端）

**设计文档:** `docs/plans/2026-03-03-personal-center-expansion-design.md`

---

### Task 1: 后端 — UserProfileEntity + UserPreferencesEntity

**Files:**
- Create: `backend/src/modules/user/profile/user-profile.entity.ts`
- Create: `backend/src/modules/user/preferences/user-preferences.entity.ts`

**Step 1: 创建 UserProfileEntity**

```typescript
// backend/src/modules/user/profile/user-profile.entity.ts
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  OneToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../../../shared/utils/id-generator';
import { UserEntity } from '../user.entity';

/** 社交链接结构 */
export interface SocialLinks {
  wechat?: string;
  weibo?: string;
  github?: string;
  xiaohongshu?: string;
  website?: string;
}

/**
 * 用户扩展资料实体
 * 与 users 表一对一，存储展示类信息（城市、详细简介、社交链接、兴趣标签）
 */
@Entity('user_profiles')
export class UserProfileEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true, comment: '用户 ID' })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '所在城市' })
  city: string | null;

  @Column({ type: 'text', nullable: true, comment: '详细自我介绍' })
  detailedBio: string | null;

  @Column({ type: 'jsonb', default: '{}', comment: '社交链接' })
  socialLinks: SocialLinks;

  @Column({ type: 'varchar', array: true, default: '{}', comment: '兴趣标签' })
  interestTags: string[];

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
```

**Step 2: 创建 UserPreferencesEntity**

```typescript
// backend/src/modules/user/preferences/user-preferences.entity.ts
import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  OneToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { generateId } from '../../../shared/utils/id-generator';
import { UserEntity } from '../user.entity';

/**
 * 用户偏好设置实体
 * 与 users 表一对一，存储通知渠道开关 + 隐私控制
 */
@Entity('user_preferences')
export class UserPreferencesEntity {
  @PrimaryColumn({ type: 'varchar', length: 36, comment: 'UUIDv7 主键' })
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true, comment: '用户 ID' })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;

  /** 通知渠道开关 */
  @Column({ type: 'boolean', default: true, comment: '站内信通知' })
  notifyInApp: boolean;

  @Column({ type: 'boolean', default: true, comment: '短信通知' })
  notifySms: boolean;

  @Column({ type: 'boolean', default: true, comment: '邮箱通知' })
  notifyEmail: boolean;

  /** 隐私控制 */
  @Column({ type: 'boolean', default: true, comment: '个人主页是否公开' })
  profileVisible: boolean;

  @Column({ type: 'boolean', default: true, comment: '活动参与记录是否公开' })
  eventHistoryVisible: boolean;

  @Column({ type: 'boolean', default: true, comment: '是否允许陌生人私信' })
  allowDirectMessage: boolean;

  @Column({ type: 'boolean', default: true, comment: '是否在报名列表中显示' })
  showInAttendeeList: boolean;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
```

**Step 3: 验证编译**

Run: `cd D:/code/Account/backend && npx tsc --noEmit`
Expected: 无编译错误

**Step 4: 提交**

```bash
cd D:/code/Account/backend
git add src/modules/user/profile/user-profile.entity.ts src/modules/user/preferences/user-preferences.entity.ts
git commit -m "feat: 新增 UserProfileEntity 和 UserPreferencesEntity"
```

---

### Task 2: 后端 — 数据库 Migration

**Files:**
- Create: `backend/src/migrations/20260303000100-create-user-profiles-and-preferences.ts`

**Step 1: 创建 migration 文件**

```typescript
// backend/src/migrations/20260303000100-create-user-profiles-and-preferences.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserProfilesAndPreferences20260303000100 implements MigrationInterface {
  name = 'CreateUserProfilesAndPreferences20260303000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 user_profiles 表
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" varchar(36) NOT NULL,
        "userId" varchar(36) NOT NULL,
        "city" varchar(50),
        "detailedBio" text,
        "socialLinks" jsonb NOT NULL DEFAULT '{}',
        "interestTags" varchar[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_user_profiles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 创建 user_preferences 表
    await queryRunner.query(`
      CREATE TABLE "user_preferences" (
        "id" varchar(36) NOT NULL,
        "userId" varchar(36) NOT NULL,
        "notifyInApp" boolean NOT NULL DEFAULT true,
        "notifySms" boolean NOT NULL DEFAULT true,
        "notifyEmail" boolean NOT NULL DEFAULT true,
        "profileVisible" boolean NOT NULL DEFAULT true,
        "eventHistoryVisible" boolean NOT NULL DEFAULT true,
        "allowDirectMessage" boolean NOT NULL DEFAULT true,
        "showInAttendeeList" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_preferences_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_user_preferences_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "user_preferences"');
    await queryRunner.query('DROP TABLE IF EXISTS "user_profiles"');
  }
}
```

**Step 2: 运行 migration**

Run: `cd D:/code/Account/backend && npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/data-source.ts`
Expected: migration 执行成功

> 注意：如果项目使用 `synchronize: true`（开发模式），TypeORM 会自动根据 Entity 建表，可能不需要手动 run migration。检查 `app.module.ts` 中 TypeORM 配置的 `synchronize` 选项。如果是 `true`，跳过 run migration 步骤，但仍然保留 migration 文件用于生产部署。

**Step 3: 提交**

```bash
cd D:/code/Account/backend
git add src/migrations/20260303000100-create-user-profiles-and-preferences.ts
git commit -m "feat: 添加 user_profiles 和 user_preferences 表的 migration"
```

---

### Task 3: 后端 — Profile DTO + Service + Controller

**Files:**
- Create: `backend/src/modules/user/profile/user-profile.dto.ts`
- Create: `backend/src/modules/user/profile/user-profile.service.ts`
- Create: `backend/src/modules/user/profile/user-profile.controller.ts`

**Step 1: 创建 Profile DTO**

```typescript
// backend/src/modules/user/profile/user-profile.dto.ts
import {
  IsOptional,
  IsString,
  IsArray,
  IsObject,
  Length,
  ArrayMaxSize,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { SocialLinks } from './user-profile.entity';

/** 更新用户扩展资料请求体 */
export class UpdateUserProfileDto {
  @ApiProperty({ description: '所在城市', example: '上海', required: false })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  city?: string | null;

  @ApiProperty({ description: '详细自我介绍', required: false })
  @IsOptional()
  @IsString()
  detailedBio?: string | null;

  @ApiProperty({
    description: '社交链接',
    example: { github: 'https://github.com/test' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  socialLinks?: Partial<SocialLinks>;

  @ApiProperty({
    description: '兴趣标签（最多 10 个）',
    example: ['技术', '设计'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10, { message: '兴趣标签最多 10 个' })
  interestTags?: string[];
}

/** 用户扩展资料响应 DTO */
export class UserProfileDto {
  @ApiProperty({ description: 'Profile ID' })
  id: string;

  @ApiProperty({ description: '用户 ID' })
  userId: string;

  @ApiProperty({ description: '所在城市' })
  city: string | null;

  @ApiProperty({ description: '详细自我介绍' })
  detailedBio: string | null;

  @ApiProperty({ description: '社交链接' })
  socialLinks: SocialLinks;

  @ApiProperty({ description: '兴趣标签' })
  interestTags: string[];

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
```

**Step 2: 创建 Profile Service**

```typescript
// backend/src/modules/user/profile/user-profile.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { UserProfileEntity, SocialLinks } from './user-profile.entity';
import { UpdateUserProfileDto, UserProfileDto } from './user-profile.dto';

/**
 * 用户扩展资料服务
 * 负责 user_profiles 的增改查
 */
@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly profileRepo: Repository<UserProfileEntity>,
  ) {}

  /** Entity → DTO 映射 */
  toDto(entity: UserProfileEntity): UserProfileDto {
    return {
      id: entity.id,
      userId: entity.userId,
      city: entity.city,
      detailedBio: entity.detailedBio,
      socialLinks: entity.socialLinks,
      interestTags: entity.interestTags,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /** 获取用户扩展资料（不存在时返回 null） */
  async findByUserId(userId: string): Promise<UserProfileEntity | null> {
    return this.profileRepo.findOne({ where: { userId } });
  }

  /** 获取用户扩展资料 DTO（不存在时返回默认空值） */
  async getByUserId(userId: string): Promise<UserProfileDto> {
    const entity = await this.findByUserId(userId);
    if (entity) return this.toDto(entity);
    // 理论上注册时已自动创建，兜底返回默认值
    return {
      id: '',
      userId,
      city: null,
      detailedBio: null,
      socialLinks: {},
      interestTags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /** 更新用户扩展资料 */
  async update(userId: string, dto: UpdateUserProfileDto): Promise<UserProfileDto> {
    let entity = await this.findByUserId(userId);
    if (!entity) {
      // 兜底创建（正常不应走到这里）
      entity = this.profileRepo.create({ userId });
    }

    if (dto.city !== undefined) entity.city = dto.city ?? null;
    if (dto.detailedBio !== undefined) entity.detailedBio = dto.detailedBio ?? null;
    if (dto.socialLinks !== undefined) {
      // 合并社交链接（允许部分更新）
      entity.socialLinks = { ...entity.socialLinks, ...dto.socialLinks };
    }
    if (dto.interestTags !== undefined) entity.interestTags = dto.interestTags;

    const saved = await this.profileRepo.save(entity);
    this.logger.log(`用户扩展资料更新成功: ${userId}`);
    return this.toDto(saved);
  }

  /** 在事务中创建默认 profile（供注册流程调用） */
  async createDefault(userId: string, manager: EntityManager): Promise<void> {
    const profile = manager.create(UserProfileEntity, { userId });
    await manager.save(profile);
  }
}
```

**Step 3: 创建 Profile Controller**

```typescript
// backend/src/modules/user/profile/user-profile.controller.ts
import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { UpdateUserProfileDto, UserProfileDto } from './user-profile.dto';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/auth.dto';

/**
 * 用户扩展资料控制器
 * 处理 /users/me/profile 路由
 */
@ApiTags('用户-扩展资料')
@Controller('users/me/profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly profileService: UserProfileService) {}

  /** 获取当前用户扩展资料 */
  @ApiOperation({ summary: '获取当前用户扩展资料' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get()
  async getMyProfile(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserProfileDto>> {
    const profile = await this.profileService.getByUserId(req.user.sub);
    return ApiResponseDto.ok(profile);
  }

  /** 更新当前用户扩展资料 */
  @ApiOperation({ summary: '更新当前用户扩展资料' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Put()
  async updateMyProfile(
    @Req() req: { user: JwtPayload },
    @Body() dto: UpdateUserProfileDto,
  ): Promise<ApiResponseDto<UserProfileDto>> {
    const profile = await this.profileService.update(req.user.sub, dto);
    return ApiResponseDto.ok(profile, '资料更新成功');
  }
}
```

**Step 4: 验证编译**

Run: `cd D:/code/Account/backend && npx tsc --noEmit`
Expected: 无编译错误

**Step 5: 提交**

```bash
cd D:/code/Account/backend
git add src/modules/user/profile/
git commit -m "feat: 新增 UserProfile DTO、Service、Controller"
```

---

### Task 4: 后端 — Preferences DTO + Service + Controller

**Files:**
- Create: `backend/src/modules/user/preferences/user-preferences.dto.ts`
- Create: `backend/src/modules/user/preferences/user-preferences.service.ts`
- Create: `backend/src/modules/user/preferences/user-preferences.controller.ts`

**Step 1: 创建 Preferences DTO**

```typescript
// backend/src/modules/user/preferences/user-preferences.dto.ts
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** 更新通知偏好请求体（PATCH，所有字段可选） */
export class UpdateNotificationsDto {
  @ApiProperty({ description: '站内信通知', required: false })
  @IsOptional()
  @IsBoolean()
  notifyInApp?: boolean;

  @ApiProperty({ description: '短信通知', required: false })
  @IsOptional()
  @IsBoolean()
  notifySms?: boolean;

  @ApiProperty({ description: '邮箱通知', required: false })
  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;
}

/** 更新隐私设置请求体（PATCH，所有字段可选） */
export class UpdatePrivacyDto {
  @ApiProperty({ description: '个人主页是否公开', required: false })
  @IsOptional()
  @IsBoolean()
  profileVisible?: boolean;

  @ApiProperty({ description: '活动参与记录是否公开', required: false })
  @IsOptional()
  @IsBoolean()
  eventHistoryVisible?: boolean;

  @ApiProperty({ description: '是否允许陌生人私信', required: false })
  @IsOptional()
  @IsBoolean()
  allowDirectMessage?: boolean;

  @ApiProperty({ description: '是否在报名列表中显示', required: false })
  @IsOptional()
  @IsBoolean()
  showInAttendeeList?: boolean;
}

/** 用户偏好设置响应 DTO */
export class UserPreferencesDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() notifyInApp: boolean;
  @ApiProperty() notifySms: boolean;
  @ApiProperty() notifyEmail: boolean;
  @ApiProperty() profileVisible: boolean;
  @ApiProperty() eventHistoryVisible: boolean;
  @ApiProperty() allowDirectMessage: boolean;
  @ApiProperty() showInAttendeeList: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
```

**Step 2: 创建 Preferences Service**

```typescript
// backend/src/modules/user/preferences/user-preferences.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { UserPreferencesEntity } from './user-preferences.entity';
import {
  UpdateNotificationsDto,
  UpdatePrivacyDto,
  UserPreferencesDto,
} from './user-preferences.dto';

/**
 * 用户偏好设置服务
 * 负责通知渠道开关 + 隐私控制的增改查
 */
@Injectable()
export class UserPreferencesService {
  private readonly logger = new Logger(UserPreferencesService.name);

  constructor(
    @InjectRepository(UserPreferencesEntity)
    private readonly preferencesRepo: Repository<UserPreferencesEntity>,
  ) {}

  /** Entity → DTO 映射 */
  toDto(entity: UserPreferencesEntity): UserPreferencesDto {
    return {
      id: entity.id,
      userId: entity.userId,
      notifyInApp: entity.notifyInApp,
      notifySms: entity.notifySms,
      notifyEmail: entity.notifyEmail,
      profileVisible: entity.profileVisible,
      eventHistoryVisible: entity.eventHistoryVisible,
      allowDirectMessage: entity.allowDirectMessage,
      showInAttendeeList: entity.showInAttendeeList,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /** 获取用户偏好设置 */
  async getByUserId(userId: string): Promise<UserPreferencesDto> {
    const entity = await this.preferencesRepo.findOne({ where: { userId } });
    if (entity) return this.toDto(entity);
    // 兜底返回全部默认值
    return {
      id: '',
      userId,
      notifyInApp: true,
      notifySms: true,
      notifyEmail: true,
      profileVisible: true,
      eventHistoryVisible: true,
      allowDirectMessage: true,
      showInAttendeeList: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /** 更新通知偏好 */
  async updateNotifications(
    userId: string,
    dto: UpdateNotificationsDto,
  ): Promise<UserPreferencesDto> {
    const entity = await this.findOrCreate(userId);
    if (dto.notifyInApp !== undefined) entity.notifyInApp = dto.notifyInApp;
    if (dto.notifySms !== undefined) entity.notifySms = dto.notifySms;
    if (dto.notifyEmail !== undefined) entity.notifyEmail = dto.notifyEmail;
    const saved = await this.preferencesRepo.save(entity);
    this.logger.log(`用户通知偏好更新: ${userId}`);
    return this.toDto(saved);
  }

  /** 更新隐私设置 */
  async updatePrivacy(
    userId: string,
    dto: UpdatePrivacyDto,
  ): Promise<UserPreferencesDto> {
    const entity = await this.findOrCreate(userId);
    if (dto.profileVisible !== undefined) entity.profileVisible = dto.profileVisible;
    if (dto.eventHistoryVisible !== undefined) entity.eventHistoryVisible = dto.eventHistoryVisible;
    if (dto.allowDirectMessage !== undefined) entity.allowDirectMessage = dto.allowDirectMessage;
    if (dto.showInAttendeeList !== undefined) entity.showInAttendeeList = dto.showInAttendeeList;
    const saved = await this.preferencesRepo.save(entity);
    this.logger.log(`用户隐私设置更新: ${userId}`);
    return this.toDto(saved);
  }

  /** 在事务中创建默认 preferences（供注册流程调用） */
  async createDefault(userId: string, manager: EntityManager): Promise<void> {
    const prefs = manager.create(UserPreferencesEntity, { userId });
    await manager.save(prefs);
  }

  /** 查找或兜底创建 */
  private async findOrCreate(userId: string): Promise<UserPreferencesEntity> {
    let entity = await this.preferencesRepo.findOne({ where: { userId } });
    if (!entity) {
      entity = this.preferencesRepo.create({ userId });
    }
    return entity;
  }
}
```

**Step 3: 创建 Preferences Controller**

```typescript
// backend/src/modules/user/preferences/user-preferences.controller.ts
import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserPreferencesService } from './user-preferences.service';
import {
  UpdateNotificationsDto,
  UpdatePrivacyDto,
  UserPreferencesDto,
} from './user-preferences.dto';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/auth.dto';

/**
 * 用户偏好设置控制器
 * 处理 /users/me/preferences 路由
 */
@ApiTags('用户-偏好设置')
@Controller('users/me/preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserPreferencesController {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  /** 获取当前用户所有偏好设置 */
  @ApiOperation({ summary: '获取当前用户偏好设置' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @Get()
  async getMyPreferences(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<UserPreferencesDto>> {
    const prefs = await this.preferencesService.getByUserId(req.user.sub);
    return ApiResponseDto.ok(prefs);
  }

  /** 部分更新通知偏好 */
  @ApiOperation({ summary: '更新通知偏好' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch('notifications')
  async updateNotifications(
    @Req() req: { user: JwtPayload },
    @Body() dto: UpdateNotificationsDto,
  ): Promise<ApiResponseDto<UserPreferencesDto>> {
    const prefs = await this.preferencesService.updateNotifications(req.user.sub, dto);
    return ApiResponseDto.ok(prefs, '通知偏好更新成功');
  }

  /** 部分更新隐私设置 */
  @ApiOperation({ summary: '更新隐私设置' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Patch('privacy')
  async updatePrivacy(
    @Req() req: { user: JwtPayload },
    @Body() dto: UpdatePrivacyDto,
  ): Promise<ApiResponseDto<UserPreferencesDto>> {
    const prefs = await this.preferencesService.updatePrivacy(req.user.sub, dto);
    return ApiResponseDto.ok(prefs, '隐私设置更新成功');
  }
}
```

**Step 4: 验证编译**

Run: `cd D:/code/Account/backend && npx tsc --noEmit`
Expected: 无编译错误

**Step 5: 提交**

```bash
cd D:/code/Account/backend
git add src/modules/user/preferences/
git commit -m "feat: 新增 UserPreferences DTO、Service、Controller"
```

---

### Task 5: 后端 — UserModule 组装 + 注册流程集成

**Files:**
- Modify: `backend/src/modules/user/user.module.ts`
- Modify: `backend/src/modules/auth/auth.service.ts`

**Step 1: 更新 UserModule，注册新 Entity、Service、Controller**

在 `backend/src/modules/user/user.module.ts` 中：
- imports 数组添加 `TypeOrmModule.forFeature([UserProfileEntity, UserPreferencesEntity])`
- controllers 数组添加 `UserProfileController, UserPreferencesController`（放在 `UserAccountController` 之后、`UserController` 之前，因为 `/users/me/profile` 和 `/users/me/preferences` 必须在 `/users/:id` 之前注册）
- providers 数组添加 `UserProfileService, UserPreferencesService`
- exports 数组添加 `UserProfileService, UserPreferencesService`

```typescript
// 修改后的 user.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UserProfileEntity } from './profile/user-profile.entity';
import { UserPreferencesEntity } from './preferences/user-preferences.entity';
import { UserService } from './user.service';
import { UserSecurityService } from './user-security.service';
import { UserProfileService } from './profile/user-profile.service';
import { UserPreferencesService } from './preferences/user-preferences.service';
import { UserAccountController } from './user-account.controller';
import { UserProfileController } from './profile/user-profile.controller';
import { UserPreferencesController } from './preferences/user-preferences.controller';
import { UserController } from './user.controller';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserProfileEntity, UserPreferencesEntity]),
    VerificationModule,
  ],
  /**
   * Controller 注册顺序：
   * 1. UserAccountController (/users/me/*)
   * 2. UserProfileController (/users/me/profile)
   * 3. UserPreferencesController (/users/me/preferences)
   * 4. UserController (/users, /users/:id) — 必须在最后，避免 :id 捕获 "me"
   */
  controllers: [
    UserAccountController,
    UserProfileController,
    UserPreferencesController,
    UserController,
  ],
  providers: [UserService, UserSecurityService, UserProfileService, UserPreferencesService],
  exports: [UserService, UserProfileService, UserPreferencesService],
})
export class UserModule {}
```

**Step 2: 更新 AuthService.register()，在事务中创建默认 profile + preferences**

在 `backend/src/modules/auth/auth.service.ts` 中修改 `register()` 方法。

当前 register 流程：验证码 → `userService.create()` → 签署协议 → 签发 token。

需要改为：验证码 → `userService.create()` → 创建默认 profile + preferences → 签署协议 → 签发 token。

注意：`userService.create()` 内部没有使用事务（只是 `save`），新增的 profile/preferences 创建需要在 create 成功之后调用。由于 `userService.create()` 可能因为唯一约束抛异常，所以 profile/preferences 的创建只在 create 成功后执行。

```typescript
// 在 auth.service.ts 的 constructor 中注入新服务
constructor(
  private readonly jwtService: JwtService,
  private readonly userService: UserService,
  private readonly verificationService: VerificationService,
  private readonly agreementService: AgreementService,
  private readonly userProfileService: UserProfileService,
  private readonly userPreferencesService: UserPreferencesService,
  private readonly dataSource: DataSource,
) {}

// 修改 register 方法
async register(dto: RegisterDto): Promise<{ token: string }> {
  const valid = await this.verificationService.verifyCode(
    dto.phone,
    VerificationCodeType.REGISTER,
    dto.smsCode,
  );
  if (!valid) {
    throw new BadRequestException('验证码无效或已过期');
  }

  const user = await this.userService.create({
    phone: dto.phone,
    password: dto.password,
    nickname: dto.nickname,
  });

  // 在事务中创建默认 profile + preferences
  await this.dataSource.transaction(async (manager) => {
    await this.userProfileService.createDefault(user.id, manager);
    await this.userPreferencesService.createDefault(user.id, manager);
  });

  await this.agreementService.autoSignOnRegister(user.id);

  this.logger.log(`用户注册成功: ${user.id}`);
  return { token: this.signToken(user) };
}
```

需要添加对应的 import：
```typescript
import { UserProfileService } from '../user/profile/user-profile.service';
import { UserPreferencesService } from '../user/preferences/user-preferences.service';
import { DataSource } from 'typeorm';
```

**Step 3: 验证编译**

Run: `cd D:/code/Account/backend && npx tsc --noEmit`
Expected: 无编译错误

**Step 4: 提交**

```bash
cd D:/code/Account/backend
git add src/modules/user/user.module.ts src/modules/auth/auth.service.ts
git commit -m "feat: 组装 UserModule 新子模块，注册流程自动创建默认 profile 和 preferences"
```

---

### Task 6: 后端 — E2E 测试

**Files:**
- Modify: `backend/test/e2e-helpers.ts`（TRUNCATE 新表）
- Create: `backend/test/user-profile-preferences.e2e-spec.ts`

**Step 1: 更新 clearMutableData 以包含新表**

在 `backend/test/e2e-helpers.ts` 的 `clearMutableData` 函数中，TRUNCATE 语句添加新表：

```typescript
await dataSource.query(
  'TRUNCATE TABLE "user_profiles", "user_preferences", "agreement_signs", "users" RESTART IDENTITY CASCADE;',
);
```

**Step 2: 创建 E2E 测试文件**

```typescript
// backend/test/user-profile-preferences.e2e-spec.ts
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import {
  clearMutableData,
  closeE2eApp,
  createE2eApp,
  seedVerificationCode,
} from './e2e-helpers';
import { VerificationCodeType } from '../src/modules/verification/verification.dto';
import { parseApiResponse } from './api-response-test-utils';

function getHttpServer(app: INestApplication): App {
  return app.getHttpServer() as unknown as App;
}

async function registerUser(
  app: INestApplication,
  phone: string,
): Promise<request.Agent> {
  const agent = request.agent(getHttpServer(app));
  await seedVerificationCode(app, phone, VerificationCodeType.REGISTER, '123456');
  await agent
    .post('/api/auth/register')
    .send({ phone, smsCode: '123456', password: 'Test1234', nickname: '测试用户' })
    .expect(201);
  return agent;
}

describe('用户扩展资料与偏好设置接口 (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  beforeEach(async () => {
    await clearMutableData(app);
  });

  afterAll(async () => {
    await closeE2eApp(app);
  });

  // --- Profile 接口 ---

  it('注册后自动创建默认 profile', async () => {
    const agent = await registerUser(app, '13800001001');
    const res = await agent.get('/api/users/me/profile').expect(200);
    const body = parseApiResponse<{ city: string | null; socialLinks: object; interestTags: string[] }>(res);
    expect(body.success).toBe(true);
    expect(body.data?.city).toBeNull();
    expect(body.data?.socialLinks).toEqual({});
    expect(body.data?.interestTags).toEqual([]);
  });

  it('更新扩展资料（城市 + 社交链接）', async () => {
    const agent = await registerUser(app, '13800001002');
    const res = await agent
      .put('/api/users/me/profile')
      .send({
        city: '上海',
        socialLinks: { github: 'https://github.com/test' },
      })
      .expect(200);
    const body = parseApiResponse<{ city: string; socialLinks: { github: string } }>(res);
    expect(body.data?.city).toBe('上海');
    expect(body.data?.socialLinks.github).toBe('https://github.com/test');
  });

  it('兴趣标签超过 10 个时返回 400', async () => {
    const agent = await registerUser(app, '13800001003');
    const tags = Array.from({ length: 11 }, (_, i) => `标签${i}`);
    await agent
      .put('/api/users/me/profile')
      .send({ interestTags: tags })
      .expect(400);
  });

  // --- Preferences 接口 ---

  it('注册后自动创建默认 preferences（全部 true）', async () => {
    const agent = await registerUser(app, '13800001004');
    const res = await agent.get('/api/users/me/preferences').expect(200);
    const body = parseApiResponse<{
      notifyInApp: boolean; notifySms: boolean; notifyEmail: boolean;
      profileVisible: boolean; eventHistoryVisible: boolean;
      allowDirectMessage: boolean; showInAttendeeList: boolean;
    }>(res);
    expect(body.success).toBe(true);
    expect(body.data?.notifyInApp).toBe(true);
    expect(body.data?.notifySms).toBe(true);
    expect(body.data?.notifyEmail).toBe(true);
    expect(body.data?.profileVisible).toBe(true);
    expect(body.data?.showInAttendeeList).toBe(true);
  });

  it('PATCH 通知偏好：只更新传入的字段', async () => {
    const agent = await registerUser(app, '13800001005');
    const res = await agent
      .patch('/api/users/me/preferences/notifications')
      .send({ notifySms: false })
      .expect(200);
    const body = parseApiResponse<{ notifyInApp: boolean; notifySms: boolean; notifyEmail: boolean }>(res);
    expect(body.data?.notifySms).toBe(false);
    expect(body.data?.notifyInApp).toBe(true);
    expect(body.data?.notifyEmail).toBe(true);
  });

  it('PATCH 隐私设置：只更新传入的字段', async () => {
    const agent = await registerUser(app, '13800001006');
    const res = await agent
      .patch('/api/users/me/preferences/privacy')
      .send({ profileVisible: false, allowDirectMessage: false })
      .expect(200);
    const body = parseApiResponse<{
      profileVisible: boolean; eventHistoryVisible: boolean;
      allowDirectMessage: boolean; showInAttendeeList: boolean;
    }>(res);
    expect(body.data?.profileVisible).toBe(false);
    expect(body.data?.allowDirectMessage).toBe(false);
    expect(body.data?.eventHistoryVisible).toBe(true);
    expect(body.data?.showInAttendeeList).toBe(true);
  });

  it('未登录访问 preferences 返回 401', async () => {
    await request(getHttpServer(app))
      .get('/api/users/me/preferences')
      .expect(401);
  });
});
```

**Step 3: 运行测试**

Run: `cd D:/code/Account/backend && npx jest --config test/jest-e2e.json test/user-profile-preferences.e2e-spec.ts --verbose`
Expected: 所有测试通过

**Step 4: 提交**

```bash
cd D:/code/Account/backend
git add test/e2e-helpers.ts test/user-profile-preferences.e2e-spec.ts
git commit -m "test: 新增 profile 和 preferences 接口 e2e 测试"
```

---

### Task 7: 前端 — 安装 Switch + Textarea 组件

**Step 1: 安装 shadcn-vue 的 Switch 和 Textarea 组件**

Run: `cd D:/code/Account/frontend && npx shadcn-vue@latest add switch textarea`
Expected: 组件文件生成在 `src/components/ui/switch/` 和 `src/components/ui/textarea/`

**Step 2: 验证编译**

Run: `cd D:/code/Account/frontend && npm run type-check`
Expected: 无类型错误

**Step 3: 提交**

```bash
cd D:/code/Account/frontend
git add src/components/ui/switch/ src/components/ui/textarea/
git commit -m "feat: 添加 shadcn-vue Switch 和 Textarea 组件"
```

---

### Task 8: 前端 — 类型定义 + API 封装

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/lib/profile.ts`
- Create: `frontend/src/lib/preferences.ts`

**Step 1: 在 types/index.ts 末尾添加新类型**

在 `frontend/src/types/index.ts` 文件末尾（`UploadResult` 之后、路由 meta 类型扩展之前）追加：

```typescript
/** 社交链接 */
export interface SocialLinks {
  wechat?: string
  weibo?: string
  github?: string
  xiaohongshu?: string
  website?: string
}

/** 用户扩展资料 */
export interface UserProfile {
  id: string
  userId: string
  city: string | null
  detailedBio: string | null
  socialLinks: SocialLinks
  interestTags: string[]
  createdAt: string
  updatedAt: string
}

/** 更新扩展资料请求 */
export interface UpdateProfilePayload {
  city?: string | null
  detailedBio?: string | null
  socialLinks?: Partial<SocialLinks>
  interestTags?: string[]
}

/** 用户偏好设置 */
export interface UserPreferences {
  id: string
  userId: string
  notifyInApp: boolean
  notifySms: boolean
  notifyEmail: boolean
  profileVisible: boolean
  eventHistoryVisible: boolean
  allowDirectMessage: boolean
  showInAttendeeList: boolean
  createdAt: string
  updatedAt: string
}

/** 更新通知偏好请求 */
export interface UpdateNotificationsPayload {
  notifyInApp?: boolean
  notifySms?: boolean
  notifyEmail?: boolean
}

/** 更新隐私设置请求 */
export interface UpdatePrivacyPayload {
  profileVisible?: boolean
  eventHistoryVisible?: boolean
  allowDirectMessage?: boolean
  showInAttendeeList?: boolean
}
```

**Step 2: 创建 lib/profile.ts**

```typescript
// frontend/src/lib/profile.ts
import http from '@/lib/http'
import type { ApiResponse, UserProfile, UpdateProfilePayload } from '@/types'

/** 获取当前用户扩展资料 */
export async function getMyProfile(): Promise<UserProfile> {
  const res = await http.get<ApiResponse<UserProfile>>('/users/me/profile')
  const data = res.data.data
  if (!data) throw new Error('获取资料失败')
  return data
}

/** 更新当前用户扩展资料 */
export async function updateMyProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
  const res = await http.put<ApiResponse<UserProfile>>('/users/me/profile', payload)
  const data = res.data.data
  if (!data) throw new Error('更新资料失败')
  return data
}
```

**Step 3: 创建 lib/preferences.ts**

```typescript
// frontend/src/lib/preferences.ts
import http from '@/lib/http'
import type {
  ApiResponse,
  UserPreferences,
  UpdateNotificationsPayload,
  UpdatePrivacyPayload,
} from '@/types'

/** 获取当前用户偏好设置 */
export async function getMyPreferences(): Promise<UserPreferences> {
  const res = await http.get<ApiResponse<UserPreferences>>('/users/me/preferences')
  const data = res.data.data
  if (!data) throw new Error('获取偏好设置失败')
  return data
}

/** 更新通知偏好 */
export async function updateNotifications(
  payload: UpdateNotificationsPayload,
): Promise<UserPreferences> {
  const res = await http.patch<ApiResponse<UserPreferences>>(
    '/users/me/preferences/notifications',
    payload,
  )
  const data = res.data.data
  if (!data) throw new Error('更新通知偏好失败')
  return data
}

/** 更新隐私设置 */
export async function updatePrivacy(
  payload: UpdatePrivacyPayload,
): Promise<UserPreferences> {
  const res = await http.patch<ApiResponse<UserPreferences>>(
    '/users/me/preferences/privacy',
    payload,
  )
  const data = res.data.data
  if (!data) throw new Error('更新隐私设置失败')
  return data
}
```

**Step 4: 验证编译**

Run: `cd D:/code/Account/frontend && npm run type-check`
Expected: 无类型错误

**Step 5: 提交**

```bash
cd D:/code/Account/frontend
git add src/types/index.ts src/lib/profile.ts src/lib/preferences.ts
git commit -m "feat: 新增 Profile 和 Preferences 类型定义与 API 封装"
```

---

### Task 9: 前端 — 扩展 ProfileSection

**Files:**
- Modify: `frontend/src/views/settings/components/ProfileSection.vue`

**Step 1: 重写 ProfileSection.vue**

在已有的昵称 + 签名表单基础上新增：城市输入、详细简介（Textarea）、社交链接动态表单。保持头像上传 + 基础资料保存逻辑不变，新增扩展资料独立保存。

关键变更点：
- 引入 `Textarea` 组件用于详细简介
- 新增 `profileData` ref 存储扩展资料
- `onMounted` 中同时加载 `auth.user` 和 `getMyProfile()`
- 扩展资料部分用单独的表单和保存按钮，调用 `updateMyProfile()`

社交链接表单设计：5 个固定平台的输入框（微信/微博/GitHub/小红书/个人网站），每个一行，有对应图标和 placeholder。不做动态增删——平台是预定义的。

> 实现时参考现有 ProfileSection.vue（`D:/code/Account/frontend/src/views/settings/components/ProfileSection.vue`）的表单模式（vee-validate + zod + FormField）。扩展资料部分独立使用一个新的 `useForm`。

**Step 2: 验证编译**

Run: `cd D:/code/Account/frontend && npm run type-check`
Expected: 无类型错误

**Step 3: 浏览器手动验证**

访问 `http://localhost:5173/settings/profile`，确认：
- 原有的头像、昵称、签名功能正常
- 新增的城市、详细简介、社交链接表单正常显示
- 保存后刷新页面数据保持

**Step 4: 提交**

```bash
cd D:/code/Account/frontend
git add src/views/settings/components/ProfileSection.vue
git commit -m "feat: 扩展 ProfileSection，新增城市、详细简介、社交链接"
```

---

### Task 10: 前端 — NotificationsSection

**Files:**
- Create: `frontend/src/views/settings/components/NotificationsSection.vue`

**Step 1: 创建通知偏好页面**

三组 Switch 开关：站内信 / 短信 / 邮箱。每项一行，左侧为名称 + 说明文字，右侧为 Switch 开关。改动即存（Switch 变化时立即 PATCH）。

```vue
<!-- 结构参考 SecuritySection.vue 的布局模式 -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { toast } from 'vue-sonner'
import { Bell, MessageSquare, Mail } from 'lucide-vue-next'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { getMyPreferences, updateNotifications } from '@/lib/preferences'

const loading = ref(true)
const notifyInApp = ref(true)
const notifySms = ref(true)
const notifyEmail = ref(true)

onMounted(async () => {
  try {
    const prefs = await getMyPreferences()
    notifyInApp.value = prefs.notifyInApp
    notifySms.value = prefs.notifySms
    notifyEmail.value = prefs.notifyEmail
  } catch {
    toast.error('加载通知偏好失败')
  } finally {
    loading.value = false
  }
})

async function onToggle(field: 'notifyInApp' | 'notifySms' | 'notifyEmail', value: boolean): Promise<void> {
  try {
    await updateNotifications({ [field]: value })
  } catch {
    // 回滚 UI 状态
    if (field === 'notifyInApp') notifyInApp.value = !value
    if (field === 'notifySms') notifySms.value = !value
    if (field === 'notifyEmail') notifyEmail.value = !value
    toast.error('更新失败，请稍后重试')
  }
}
</script>
```

模板中使用 Separator 分隔每个开关项，与 SecuritySection 风格保持一致。

**Step 2: 验证编译**

Run: `cd D:/code/Account/frontend && npm run type-check`
Expected: 无类型错误

**Step 3: 提交**

```bash
cd D:/code/Account/frontend
git add src/views/settings/components/NotificationsSection.vue
git commit -m "feat: 新增 NotificationsSection 通知偏好设置页面"
```

---

### Task 11: 前端 — PrivacySection

**Files:**
- Create: `frontend/src/views/settings/components/PrivacySection.vue`

**Step 1: 创建隐私设置页面**

四组 Switch 开关。结构与 NotificationsSection 相同，改动即存。

每项下方附简短说明文字解释影响范围：
- 公开个人主页："关闭后，其他用户只能看到你的头像和昵称"
- 展示活动参与记录："关闭后，其他用户无法查看你参加过的活动"
- 允许陌生人私信："关闭后，只有你关注的人可以给你发消息"
- 在报名列表中显示我："关闭后，你的名字不会出现在活动报名列表中"

调用 `updatePrivacy()` API。

**Step 2: 验证编译**

Run: `cd D:/code/Account/frontend && npm run type-check`
Expected: 无类型错误

**Step 3: 提交**

```bash
cd D:/code/Account/frontend
git add src/views/settings/components/PrivacySection.vue
git commit -m "feat: 新增 PrivacySection 隐私设置页面"
```

---

### Task 12: 前端 — CalendarSection（占位页面）

**Files:**
- Create: `frontend/src/views/settings/components/CalendarSection.vue`

**Step 1: 创建日历集成占位页面**

简单页面：标题 + 说明文字 + 置灰按钮 + "活动功能即将上线"提示。

```vue
<script setup lang="ts">
import { CalendarDays } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold">日历集成</h2>
    <p class="mt-1 text-sm text-muted-foreground">将已报名的活动同步到你的日历应用</p>

    <div class="mt-6 flex flex-col items-center gap-4 rounded-lg border border-dashed p-8">
      <CalendarDays class="size-12 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">活动功能即将上线，届时可导出日历文件</p>
      <Button disabled>
        导出日历 (.ics)
      </Button>
    </div>
  </div>
</template>
```

**Step 2: 提交**

```bash
cd D:/code/Account/frontend
git add src/views/settings/components/CalendarSection.vue
git commit -m "feat: 新增 CalendarSection 日历集成占位页面"
```

---

### Task 13: 前端 — SettingsLayout 导航重构 + 路由注册

**Files:**
- Modify: `frontend/src/views/settings/SettingsLayout.vue`
- Modify: `frontend/src/router/index.ts`

**Step 1: 重构 SettingsLayout.vue 导航为分组结构**

将扁平的 `navItems` 数组改为分组结构：

```typescript
const navGroups = [
  {
    label: '个人信息',
    items: [
      { to: '/settings/profile', label: '个人资料' },
      { to: '/settings/privacy', label: '隐私设置' },
    ],
  },
  {
    label: '通知与日历',
    items: [
      { to: '/settings/notifications', label: '通知偏好' },
      { to: '/settings/calendar', label: '日历集成' },
    ],
  },
  {
    label: '系统',
    items: [
      { to: '/settings/security', label: '账号安全' },
      { to: '/settings/appearance', label: '外观' },
    ],
  },
] as const
```

模板中用 `v-for` 嵌套渲染分组标题 + 导航项。分组标题用 `text-xs font-semibold uppercase text-muted-foreground` 样式。

**Step 2: 在 router/index.ts 注册新路由**

在 `/settings` 的 `children` 数组中添加：

```typescript
{
  path: 'notifications',
  name: 'settings-notifications',
  component: () => import('@/views/settings/components/NotificationsSection.vue'),
},
{
  path: 'privacy',
  name: 'settings-privacy',
  component: () => import('@/views/settings/components/PrivacySection.vue'),
},
{
  path: 'calendar',
  name: 'settings-calendar',
  component: () => import('@/views/settings/components/CalendarSection.vue'),
},
```

**Step 3: 验证编译**

Run: `cd D:/code/Account/frontend && npm run type-check`
Expected: 无类型错误

**Step 4: 浏览器手动验证**

访问 `http://localhost:5173/settings`，确认：
- 左侧导航显示三个分组，共 6 个导航项
- 点击每个导航项正确切换内容区域
- 当前激活项高亮正确

**Step 5: 提交**

```bash
cd D:/code/Account/frontend
git add src/views/settings/SettingsLayout.vue src/router/index.ts
git commit -m "feat: 重构设置页导航为分组结构，注册新路由"
```

---

### Task 14: 端到端验证 + 文档更新

**Files:**
- Modify: `backend/docs/personal-center.md`

**Step 1: 运行完整后端 e2e 测试**

Run: `cd D:/code/Account/backend && npx jest --config test/jest-e2e.json --verbose`
Expected: 所有测试通过（包括既有测试和新增的 profile/preferences 测试）

**Step 2: 运行前端类型检查**

Run: `cd D:/code/Account/frontend && npm run type-check`
Expected: 无类型错误

**Step 3: 更新个人中心架构文档**

在 `backend/docs/personal-center.md` 中追加新增功能的架构说明：
- 新增的两张表和它们与 users 的关系
- 新增的 API 路由列表
- 前端新增页面列表
- 导航分组结构

**Step 4: 提交**

```bash
cd D:/code/Account
git add backend/docs/personal-center.md
git commit -m "docs: 更新个人中心架构文档，补充 profile/preferences 模块"
```

---

## 依赖关系

```
Task 1 (Entity) → Task 2 (Migration) → Task 3 (Profile CRUD) → Task 5 (Module 组装)
                                       → Task 4 (Preferences CRUD) ↗
Task 5 (Module 组装) → Task 6 (E2E 测试)
Task 7 (shadcn 组件) → Task 8 (类型 + API) → Task 9 (ProfileSection)
                                             → Task 10 (NotificationsSection)
                                             → Task 11 (PrivacySection)
                                             → Task 12 (CalendarSection)
Task 9-12 → Task 13 (导航 + 路由)
Task 6 + Task 13 → Task 14 (端到端验证)
```

## 注意事项

- **Controller 注册顺序**：NestJS 按注册顺序匹配路由。`/users/me/profile` 和 `/users/me/preferences` 的 Controller 必须在 `UserController`（含 `/users/:id`）之前注册，否则 `me` 会被当作 UUID 参数
- **TypeORM synchronize**：检查 `app.module.ts` 中 TypeORM 配置。如果开发模式下 `synchronize: true`，Entity 会自动建表，migration 文件仅用于生产部署
- **clearMutableData**：e2e 测试的 TRUNCATE 语句中必须包含新表，否则测试间数据会污染
- **前端无需额外 store**：Profile 和 Preferences 数据在各设置页面内局部加载/保存，不需要全局 Pinia store。只有 `auth.user`（基础用户信息）保持全局
