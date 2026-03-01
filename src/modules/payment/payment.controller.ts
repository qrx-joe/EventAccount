import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { PaymentService } from './payment.service.js';
import { PaymentOrderEntity } from './payment-order.entity.js';
import { CreatePaymentDto, RefundDto, QueryOrderDto } from './payment.dto.js';
import { JwtPayload } from '../auth/auth.dto.js';

/**
 * 支付控制器
 * 处理支付订单创建、回调、退款和查询
 */
@ApiTags('支付')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 创建支付订单
   * 需要登录
   */
  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建支付订单' })
  @ApiResponse({ status: 201, description: '订单创建成功' })
  @ApiResponse({ status: 400, description: '免费门票无需支付/活动未发布' })
  @ApiResponse({ status: 404, description: '活动/门票/报名不存在' })
  async createOrder(
    @Body() dto: CreatePaymentDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ order: PaymentOrderEntity; payUrl: string }>> {
    const result = await this.paymentService.createOrder(req.user.sub, dto);
    return ApiResponseDto.created(result);
  }

  /**
   * 微信支付回调
   * 公开接口，由微信服务器调用
   * Mock 实现：接收 out_trade_no 和 transaction_id 即可
   *
   * TODO: 正式上线前需添加微信支付 IP 白名单校验和签名验证，防止伪造回调
   */
  @Post('wechat/callback')
  @ApiOperation({ summary: '微信支付回调' })
  @ApiResponse({ status: 200, description: '处理成功' })
  async wechatCallback(
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponseDto<null>> {
    await this.paymentService.handleWechatCallback(body);
    return ApiResponseDto.ok(null, '处理成功');
  }

  /**
   * 支付宝支付回调
   * 公开接口，由支付宝服务器调用
   * Mock 实现：接收 out_trade_no 和 trade_no 即可
   *
   * TODO: 正式上线前需添加支付宝签名验证和来源校验，防止伪造回调
   */
  @Post('alipay/callback')
  @ApiOperation({ summary: '支付宝支付回调' })
  @ApiResponse({ status: 200, description: '处理成功' })
  async alipayCallback(
    @Body() body: Record<string, unknown>,
  ): Promise<ApiResponseDto<null>> {
    await this.paymentService.handleAlipayCallback(body);
    return ApiResponseDto.ok(null, '处理成功');
  }

  /**
   * 获取我的订单列表
   * 需要登录
   */
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取我的订单列表' })
  @ApiQuery({ name: 'status', required: false, description: '订单状态筛选' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getMyOrders(
    @Query() query: QueryOrderDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ items: PaymentOrderEntity[]; total: number }>> {
    const result = await this.paymentService.getMyOrders(req.user.sub, query);
    return ApiResponseDto.ok(result);
  }

  /**
   * 获取订单详情
   * 需要登录，仅订单所属用户可查看
   */
  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取订单详情' })
  @ApiParam({ name: 'id', description: '订单 ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 403, description: '无权查看' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  async getOrderDetail(
    @Param('id') id: string,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<PaymentOrderEntity>> {
    const order = await this.paymentService.getOrderDetail(id, req.user.sub);
    return ApiResponseDto.ok(order);
  }

  /**
   * 退款
   * 需要登录，仅活动创建者可操作
   */
  @Post('orders/:id/refund')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '退款' })
  @ApiParam({ name: 'id', description: '订单 ID' })
  @ApiResponse({ status: 200, description: '退款成功' })
  @ApiResponse({ status: 400, description: '当前状态无法退款' })
  @ApiResponse({ status: 403, description: '无权操作' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  async refund(
    @Param('id') id: string,
    @Body() _dto: RefundDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<PaymentOrderEntity>> {
    const order = await this.paymentService.refund(id, req.user.sub);
    return ApiResponseDto.ok(order);
  }

  /**
   * Mock 模拟支付成功
   * 开发/测试环境使用，通过订单号模拟支付回调
   */
  @Post('mock-pay/:orderNo')
  @ApiOperation({ summary: 'Mock 模拟支付成功（开发测试用）' })
  @ApiParam({ name: 'orderNo', description: '订单号' })
  @ApiResponse({ status: 200, description: '模拟支付成功' })
  @ApiResponse({ status: 400, description: '订单不是待支付状态' })
  @ApiResponse({ status: 404, description: '订单不存在' })
  async mockPaySuccess(
    @Param('orderNo') orderNo: string,
  ): Promise<ApiResponseDto<PaymentOrderEntity>> {
    const order = await this.paymentService.mockPaySuccess(orderNo);
    return ApiResponseDto.ok(order);
  }
}

/**
 * 活动支付订单控制器
 * 处理以 /events/:eventId 为前缀的支付相关路由
 */
@ApiTags('支付')
@Controller('events/:eventId')
export class EventPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 获取活动的所有支付订单
   * 需要登录，仅活动创建者可查看
   */
  @Get('payment-orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取活动的支付订单列表' })
  @ApiParam({ name: 'eventId', description: '活动 ID' })
  @ApiQuery({ name: 'status', required: false, description: '订单状态筛选' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 403, description: '无权查看' })
  async getEventPaymentOrders(
    @Param('eventId') eventId: string,
    @Query() query: QueryOrderDto,
    @Request() req: { user: JwtPayload },
  ): Promise<ApiResponseDto<{ items: PaymentOrderEntity[]; total: number }>> {
    const result = await this.paymentService.getEventPaymentOrders(
      eventId,
      req.user.sub,
      query,
    );
    return ApiResponseDto.ok(result);
  }
}
