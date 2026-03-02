import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../user/user.entity';

/** Reflector 元数据 key */
export const ROLES_KEY = 'roles';

/**
 * 角色装饰器
 * 标记接口或控制器所需的最低角色
 * 配合 RolesGuard 使用
 *
 * @example @Roles(UserRole.ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
