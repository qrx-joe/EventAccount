import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * 单个问卷字段 DTO
 */
export class RegistrationFormFieldDto {
  @ApiProperty({
    description: '字段标签',
    example: '姓名',
  })
  @IsString()
  label: string;

  @ApiProperty({
    description: '字段类型',
    enum: ['text', 'textarea', 'select', 'radio', 'checkbox', 'email', 'phone'],
    example: 'text',
  })
  @IsString()
  @IsIn(['text', 'textarea', 'select', 'radio', 'checkbox', 'email', 'phone'])
  fieldType: string;

  @ApiPropertyOptional({
    description: '选项列表（select/radio/checkbox 使用）',
    example: ['选项A', '选项B'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({
    description: '是否必填',
    example: true,
  })
  @IsBoolean()
  isRequired: boolean;

  @ApiPropertyOptional({
    description: '占位提示文本',
    example: '请输入您的姓名',
  })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiProperty({
    description: '排序权重',
    example: 1,
  })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

/**
 * 批量设置报名问卷 DTO
 * 每次提交完整的字段列表，覆盖现有配置
 */
export class SetRegistrationFormDto {
  @ApiProperty({
    description: '问卷字段列表（完整覆盖）',
    type: [RegistrationFormFieldDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistrationFormFieldDto)
  fields: RegistrationFormFieldDto[];
}
