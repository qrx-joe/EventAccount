import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgreementEntity } from './agreement.entity';
import { AgreementSignEntity } from './agreement-sign.entity';
import { AgreementService } from './agreement.service';
import { AgreementController } from './agreement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AgreementEntity, AgreementSignEntity])],
  controllers: [AgreementController],
  providers: [AgreementService],
  exports: [AgreementService],
})
export class AgreementModule {}
