import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommunityEntity } from './community.entity.js';
import { CommunityMemberEntity } from './community-member.entity.js';
import { UserEntity } from '../user/user.entity.js';
import { EventEntity } from '../event/event.entity.js';
import { CommunityController } from './community.controller.js';
import { CommunityService } from './community.service.js';

/**
 * 社区模块
 * 注册社区及成员实体，提供社区 CRUD、成员管理等功能
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommunityEntity,
      CommunityMemberEntity,
      UserEntity,
      EventEntity,
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
