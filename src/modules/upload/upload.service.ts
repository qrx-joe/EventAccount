import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OSS from 'ali-oss';
import { generateId } from '../../shared/utils/id-generator.js';
import { UploadResultDto } from './upload.dto.js';

/** MIME 类型到文件扩展名的映射 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * 文件上传服务
 * 对接阿里云 OSS，提供图片上传和文件删除能力
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly ossClient: OSS | null = null;
  private readonly pathSuffix: string;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('oss.accessKeyId', '');
    const accessKeySecret = this.configService.get<string>(
      'oss.accessKeySecret',
      '',
    );
    const bucket = this.configService.get<string>('oss.bucket', '');
    const region = this.configService.get<string>('oss.region', '');
    this.pathSuffix = this.configService.get<string>('oss.pathSuffix', '');

    // 配置缺失时仅警告，不阻止应用启动
    if (!accessKeyId || !accessKeySecret || !bucket || !region) {
      this.logger.warn('OSS 配置不完整，文件上传功能不可用');
      return;
    }

    this.ossClient = new OSS({
      accessKeyId,
      accessKeySecret,
      bucket,
      region,
      authorizationV4: true,
    } as OSS.Options);

    this.logger.log('OSS 客户端初始化成功');
  }

  /**
   * 上传图片到 OSS
   * @param file Multer 文件对象（内存模式）
   * @returns 上传结果，包含访问地址和对象键
   */
  async uploadImage(file: Express.Multer.File): Promise<UploadResultDto> {
    if (!this.ossClient) {
      throw new ServiceUnavailableException(
        'OSS 客户端未初始化，请检查环境变量配置',
      );
    }

    const key = this.generateUniqueKey(file.mimetype);
    const result = await this.ossClient.put(key, Buffer.from(file.buffer));

    this.logger.log(`文件上传成功: ${key}`);
    return new UploadResultDto(result.url, key);
  }

  /**
   * 从 OSS 删除文件
   * @param key OSS 对象键
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.ossClient) {
      throw new ServiceUnavailableException(
        'OSS 客户端未初始化，请检查环境变量配置',
      );
    }

    await this.ossClient.delete(key);
    this.logger.log(`文件删除成功: ${key}`);
  }

  /**
   * 生成唯一的 OSS 对象键
   * 格式: {pathSuffix}/{yyyy}/{MM}/{dd}/{uuidv7}.{ext}
   */
  private generateUniqueKey(mimetype: string): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    const ext = MIME_TO_EXT[mimetype] || 'bin';
    const id = generateId();

    return `${this.pathSuffix}/${yyyy}/${mm}/${dd}/${id}.${ext}`;
  }
}
