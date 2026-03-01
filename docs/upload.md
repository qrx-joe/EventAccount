# 文件上传模块

## 模块职责

负责文件上传到阿里云 OSS，返回 CDN 访问 URL。当前支持头像上传场景，可复用于活动封面等。

## 架构设计

### 后端

| 文件 | 职责 |
|------|------|
| `src/config/oss.config.ts` | OSS 配置（registerAs 模式，读取环境变量） |
| `src/modules/upload/upload.controller.ts` | 上传路由，multer 文件拦截 + 安全校验 |
| `src/modules/upload/upload.service.ts` | OSS 客户端管理与文件上传 |
| `src/modules/upload/upload.dto.ts` | 上传结果 DTO |
| `src/modules/upload/upload.module.ts` | 模块声明，exports UploadService 供其他模块复用 |

### 前端

| 文件 | 职责 |
|------|------|
| `frontend/src/lib/upload.ts` | 上传 API 调用封装（FormData + axios） |
| `frontend/src/components/AvatarUpload.vue` | 头像上传组件（v-model 绑定 URL） |
| `frontend/src/types/index.ts` | `UploadResult` 类型定义 |

## 核心功能

### 1. 图片上传

- **上传流程**: 前端选择文件 → multer 接收到内存 → 后端上传到 OSS → 返回访问 URL
- **设计决策**: 服务端中转模式（非 STS 直传），头像等小文件场景够用，安全性更高
- **后端入口**: `upload.controller.ts:uploadImage()` → `upload.service.ts:uploadImage()`
- **文件命名**: `{directory}/{UUIDv7}.{ext}`，不使用用户原始文件名，防止路径注入
- **URL 构建**: 优先使用 `OSS_CUSTOM_DOMAIN`，否则拼接 `{bucket}.{region}.aliyuncs.com`

### 2. 头像上传（前端）

- **组件**: `AvatarUpload.vue`，支持 `v-model` 双向绑定当前头像 URL
- **交互**: 点击头像圆形区域 → 选择文件 → 本地预览（`URL.createObjectURL`） → 上传 → 成功 emit URL / 失败回退
- **即时保存**: `ProfileSection.vue` 中上传成功后立即调用 `PUT /users/:id` 保存，不依赖表单提交按钮
- **UI 反馈**: hover 显示相机图标遮罩，上传中显示 loading spinner

## 安全设计

| 层级 | 机制 | 说明 |
|------|------|------|
| 认证 | `JwtAuthGuard` | 上传端点需登录 |
| 文件类型 | 前后端双层 | 前端 `accept` + JS 校验，后端 multer `fileFilter` MIME 白名单 |
| 文件大小 | 前后端双层 | 前端 JS 2MB 校验，后端 multer `limits.fileSize` 2MB |
| 路径安全 | 目录白名单 | `['avatars', 'covers']`，拒绝任意目录写入 |
| 文件名安全 | UUIDv7 生成 | 不使用用户上传的原始文件名 |

## 降级策略

- **OSS 凭证缺失**: Service 初始化时跳过 OSS 客户端创建，上传时返回 `400 文件上传服务未配置，请联系管理员`
- **参考模式**: 与 `verification-sender.service.ts` 的 SMS/Email Mock 降级一致

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `OSS_ACCESS_KEY_ID` | 是 | 阿里云 AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | 是 | 阿里云 AccessKey Secret |
| `OSS_BUCKET` | 是 | OSS Bucket 名称 |
| `OSS_REGION` | 是 | OSS 地域（如 `oss-cn-hangzhou`） |
| `OSS_CUSTOM_DOMAIN` | 否 | 自定义域名（CDN 加速域名） |

## 扩展场景

新增上传场景只需：
1. 在 `upload.controller.ts` 的 `ALLOWED_DIRECTORIES` 数组中添加目录名
2. 前端调用 `uploadImage(file, '新目录名')`

## 接口文档

详细接口参数和返回值见 Swagger：`/api/docs`（Tags: 文件上传）
