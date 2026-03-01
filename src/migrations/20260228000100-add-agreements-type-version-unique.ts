import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAgreementsTypeVersionUnique20260228000100 implements MigrationInterface {
  name = 'AddAgreementsTypeVersionUnique20260228000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "agreements" ADD CONSTRAINT "UQ_agreements_type_version" UNIQUE ("type", "version")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "agreements" DROP CONSTRAINT "UQ_agreements_type_version"',
    );
  }
}
