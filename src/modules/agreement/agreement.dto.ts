import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

/** 协议类型枚举值 */
export const AGREEMENT_TYPES = [
  'user-terms',
  'privacy-policy',
  'payment-agreement',
] as const;

export type AgreementType = (typeof AGREEMENT_TYPES)[number];

/**
 * 协议类型参数校验管道
 * 校验路径参数是否为合法的协议类型，不合法则抛出 400 错误
 */
@Injectable()
export class ParseAgreementTypePipe implements PipeTransform<
  string,
  AgreementType
> {
  transform(value: string): AgreementType {
    if (!AGREEMENT_TYPES.includes(value as AgreementType)) {
      throw new BadRequestException(
        `无效的协议类型: ${value}，合法值为: ${AGREEMENT_TYPES.join(', ')}`,
      );
    }
    return value as AgreementType;
  }
}

/** 签署协议请求体 */
export class SignAgreementDto {
  @ApiProperty({
    description: '协议类型',
    enum: AGREEMENT_TYPES,
    example: 'user-terms',
  })
  @IsString()
  @IsIn([...AGREEMENT_TYPES], { message: '无效的协议类型' })
  agreementType: AgreementType;
}
