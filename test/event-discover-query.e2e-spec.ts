import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { closeE2eApp, createE2eApp } from './e2e-helpers';
import { parseApiResponse } from './api-response-test-utils';
import { UserEntity } from '../src/modules/user/user.entity';
import { CategoryEntity } from '../src/modules/category/category.entity';
import { EventEntity } from '../src/modules/event/event.entity';
import { EventTicketEntity } from '../src/modules/event/event-ticket.entity';

type EventListData = {
  id: string;
  title: string;
  startTime: string;
  locationType: 'offline' | 'online';
  locationName: string | null;
};

type EventListResponse = {
  items: EventListData[];
  total: number;
};

type DiscoverCityRegionResponse = {
  key: 'asia' | 'north-america' | 'europe';
  label: string;
  cities: Array<{ name: string; count: number }>;
};

function getHttpServer(app: INestApplication): App {
  return app.getHttpServer() as unknown as App;
}

describe('活动发现查询能力 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userRepository: Repository<UserEntity>;
  let categoryRepository: Repository<CategoryEntity>;
  let eventRepository: Repository<EventEntity>;
  let ticketRepository: Repository<EventTicketEntity>;

  beforeAll(async () => {
    app = await createE2eApp();
    dataSource = app.get(DataSource);
    userRepository = dataSource.getRepository(UserEntity);
    categoryRepository = dataSource.getRepository(CategoryEntity);
    eventRepository = dataSource.getRepository(EventEntity);
    ticketRepository = dataSource.getRepository(EventTicketEntity);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "event_tickets", "events", "categories", "agreement_signs", "users" RESTART IDENTITY CASCADE;',
    );

    const creator = await userRepository.save(
      userRepository.create({
        phone: '13800138099',
        nickname: '发现测试用户',
      }),
    );

    const category = await categoryRepository.save(
      categoryRepository.create({
        name: 'AI',
        slug: 'ai-discover-test',
        description: '发现页查询测试分类',
      }),
    );

    const eventA = await eventRepository.save(
      eventRepository.create({
        creatorId: creator.id,
        categoryId: category.id,
        title: 'AI 上海 热门活动',
        startTime: new Date('2026-04-01T09:00:00.000Z'),
        endTime: new Date('2026-04-01T11:00:00.000Z'),
        locationType: 'offline',
        locationName: '上海 浦东',
        locationAddress: '上海市浦东新区世纪大道',
        status: 'published',
      }),
    );

    const eventB = await eventRepository.save(
      eventRepository.create({
        creatorId: creator.id,
        categoryId: category.id,
        title: 'AI 北京 线下活动',
        startTime: new Date('2026-04-05T09:00:00.000Z'),
        endTime: new Date('2026-04-05T11:00:00.000Z'),
        locationType: 'offline',
        locationName: '北京 朝阳',
        locationAddress: '北京市朝阳区望京',
        status: 'published',
      }),
    );

    const eventC = await eventRepository.save(
      eventRepository.create({
        creatorId: creator.id,
        categoryId: category.id,
        title: 'AI 线上直播活动',
        startTime: new Date('2026-04-03T09:00:00.000Z'),
        endTime: new Date('2026-04-03T11:00:00.000Z'),
        locationType: 'online',
        locationName: '线上直播间',
        status: 'published',
      }),
    );

    const eventD = await eventRepository.save(
      eventRepository.create({
        creatorId: creator.id,
        categoryId: category.id,
        title: 'AI 上海 草稿活动',
        startTime: new Date('2026-04-02T09:00:00.000Z'),
        endTime: new Date('2026-04-02T11:00:00.000Z'),
        locationType: 'offline',
        locationName: '上海 徐汇',
        status: 'draft',
      }),
    );

    await ticketRepository.save(
      ticketRepository.create({
        eventId: eventA.id,
        name: '普通票',
        soldCount: 50,
      }),
    );
    await ticketRepository.save(
      ticketRepository.create({
        eventId: eventB.id,
        name: '普通票',
        soldCount: 10,
      }),
    );
    await ticketRepository.save(
      ticketRepository.create({
        eventId: eventC.id,
        name: '普通票',
        soldCount: 0,
      }),
    );

    void eventD;
  });

  afterAll(async () => {
    await closeE2eApp(app);
  });

  it('支持 city + locationType + status 组合筛选', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/events')
      .query({
        status: 'published',
        city: '上海',
        locationType: 'offline',
      })
      .expect(200);

    const body = parseApiResponse<EventListResponse>(res);
    expect(body.success).toBe(true);
    expect(body.data?.items.length).toBe(1);
    expect(body.data?.items[0]?.title).toBe('AI 上海 热门活动');
    expect(body.data?.total).toBe(1);
  });

  it('支持 dateStart/dateEnd 过滤时间范围', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/events')
      .query({
        status: 'published',
        dateStart: '2026-04-02T00:00:00.000Z',
        dateEnd: '2026-04-04T00:00:00.000Z',
      })
      .expect(200);

    const body = parseApiResponse<EventListResponse>(res);
    const titles = (body.data?.items ?? []).map((item) => item.title);
    expect(titles).toEqual(['AI 线上直播活动']);
    expect(body.data?.total).toBe(1);
  });

  it('sortBy=upcoming 时按开始时间升序返回', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/events')
      .query({ status: 'published', sortBy: 'upcoming' })
      .expect(200);

    const body = parseApiResponse<EventListResponse>(res);
    const startTimes = (body.data?.items ?? []).map((item) =>
      new Date(item.startTime).getTime(),
    );
    const sorted = [...startTimes].sort((a, b) => a - b);
    expect(startTimes).toEqual(sorted);
  });

  it('sortBy=trending 时按已售门票数量优先', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/events')
      .query({ status: 'published', sortBy: 'trending' })
      .expect(200);

    const body = parseApiResponse<EventListResponse>(res);
    expect(body.data?.items[0]?.title).toBe('AI 上海 热门活动');
    expect(body.data?.items[1]?.title).toBe('AI 北京 线下活动');
  });

  it('城市探索接口仅统计已发布线下活动', async () => {
    const res = await request(getHttpServer(app))
      .get('/api/events/cities')
      .query({ region: 'asia' })
      .expect(200);

    const body = parseApiResponse<DiscoverCityRegionResponse[]>(res);
    expect(body.data?.length).toBe(1);
    expect(body.data?.[0]?.key).toBe('asia');

    const shanghai = body.data?.[0]?.cities.find(
      (item) => item.name === '上海',
    );
    const beijing = body.data?.[0]?.cities.find((item) => item.name === '北京');

    expect(shanghai?.count).toBe(1);
    expect(beijing?.count).toBe(1);
  });
});
