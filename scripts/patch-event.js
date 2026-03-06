const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/event/event.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 在 constructor 中添加 CommunityRepository 注入
const oldConstructor = `@InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}`;

const newConstructor = `@InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(CommunityEntity)
    private readonly communityRepository: Repository<CommunityEntity>,
  ) {}`;

content = content.replace(oldConstructor, newConstructor);

// 添加 CommunityEntity import
const oldImport = `import { UserEntity } from '../user/user.entity.js';`;
const newImport = `import { UserEntity } from '../user/user.entity.js';
import { CommunityEntity } from '../community/community.entity.js';`;

content = content.replace(oldImport, newImport);

// 修改 create 方法 - 添加社区状态检查
const oldCreate = `async create(dto: CreateEventDto, creatorId: string): Promise<EventEntity> {
    const { tagIds, ...eventData } = dto;

    const event = this.eventRepository.create({
      ...eventData,
      creatorId,
      status: 'draft',
      auditStatus: 'pending',
    });`;

const newCreate = `async create(dto: CreateEventDto, creatorId: string): Promise<EventEntity> {
    const { tagIds, ...eventData } = dto;

    // 如果指定了社区，检查社区状态
    if (eventData.communityId) {
      const community = await this.communityRepository.findOne({
        where: { id: eventData.communityId },
      });
      if (!community) {
        throw new NotFoundException('指定的社区不存在');
      }
      if (community.status === 'inactive') {
        throw new ForbiddenException('该社区已被禁用，无法创建活动');
      }
    }

    const event = this.eventRepository.create({
      ...eventData,
      creatorId,
      status: 'draft',
      auditStatus: 'pending',
    });`;

content = content.replace(oldCreate, newCreate);

// 添加 NotFoundException import
const oldExceptionImport = `import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';`;

// 已经包含了 NotFoundException 和 ForbiddenException，无需修改

fs.writeFileSync(filePath, content);
console.log('event.service.ts patched successfully');
