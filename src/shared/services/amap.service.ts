import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** 高德 API 通用响应结构 */
interface AmapBaseResponse {
  status: string;
  info: string;
  [key: string]: unknown;
}

/** 高德原始 POI 数据 */
interface AmapRawPoiItem {
  id: string;
  name: string;
  address: string;
  /** 格式：经度,纬度 */
  location: string;
  pname: string;
  cityname: string;
  adname: string;
  [key: string]: unknown;
}

/** 精简后的 POI 搜索结果项（只保留前端需要的字段） */
export interface AmapPoiItem {
  id: string;
  name: string;
  address: string;
  /** 格式：经度,纬度 */
  location: string;
  province: string;
  city: string;
  district: string;
}

/** POI 搜索响应（高德原始结构） */
interface AmapPlaceResponse extends AmapBaseResponse {
  count: string;
  pois: AmapRawPoiItem[];
}

/** 地理编码结果项 */
interface AmapGeocodeItem {
  formatted_address: string;
  location: string;
  level: string;
}

/** 地理编码响应 */
interface AmapGeocodeResponse extends AmapBaseResponse {
  geocodes: AmapGeocodeItem[];
}

/** 逆地理编码响应 */
interface AmapRegeoResponse extends AmapBaseResponse {
  regeocode: {
    formatted_address: string;
    addressComponent: {
      province: string;
      city: string | string[];
      district: string;
      streetNumber: {
        street: string;
        number: string;
      };
    };
  };
}

/**
 * 高德地图 Web 服务
 * 提供 POI 搜索、地理编码、逆地理编码能力
 */
@Injectable()
export class AmapService {
  private readonly logger = new Logger(AmapService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('amap.key', '');
    this.baseUrl = this.configService.get<string>(
      'amap.baseUrl',
      'https://restapi.amap.com/v3',
    );

    if (!this.apiKey) {
      this.logger.warn('AMAP_KEY 未配置，地图服务不可用');
    } else {
      this.logger.log('高德地图服务初始化成功');
    }
  }

  /**
   * 关键词搜索 POI
   * @param keywords 搜索关键词
   * @param city 城市名称或 adcode（可选，限定搜索范围）
   * @param page 页码，从 1 开始
   * @param limit 每页数量，最大 25
   */
  async searchPlace(
    keywords: string,
    city?: string,
    page = 1,
    limit = 10,
  ): Promise<{ count: number; pois: AmapPoiItem[] }> {
    const params: Record<string, string> = {
      keywords,
      offset: String(limit),
      page: String(page),
    };
    if (city) {
      params.city = city;
      params.citylimit = 'true';
    }

    const data = await this.request<AmapPlaceResponse>('/place/text', params);
    // 映射为精简结构，过滤高德原始数据中的冗余字段
    const pois: AmapPoiItem[] = (data.pois || []).map((poi) => ({
      id: poi.id,
      name: poi.name,
      address: typeof poi.address === 'string' ? poi.address : '',
      location: poi.location,
      province: poi.pname,
      city: poi.cityname,
      district: poi.adname,
    }));
    return { count: parseInt(data.count, 10) || 0, pois };
  }

  /**
   * 地理编码：地址 -> 坐标
   * @param address 结构化地址
   * @param city 城市名称（可选，提高精度）
   */
  async geocode(address: string, city?: string): Promise<AmapGeocodeItem[]> {
    const params: Record<string, string> = { address };
    if (city) {
      params.city = city;
    }

    const data = await this.request<AmapGeocodeResponse>(
      '/geocode/geo',
      params,
    );
    return data.geocodes || [];
  }

  /**
   * 逆地理编码：坐标 -> 地址
   * @param longitude 经度
   * @param latitude 纬度
   */
  async reverseGeocode(
    longitude: number,
    latitude: number,
  ): Promise<AmapRegeoResponse['regeocode']> {
    const data = await this.request<AmapRegeoResponse>('/geocode/regeo', {
      location: `${longitude},${latitude}`,
    });
    return data.regeocode;
  }

  /**
   * 通用请求方法：拼接 key、处理错误
   */
  private async request<T extends AmapBaseResponse>(
    path: string,
    params: Record<string, string>,
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        '高德地图服务未配置，请检查 AMAP_KEY',
      );
    }

    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('key', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    this.logger.debug(`请求高德 API: ${path}, 参数: ${JSON.stringify(params)}`);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`高德 API 网络异常: ${message}`);
      throw new ServiceUnavailableException('高德地图服务暂不可用，请稍后重试');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `高德 API 请求失败: HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as T;

    // 高德 API 业务状态检查：status=1 表示成功
    if (data.status !== '1') {
      this.logger.error(`高德 API 业务错误: ${data.info}`);
      throw new ServiceUnavailableException(`高德 API 返回错误: ${data.info}`);
    }

    return data;
  }
}
