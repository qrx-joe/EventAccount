import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/** 通用分页查询参数 */
export class PaginationQueryDto {
  @ApiProperty({
    description: '页码（从 1 开始）',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: '每页条数（1-100）',
    example: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}

/** 通用分页返回结构 */
export class PaginatedResult<T> {
  /** 当前页数据 */
  items: T[];

  /** 总条数 */
  total: number;

  /** 当前页码 */
  page: number;

  /** 每页条数 */
  pageSize: number;

  /** 总页数 */
  totalPages: number;

  constructor(items: T[], total: number, page: number, pageSize: number) {
    this.items = items;
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
    this.totalPages = Math.ceil(total / pageSize);
  }
}
