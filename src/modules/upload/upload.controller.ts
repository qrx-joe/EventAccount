import {
  Controller,
  Post,
  Delete,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiResponseDto } from '../../common/dto/api-response.dto.js';
import { UploadService } from './upload.service.js';
import { UploadResultDto, DeleteFileDto } from './upload.dto.js';

/** 允许的图片 MIME 类型 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/** 5MB 文件大小限制 */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

@ApiTags('文件上传')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 上传图片
   * 支持 jpeg、png、webp、gif 格式，最大 5MB
   */
  @Post('image')
  @ApiOperation({ summary: '上传图片' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: '图片文件' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: '上传成功' })
  @UseInterceptors(
    FileInterceptor('file'), {
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new BadRequestException(
            '不支持的文件类型，仅允许 JPG/PNG/GIF/WebP',
          ),
          false,
        );
      }
    },
  })
  async uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<ApiResponseDto<UploadResultDto>> {
    const result = await this.uploadService.uploadImage(file);
    return ApiResponseDto.created(result, '上传成功');
  }

  /**
   * 删除文件
   * 通过 Body 传递 OSS 对象键
   */
  @Delete()
  @ApiOperation({ summary: '删除文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteFile(@Body() dto: DeleteFileDto): Promise<ApiResponseDto<null>> {
    await this.uploadService.deleteFile(dto.key);
    return ApiResponseDto.ok(null, '删除成功');
  }
}
