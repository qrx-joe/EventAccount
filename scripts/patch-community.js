const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/community/community.service.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. 修改 findById 方法 - 添加禁用检查
const oldFindById = `if (!community) {
      throw new NotFoundException('社区不存在');
    }

    // 如果是私密社区，检查用户是否有权限查看`;

const newFindById = `if (!community) {
      throw new NotFoundException('社区不存在');
    }

    // 如果社区已被禁用，只有创建者和管理员可以查看
    if (community.status === 'inactive') {
      if (!userId || (community.creatorId !== userId)) {
        throw new ForbiddenException('该社区已被禁用');
      }
    }

    // 如果是私密社区，检查用户是否有权限查看`;

content = content.replace(oldFindById, newFindById);

// 2. 修改 join 方法 - 添加禁用检查
const oldJoin = `async join(
    communityId: string,
    dto: JoinCommunityDto,
    userId: string,
  ): Promise<CommunityMemberEntity> {
    const community = await this.findById(communityId, userId);

    // 检查是否已在社区中`;

const newJoin = `async join(
    communityId: string,
    dto: JoinCommunityDto,
    userId: string,
  ): Promise<CommunityMemberEntity> {
    const community = await this.findById(communityId, userId);

    // 检查社区是否被禁用
    if (community.status === 'inactive') {
      throw new ForbiddenException('该社区已被禁用，无法加入');
    }

    // 检查是否已在社区中`;

content = content.replace(oldJoin, newJoin);

fs.writeFileSync(filePath, content);
console.log('community.service.ts patched successfully');
