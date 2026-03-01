import {
  Controller,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiQuery,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UploadService } from './upload.service';
import { UploadResultDto } from './upload.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** 允许的图片 MIME 类型 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/** 允许的上传目录白名单，防止路径注入 */
const ALLOWED_DIRECTORIES = ['avatars', 'covers'];

/** 最大文件大小：2MB */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * 文件上传控制器
 * 提供图片上传端点，支持头像、封面等场景
 */
@ApiTags('文件上传')
@Controller('upload')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /** 上传图片 */
  @ApiOperation({ summary: '上传图片' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'directory',
    description: '存储目录（avatars / covers）',
    required: false,
  })
  @ApiResponse({ status: 200, description: '上传成功', type: ApiResponseDto })
  @ApiResponse({ status: 400, description: '文件无效 / 目录非法' })
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
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
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('directory') directory = 'avatars',
  ): Promise<ApiResponseDto<UploadResultDto>> {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    if (!ALLOWED_DIRECTORIES.includes(directory)) {
      throw new BadRequestException(
        `不支持的目录，仅允许: ${ALLOWED_DIRECTORIES.join(', ')}`,
      );
    }

    const url = await this.uploadService.uploadImage(file, directory);
    return ApiResponseDto.ok(new UploadResultDto(url), '上传成功');
  }
}
