import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 协办人管理 DTO
 * 用于添加协办人时传入目标用户 ID
 */
export class ManageCoHostDto {
  @ApiProperty({ description: '目标用户 ID', example: 'uuid-v7-string' })
  @IsString()
  @IsNotEmpty({ message: '用户 ID 不能为空' })
  userId: string;
}
