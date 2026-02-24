import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponseDto } from '../dto/api-response.dto';

/**
 * 全局异常过滤器
 * 捕获所有异常（包括非 HTTP 异常），返回标准响应格式
 * - HttpException: 提取状态码和消息
 * - 其他异常: 返回 500，生产环境不暴露细节
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // 提取错误信息
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string | string[] }).message
            ? Array.isArray(
                (exceptionResponse as { message: string[] }).message,
              )
              ? (exceptionResponse as { message: string[] }).message[0]
              : (exceptionResponse as { message: string }).message
            : exception.message;

      this.logger.warn(
        `[${request.method}] ${request.url} -> ${status}: ${message}`,
      );
    } else {
      // 非 HttpException：记录完整错误，返回通用 500
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '服务器内部错误';

      const errorDetail =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `[${request.method}] ${request.url} -> 未捕获异常: ${errorDetail}`,
      );
    }

    response.status(status).json(ApiResponseDto.fail(status, message));
  }
}
