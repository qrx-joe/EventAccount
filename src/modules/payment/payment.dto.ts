import { IsString, IsIn, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 创建支付订单 DTO
 */
export class CreatePaymentDto {
  @ApiProperty({
    description: '活动 ID',
    example: '019ca63a-033c-7bbd-a153-a3b5dbf953eb',
  })
  @IsString()
  eventId: string;

  @ApiProperty({
    description: '门票 ID',
    example: '019ca63a-0000-7000-0000-000000000001',
  })
  @IsString()
  ticketId: string;

  @ApiProperty({
    description: '报名记录 ID',
    example: '019ca63a-0000-7000-0000-000000000002',
  })
  @IsString()
  registrationId: string;

  @ApiProperty({
    description: '支付方式',
    enum: ['wechat', 'alipay'],
    example: 'wechat',
  })
  @IsString()
  @IsIn(['wechat', 'alipay'])
  paymentMethod: string;
}

/**
 * 退款 DTO
 */
export class RefundDto {
  @ApiPropertyOptional({
    description: '退款原因',
    example: '用户主动取消',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * 查询我的订单列表 DTO
 */
export class QueryOrderDto {
  @ApiPropertyOptional({
    description: '订单状态筛选',
    enum: ['pending', 'paid', 'refunded', 'cancelled'],
  })
  @IsOptional()
  @IsIn(['pending', 'paid', 'refunded', 'cancelled'])
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
