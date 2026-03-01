import {
  IsOptional,
  IsString,
  IsEmail,
  IsIn,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 创建报名 DTO
 */
export class CreateRegistrationDto {
  @ApiPropertyOptional({
    description: '门票类型 ID',
    example: '019ca63a-0000-7000-0000-000000000001',
  })
  @IsOptional()
  @IsString()
  ticketId?: string;

  @ApiPropertyOptional({
    description: '报名邮箱',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: '报名问卷数据（键值对，key 为字段 label）',
    example: { 姓名: '张三', 公司: 'ABC 科技' },
  })
  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}

/**
 * 查询报名列表 DTO
 */
export class QueryRegistrationDto {
  @ApiPropertyOptional({
    description: '报名状态筛选',
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'waitlisted'],
  })
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'cancelled', 'waitlisted'])
  status?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * 用户确认出席 DTO
 */
export class ConfirmAttendanceDto {
  @ApiProperty({
    description: '是否确认参加',
    example: true,
  })
  @IsBoolean()
  confirmed: boolean;
}

/**
 * 签到 DTO
 */
export class CheckInDto {
  @ApiProperty({
    description: '报名记录 ID',
    example: '019ca63a-0000-7000-0000-000000000001',
  })
  @IsString()
  registrationId: string;
}
