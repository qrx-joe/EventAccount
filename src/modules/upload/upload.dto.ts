import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 文件上传结果 DTO
 * 上传成功后返回完整访问地址和 OSS 对象键
 */
export class UploadResultDto {
  @ApiProperty({ description: '文件完整访问地址' })
  url: string;

  @ApiProperty({ description: 'OSS 对象键（用于删除）' })
  key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }
}

/**
 * 删除文件请求 DTO
 * 通过 Body 传递 key，因为 key 含 / 不适合做路径参数
 */
export class DeleteFileDto {
  @ApiProperty({ description: 'OSS 对象键' })
  @IsString()
  @IsNotEmpty()
  key: string;
}
