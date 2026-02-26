import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AgreementService } from './agreement.service';
import { SignAgreementDto } from './agreement.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/auth.dto';
import { AgreementEntity } from './agreement.entity';
import { AgreementSignEntity } from './agreement-sign.entity';

/**
 * 协议控制器
 * 提供协议查询、签署、签署记录查询接口
 */
@ApiTags('协议')
@Controller('agreements')
export class AgreementController {
  constructor(private readonly agreementService: AgreementService) {}

  /** 查询用户签署记录（需登录，放在 :type 路由之前避免路径冲突） */
  @ApiOperation({ summary: '查询当前用户协议签署记录' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未登录' })
  @UseGuards(JwtAuthGuard)
  @Get('signed')
  async getUserSigned(
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<AgreementSignEntity[]>> {
    const records = await this.agreementService.getUserSigned(req.user.sub);
    return ApiResponseDto.ok(records);
  }

  /** 获取某类型最新协议内容（无需登录） */
  @ApiOperation({ summary: '获取协议内容（按类型）' })
  @ApiParam({ name: 'type', description: '协议类型', example: 'user-terms' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: '协议不存在' })
  @Get(':type')
  async getByType(
    @Param('type') type: string,
  ): Promise<ApiResponseDto<AgreementEntity>> {
    const agreement = await this.agreementService.getLatestByType(type);
    return ApiResponseDto.ok(agreement);
  }

  /** 签署协议（需登录） */
  @ApiOperation({ summary: '签署协议' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '签署成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未登录' })
  @ApiResponse({ status: 404, description: '协议不存在' })
  @UseGuards(JwtAuthGuard)
  @Post('sign')
  async sign(
    @Body() dto: SignAgreementDto,
    @Req() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<AgreementSignEntity>> {
    const record = await this.agreementService.signAgreement(
      req.user.sub,
      dto.agreementType,
    );
    return ApiResponseDto.ok(record, '签署成功');
  }
}
