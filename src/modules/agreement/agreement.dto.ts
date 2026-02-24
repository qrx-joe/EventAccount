import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** 协议类型枚举值 */
export const AGREEMENT_TYPES = [
  'user-terms',
  'privacy-policy',
  'payment-agreement',
] as const;

export type AgreementType = (typeof AGREEMENT_TYPES)[number];

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
