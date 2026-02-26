import {
  Injectable,
  NotFoundException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgreementEntity } from './agreement.entity';
import { AgreementSignEntity } from './agreement-sign.entity';
import { AgreementType } from './agreement.dto';
import { generateId } from '../../shared/utils/id-generator';

/**
 * 协议服务
 * 管理协议内容、签署记录，启动时 seed 默认协议
 */
@Injectable()
export class AgreementService implements OnModuleInit {
  private readonly logger = new Logger(AgreementService.name);

  constructor(
    @InjectRepository(AgreementEntity)
    private readonly agreementRepo: Repository<AgreementEntity>,
    @InjectRepository(AgreementSignEntity)
    private readonly signRepo: Repository<AgreementSignEntity>,
  ) {}

  /** 启动时写入默认协议数据（幂等） */
  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  /** 查询某类型最新版协议 */
  async getLatestByType(type: string): Promise<AgreementEntity> {
    const agreement = await this.agreementRepo.findOne({
      where: { type },
      order: { effectiveDate: 'DESC' },
    });
    if (!agreement) {
      throw new NotFoundException(`协议类型 "${type}" 不存在`);
    }
    return agreement;
  }

  /** 签署协议（upsert：同一用户同一类型覆盖旧记录） */
  async signAgreement(
    userId: string,
    agreementType: AgreementType,
  ): Promise<AgreementSignEntity> {
    const agreement = await this.getLatestByType(agreementType);

    // upsert：存在则更新版本和签署时间，不存在则插入
    const existing = await this.signRepo.findOne({
      where: { userId, agreementType },
    });

    if (existing) {
      existing.version = agreement.version;
      existing.signedAt = new Date();
      return this.signRepo.save(existing);
    }

    const sign = this.signRepo.create({
      userId,
      agreementType,
      version: agreement.version,
    });
    return this.signRepo.save(sign);
  }

  /** 注册时自动签署用户条款 + 隐私政策 */
  async autoSignOnRegister(userId: string): Promise<void> {
    const types: AgreementType[] = ['user-terms', 'privacy-policy'];
    for (const type of types) {
      try {
        await this.signAgreement(userId, type);
      } catch (err) {
        // seed 数据未就绪时不阻塞注册流程，仅记录警告
        this.logger.warn(
          `自动签署协议 "${type}" 失败: ${(err as Error).message}`,
        );
      }
    }
    this.logger.log(`用户 ${userId} 自动签署注册协议完成`);
  }

  /** 查询用户全部签署记录 */
  async getUserSigned(userId: string): Promise<AgreementSignEntity[]> {
    return this.signRepo.find({
      where: { userId },
      order: { signedAt: 'DESC' },
    });
  }

  /** 幂等写入默认协议 seed 数据 */
  private async seedDefaults(): Promise<void> {
    const seeds: Array<{
      type: AgreementType;
      title: string;
      version: string;
      content: string;
    }> = [
      {
        type: 'user-terms',
        title: '用户服务协议',
        version: '1.0.0',
        content:
          '# 用户服务协议\n\n欢迎使用 T3 Program 平台。使用本平台即表示您同意遵守以下条款。\n\n## 1. 服务内容\n\n本平台提供线上活动报名与管理服务。\n\n## 2. 用户责任\n\n用户应提供真实信息，不得发布违法内容。\n\n## 3. 隐私保护\n\n我们重视您的隐私，详见《隐私政策》。',
      },
      {
        type: 'privacy-policy',
        title: '隐私政策',
        version: '1.0.0',
        content:
          '# 隐私政策\n\n本政策说明 T3 Program 如何收集、使用和保护您的个人信息。\n\n## 1. 信息收集\n\n我们收集您注册时提供的手机号、昵称等基本信息。\n\n## 2. 信息使用\n\n仅用于平台服务运营和用户身份验证。\n\n## 3. 信息安全\n\n采用加密存储和传输，定期安全审计。',
      },
    ];

    for (const seed of seeds) {
      const exists = await this.agreementRepo.findOne({
        where: { type: seed.type, version: seed.version },
      });
      if (!exists) {
        const entity = this.agreementRepo.create({
          id: generateId(),
          ...seed,
          effectiveDate: new Date(),
        });
        await this.agreementRepo.save(entity);
        this.logger.log(`Seed 协议: ${seed.title} v${seed.version}`);
      }
    }
  }
}
