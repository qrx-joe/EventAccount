import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 日历及订阅表迁移
 * 创建 calendars 和 calendar_subscriptions 表
 */
export class AddCalendarTables20260306000100 implements MigrationInterface {
  name = 'AddCalendarTables20260306000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 检查表是否已存在
    const calendarTableExists = await queryRunner.hasTable('calendars');
    const subscriptionTableExists = await queryRunner.hasTable(
      'calendar_subscriptions',
    );

    if (!calendarTableExists) {
      // 创建日历表
      await queryRunner.query(`
        CREATE TABLE "calendars" (
          "id" character varying(36) NOT NULL,
          "communityId" character varying(36) NOT NULL,
          "creatorId" character varying(36) NOT NULL,
          "name" character varying(100) NOT NULL,
          "description" text,
          "status" character varying(20) NOT NULL DEFAULT 'active',
          "themeColor" character varying(50),
          "isPublic" boolean NOT NULL DEFAULT true,
          "subscriberCount" integer NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_calendars" PRIMARY KEY ("id")
        )
      `);

      // 创建索引
      await queryRunner.query(`
        CREATE INDEX "idx_calendars_community_id" ON "calendars" ("communityId")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_calendars_creator_id" ON "calendars" ("creatorId")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_calendars_status" ON "calendars" ("status")
      `);

      // 添加外键
      await queryRunner.query(`
        ALTER TABLE "calendars"
        ADD CONSTRAINT "FK_calendars_community"
        FOREIGN KEY ("communityId")
        REFERENCES "communities"("id")
        ON DELETE CASCADE
      `);
    }

    if (!subscriptionTableExists) {
      // 创建订阅表
      await queryRunner.query(`
        CREATE TABLE "calendar_subscriptions" (
          "id" character varying(36) NOT NULL,
          "userId" character varying(36) NOT NULL,
          "calendarId" character varying(36) NOT NULL,
          "receiveNotification" boolean NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_calendar_subscriptions" PRIMARY KEY ("id")
        )
      `);

      // 创建索引
      await queryRunner.query(`
        CREATE INDEX "idx_calendar_subscriptions_user_id" ON "calendar_subscriptions" ("userId")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_calendar_subscriptions_calendar_id" ON "calendar_subscriptions" ("calendarId")
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "idx_calendar_subscriptions_user_calendar" ON "calendar_subscriptions" ("userId", "calendarId")
      `);

      // 添加外键
      await queryRunner.query(`
        ALTER TABLE "calendar_subscriptions"
        ADD CONSTRAINT "FK_calendar_subscriptions_calendar"
        FOREIGN KEY ("calendarId")
        REFERENCES "calendars"("id")
        ON DELETE CASCADE
      `);
      await queryRunner.query(`
        ALTER TABLE "calendar_subscriptions"
        ADD CONSTRAINT "FK_calendar_subscriptions_user"
        FOREIGN KEY ("userId")
        REFERENCES "users"("id")
        ON DELETE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除订阅表
    const subscriptionTableExists = await queryRunner.hasTable(
      'calendar_subscriptions',
    );
    if (subscriptionTableExists) {
      await queryRunner.query(`DROP TABLE "calendar_subscriptions"`);
    }

    // 删除日历表
    const calendarTableExists = await queryRunner.hasTable('calendars');
    if (calendarTableExists) {
      await queryRunner.query(`DROP TABLE "calendars"`);
    }
  }
}
