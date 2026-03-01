import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';
import { generateId } from '../../shared/utils/id-generator';

/** 允许的图片类型：魔数检测规则 + MIME + 扩展名 */
const IMAGE_SIGNATURES: {
  mime: string;
  ext: string;
  check: (buf: Buffer) => boolean;
}[] = [
  {
    mime: 'image/jpeg',
    ext: '.jpg',
    check: (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mime: 'image/png',
    ext: '.png',
    check: (buf) =>
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  },
  {
    mime: 'image/gif',
    ext: '.gif',
    check: (buf) =>
      buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38,
  },
  {
    mime: 'image/webp',
    ext: '.webp',
    check: (buf) =>
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50,
  },
];

/**
 * 文件上传服务
 * 负责将文件上传到阿里云 OSS 并返回访问 URL
 * 凭证缺失时跳过初始化，上传时返回友好错误
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private ossClient: OSS | null = null;
  private customDomain = '';

  constructor(private readonly configService: ConfigService) {
    this.initOssClient();
  }

  /** 初始化阿里云 OSS 客户端 */
  private initOssClient(): void {
    const accessKeyId = this.configService.get<string>('oss.accessKeyId');
    const accessKeySecret = this.configService.get<string>(
      'oss.accessKeySecret',
    );
    const bucket = this.configService.get<string>('oss.bucket');
    const region = this.configService.get<string>('oss.region');
    this.customDomain =
      this.configService.get<string>('oss.customDomain') || '';

    if (accessKeyId && accessKeySecret && bucket && region) {
      this.ossClient = new OSS({
        accessKeyId,
        accessKeySecret,
        bucket,
        region,
      });
      this.logger.log('阿里云 OSS 客户端初始化成功');
    } else {
      this.logger.warn('OSS 配置缺失，文件上传功能不可用');
    }
  }

  /**
   * 上传图片到 OSS
   * @param file multer 文件对象
   * @param directory 存储目录（如 avatars、covers）
   * @returns 文件访问 URL
   */
  async uploadImage(
    file: Express.Multer.File,
    directory: string,
  ): Promise<string> {
    if (!this.ossClient) {
      throw new BadRequestException('文件上传服务未配置，请联系管理员');
    }

    // 基于文件内容（魔数）检测真实类型，不信任客户端 mimetype / 文件名
    const detected = this.detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException(
        '不支持的文件类型，仅允许 JPG/PNG/GIF/WebP',
      );
    }

    const key = `${directory}/${generateId()}${detected.ext}`;

    try {
      await this.ossClient.put(key, file.buffer, {
        headers: { 'Content-Type': detected.mime },
      });
      const url = this.buildUrl(key);
      this.logger.log(`文件上传成功: ${key}`);
      return url;
    } catch (error) {
      this.logger.error(`文件上传失败: ${(error as Error).message}`);
      throw new InternalServerErrorException('文件上传失败，请稍后重试');
    }
  }

  /** 基于文件魔数检测图片类型，返回 null 表示不在白名单中 */
  private detectImageType(
    buffer: Buffer,
  ): { mime: string; ext: string } | null {
    if (buffer.length < 12) return null;
    return IMAGE_SIGNATURES.find((sig) => sig.check(buffer)) ?? null;
  }

  /** 构建文件访问 URL */
  private buildUrl(key: string): string {
    if (this.customDomain) {
      // 剥离可能存在的协议前缀，防止拼接出 https://https://...
      const domain = this.customDomain.replace(/^https?:\/\//, '');
      return `https://${domain}/${key}`;
    }
    const bucket = this.configService.get<string>('oss.bucket');
    const region = this.configService.get<string>('oss.region');
    return `https://${bucket}.${region}.aliyuncs.com/${key}`;
  }
}
