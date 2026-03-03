import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { EventThemeEntity } from '../modules/event-theme/event-theme.entity.js';
import { generateId } from '../shared/utils/id-generator.js';

// 加载环境变量
dotenv.config();

/**
 * 活动主题种子数据
 * 预置 7 个主题模板
 */
const themes: Partial<EventThemeEntity>[] = [
  {
    id: generateId(),
    name: '简约',
    slug: 'minimal',
    colorPreset: 'neutral',
    font: 'Inter',
    appearance: 'auto',
    styles: {
      primaryColor: '#1A1A1A',
      backgroundColor: '#FFFFFF',
      accentColor: '#6366F1',
      borderRadius: '8px',
    },
    previewImage: null,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: generateId(),
    name: '量子',
    slug: 'quantum',
    colorPreset: 'cool',
    font: 'Space Grotesk',
    appearance: 'dark',
    styles: {
      primaryColor: '#E0E7FF',
      backgroundColor: '#0F172A',
      accentColor: '#818CF8',
      borderRadius: '12px',
      backgroundGradient: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)',
    },
    previewImage: null,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: generateId(),
    name: '扭曲',
    slug: 'warp',
    colorPreset: 'neon',
    font: 'Orbitron',
    appearance: 'dark',
    styles: {
      primaryColor: '#F0ABFC',
      backgroundColor: '#18181B',
      accentColor: '#A855F7',
      borderRadius: '16px',
      backgroundEffect: 'warp-grid',
    },
    previewImage: null,
    sortOrder: 3,
    isActive: true,
  },
  {
    id: generateId(),
    name: '表情符号',
    slug: 'emoji',
    colorPreset: 'warm',
    font: 'Nunito',
    appearance: 'light',
    styles: {
      primaryColor: '#1F2937',
      backgroundColor: '#FEF9C3',
      accentColor: '#F59E0B',
      borderRadius: '20px',
      backgroundPattern: 'emoji-scatter',
    },
    previewImage: null,
    sortOrder: 4,
    isActive: true,
  },
  {
    id: generateId(),
    name: '彩纸',
    slug: 'confetti',
    colorPreset: 'pastel',
    font: 'Poppins',
    appearance: 'light',
    styles: {
      primaryColor: '#374151',
      backgroundColor: '#FFFFFF',
      accentColor: '#EC4899',
      borderRadius: '12px',
      backgroundEffect: 'confetti-animation',
    },
    previewImage: null,
    sortOrder: 5,
    isActive: true,
  },
  {
    id: generateId(),
    name: '图案',
    slug: 'pattern',
    colorPreset: 'neutral',
    font: 'DM Sans',
    appearance: 'auto',
    styles: {
      primaryColor: '#111827',
      backgroundColor: '#F9FAFB',
      accentColor: '#3B82F6',
      borderRadius: '8px',
      backgroundPattern: 'geometric-tiles',
    },
    previewImage: null,
    sortOrder: 6,
    isActive: true,
  },
  {
    id: generateId(),
    name: '季节限定',
    slug: 'seasonal',
    colorPreset: 'warm',
    font: 'Playfair Display',
    appearance: 'light',
    styles: {
      primaryColor: '#1C1917',
      backgroundColor: '#FFF7ED',
      accentColor: '#EA580C',
      borderRadius: '10px',
      backgroundPattern: 'seasonal-leaves',
    },
    previewImage: null,
    sortOrder: 7,
    isActive: true,
  },
];

/**
 * 执行种子数据插入
 * 使用 upsert 避免重复插入
 */
async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [EventThemeEntity],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('数据库连接成功');

  const repo = dataSource.getRepository(EventThemeEntity);

  for (const theme of themes) {
    // 检查是否已存在
    const exists = await repo.findOne({ where: { slug: theme.slug } });
    if (exists) {
      console.log(`主题 "${theme.name}" (${theme.slug}) 已存在，跳过`);
      continue;
    }

    await repo.save(repo.create(theme));
    console.log(`主题 "${theme.name}" (${theme.slug}) 创建成功`);
  }

  console.log('种子数据插入完成');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('种子数据插入失败:', err);
  process.exit(1);
});
