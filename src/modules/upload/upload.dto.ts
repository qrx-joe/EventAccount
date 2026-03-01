/**
 * 上传结果 DTO
 */
export class UploadResultDto {
  /** 文件访问 URL */
  url: string;

  constructor(url: string) {
    this.url = url;
  }
}
