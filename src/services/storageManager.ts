import {
  AssetType,
  ContentProject,
  MediaAsset,
  S3StorageClass,
} from '../types/content';
import { inferAssetStorageSource } from '../utils/googleDrive';

export interface S3StorageConfig {
  defaultBucket: string;
  region: string;
  cdnBaseUrl: string;
  folderQuotaBytes: number;
  defaultStorageClass: S3StorageClass;
}

export interface MimeStorageSlice {
  id: 'video' | 'image' | 'document' | 'other';
  label: string;
  count: number;
  bytes: number;
  sharePct: number;
  color: string;
}

export interface ProjectStorageSummary {
  totalS3Assets: number;
  totalDriveAssets: number;
  totalExternalAssets: number;
  totalBytes: number;
  quotaBytes: number;
  quotaUsagePct: number;
  estimatedMonthlyUsd: number;
  uniqueMimeTypes: string[];
  breakdown: MimeStorageSlice[];
}

export interface InspectedS3File {
  name: string;
  fileSizeBytes: number;
  mimeType: string;
  assetType: AssetType;
  s3Bucket: string;
  s3Region: string;
  s3Key: string;
  s3StorageClass: S3StorageClass;
  s3ETag: string;
  externalUrl: string;
  previewUrl: string;
  dimensionsOrDuration: string;
}

export const S3_STORAGE_CLASS_META: Record<
  S3StorageClass,
  { label: string; shortLabel: string; usdPerGbMonth: number }
> = {
  STANDARD: {
    label: 'S3 Standard',
    shortLabel: 'Standard',
    usdPerGbMonth: 0.023,
  },
  INTELLIGENT_TIERING: {
    label: 'Intelligent-Tiering',
    shortLabel: 'Auto-Tier',
    usdPerGbMonth: 0.023,
  },
  STANDARD_IA: {
    label: 'Standard-IA (Infrequent)',
    shortLabel: 'Standard-IA',
    usdPerGbMonth: 0.0125,
  },
  GLACIER_IR: {
    label: 'Glacier Instant Retrieval',
    shortLabel: 'Glacier IR',
    usdPerGbMonth: 0.004,
  },
};

export const AWS_REGIONS = [
  { id: 'ap-southeast-1', label: 'ap-southeast-1 (Singapore)' },
  { id: 'ap-southeast-3', label: 'ap-southeast-3 (Jakarta)' },
  { id: 'ap-northeast-1', label: 'ap-northeast-1 (Tokyo)' },
  { id: 'us-east-1', label: 'us-east-1 (N. Virginia)' },
  { id: 'us-west-2', label: 'us-west-2 (Oregon)' },
  { id: 'eu-west-1', label: 'eu-west-1 (Ireland)' },
];

export const COMMON_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'application/zip',
  'text/markdown',
  'audio/mpeg',
];

const CONFIG_STORAGE_KEY = 'cadence_s3_storage_config_v1';

const DEFAULT_CONFIG: S3StorageConfig = {
  defaultBucket: 'cadence-media-prod',
  region: 'ap-southeast-1',
  cdnBaseUrl: '',
  folderQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 GB per folder soft quota
  defaultStorageClass: 'STANDARD',
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  key: 'application/x-iwork-keynote-sffkey',
  zip: 'application/zip',
  md: 'text/markdown',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

function sanitizeSegment(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function computeLightweightETag(seed: string): string {
  let hash1 = 0x811c9dc5;
  let hash2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 0x01000193);
    hash2 = Math.imul(hash2 ^ (ch + i), 0x85ebca6b);
  }
  const part1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `"${part1}${part2}"`;
}

function readImageFilePreview(
  file: File
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        resolve(null);
        return;
      }
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => resolve({ dataUrl, width: 0, height: 0 });
      img.src = dataUrl;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

class StorageManagerService {
  private sessionBlobUrls = new Map<string, string>();

  registerSessionPreviewBlob(s3Key: string, file: File): string {
    if (!s3Key) return '';
    const existing = this.sessionBlobUrls.get(s3Key);
    if (existing) {
      URL.revokeObjectURL(existing);
    }
    const blobUrl = URL.createObjectURL(file);
    this.sessionBlobUrls.set(s3Key, blobUrl);
    return blobUrl;
  }

  getSessionPreviewBlob(s3Key?: string): string | null {
    if (!s3Key) return null;
    return this.sessionBlobUrls.get(s3Key) ?? null;
  }

  estimateAssetMonthlyCostUsd(
    fileSizeBytes?: number,
    storageClass: S3StorageClass = 'STANDARD'
  ): number {
    if (!fileSizeBytes || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return 0;
    }
    const gb = fileSizeBytes / (1024 * 1024 * 1024);
    const rate =
      S3_STORAGE_CLASS_META[storageClass]?.usdPerGbMonth ??
      S3_STORAGE_CLASS_META.STANDARD.usdPerGbMonth;
    return gb * rate;
  }

  getConfig(): S3StorageConfig {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<S3StorageConfig>;
        return {
          defaultBucket:
            typeof parsed.defaultBucket === 'string' &&
            parsed.defaultBucket.trim()
              ? parsed.defaultBucket.trim()
              : DEFAULT_CONFIG.defaultBucket,
          region:
            typeof parsed.region === 'string' && parsed.region.trim()
              ? parsed.region.trim()
              : DEFAULT_CONFIG.region,
          cdnBaseUrl:
            typeof parsed.cdnBaseUrl === 'string'
              ? parsed.cdnBaseUrl.trim().replace(/\/+$/, '')
              : DEFAULT_CONFIG.cdnBaseUrl,
          folderQuotaBytes:
            typeof parsed.folderQuotaBytes === 'number' &&
            parsed.folderQuotaBytes > 0
              ? parsed.folderQuotaBytes
              : DEFAULT_CONFIG.folderQuotaBytes,
          defaultStorageClass:
            parsed.defaultStorageClass &&
            S3_STORAGE_CLASS_META[parsed.defaultStorageClass]
              ? parsed.defaultStorageClass
              : DEFAULT_CONFIG.defaultStorageClass,
        };
      }
    } catch {
      // Fallback to default config
    }
    return { ...DEFAULT_CONFIG };
  }

  updateConfig(patch: Partial<S3StorageConfig>): S3StorageConfig {
    const next: S3StorageConfig = {
      ...this.getConfig(),
      ...patch,
      defaultBucket:
        patch.defaultBucket !== undefined
          ? sanitizeSegment(patch.defaultBucket).toLowerCase() ||
            DEFAULT_CONFIG.defaultBucket
          : this.getConfig().defaultBucket,
      cdnBaseUrl:
        patch.cdnBaseUrl !== undefined
          ? patch.cdnBaseUrl.trim().replace(/\/+$/, '')
          : this.getConfig().cdnBaseUrl,
    };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
    return next;
  }

  buildObjectKey(
    folderCode: string,
    fileName: string,
    version = 'v1.0'
  ): string {
    const cleanFolder = sanitizeSegment(folderCode).toUpperCase() || 'PROJECT';
    const cleanVersion = sanitizeSegment(version).toLowerCase() || 'v1.0';
    const cleanFile = sanitizeSegment(fileName) || 'deliverable.bin';
    return `projects/${cleanFolder}/${cleanVersion}/${cleanFile}`;
  }

  parseS3Uri(
    rawInput: string,
    fallbackBucket: string
  ): { bucket: string; key: string } {
    const trimmed = rawInput.trim();
    if (trimmed.toLowerCase().startsWith('s3://')) {
      const withoutProto = trimmed.slice(5);
      const slashIndex = withoutProto.indexOf('/');
      if (slashIndex > 0) {
        return {
          bucket: withoutProto.slice(0, slashIndex),
          key: withoutProto.slice(slashIndex + 1).replace(/^\/+/, ''),
        };
      }
      return {
        bucket: withoutProto || fallbackBucket,
        key: '',
      };
    }
    return {
      bucket: fallbackBucket,
      key: trimmed.replace(/^\/+/, ''),
    };
  }

  buildObjectUrl(
    bucket: string,
    region: string,
    key: string,
    cdnBaseUrl?: string
  ): string {
    const cleanKey = key.replace(/^\/+/, '');
    if (!cleanKey) return '';
    if (cdnBaseUrl && /^https?:\/\//i.test(cdnBaseUrl)) {
      return `${cdnBaseUrl.replace(/\/+$/, '')}/${cleanKey}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
  }

  inferMimeType(fileName: string, assetType?: AssetType): string {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (ext && EXTENSION_MIME_MAP[ext]) {
      return EXTENSION_MIME_MAP[ext];
    }
    switch (assetType) {
      case 'video_cut':
      case 'raw_clip':
        return 'video/mp4';
      case 'slide_deck':
        return 'application/pdf';
      case 'thumbnail':
        return 'image/png';
      case 'script_doc':
        return 'text/markdown';
      default:
        return 'application/octet-stream';
    }
  }

  inferAssetTypeFromMime(mimeType: string, fileName: string): AssetType {
    const lowerMime = mimeType.toLowerCase();
    const lowerName = fileName.toLowerCase();
    if (lowerMime.startsWith('video/')) {
      return lowerName.includes('raw') ? 'raw_clip' : 'video_cut';
    }
    if (lowerMime.startsWith('image/')) {
      return 'thumbnail';
    }
    if (
      lowerMime === 'application/pdf' ||
      lowerMime.includes('presentation') ||
      lowerName.endsWith('.zip') ||
      lowerName.endsWith('.key')
    ) {
      return 'slide_deck';
    }
    return 'script_doc';
  }

  parseSizeToBytes(value: number, unit: 'KB' | 'MB' | 'GB'): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    const multiplier =
      unit === 'GB'
        ? 1024 * 1024 * 1024
        : unit === 'MB'
        ? 1024 * 1024
        : 1024;
    return Math.round(value * multiplier);
  }

  formatBytes(bytes: number | undefined): string {
    if (!bytes || !Number.isFinite(bytes) || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  async inspectLocalFileForS3(
    file: File,
    folderCode: string,
    version = 'v1.0',
    configOverride?: S3StorageConfig
  ): Promise<InspectedS3File> {
    const config = configOverride ?? this.getConfig();
    const mimeType =
      file.type || this.inferMimeType(file.name);
    const assetType = this.inferAssetTypeFromMime(mimeType, file.name);
    const s3Key = this.buildObjectKey(folderCode, file.name, version);
    const s3ETag = computeLightweightETag(
      `${file.name}:${file.size}:${file.lastModified}:${s3Key}`
    );

    let previewUrl = '';
    let dimensionsOrDuration = `${this.formatBytes(file.size)} · ${mimeType}`;

    // Register a lightweight in-memory session blob URL for instant Quick Look playback
    if (
      mimeType.startsWith('video/') ||
      mimeType.startsWith('image/') ||
      mimeType.startsWith('audio/') ||
      mimeType === 'application/pdf'
    ) {
      this.registerSessionPreviewBlob(s3Key, file);
    }

    // Keep browser storage lightweight: only inline small image thumbnails (< 450 KB)
    if (file.type.startsWith('image/') && file.size <= 450 * 1024) {
      const imageInfo = await readImageFilePreview(file);
      if (imageInfo) {
        previewUrl = imageInfo.dataUrl;
        if (imageInfo.width > 0 && imageInfo.height > 0) {
          dimensionsOrDuration = `${imageInfo.width} × ${imageInfo.height} px`;
        }
      }
    } else if (mimeType.startsWith('video/')) {
      dimensionsOrDuration = `Cloud video · ${this.formatBytes(file.size)}`;
    } else if (mimeType === 'application/pdf') {
      dimensionsOrDuration = `PDF document · ${this.formatBytes(file.size)}`;
    }

    return {
      name: file.name,
      fileSizeBytes: file.size,
      mimeType,
      assetType,
      s3Bucket: config.defaultBucket,
      s3Region: config.region,
      s3Key,
      s3StorageClass: config.defaultStorageClass,
      s3ETag,
      externalUrl: this.buildObjectUrl(
        config.defaultBucket,
        config.region,
        s3Key,
        config.cdnBaseUrl
      ),
      previewUrl,
      dimensionsOrDuration,
    };
  }

  summarizeProjectStorage(
    assets: MediaAsset[],
    configOverride?: S3StorageConfig
  ): ProjectStorageSummary {
    const config = configOverride ?? this.getConfig();
    let totalS3Assets = 0;
    let totalDriveAssets = 0;
    let totalExternalAssets = 0;
    let totalBytes = 0;
    let estimatedMonthlyUsd = 0;

    const mimeSet = new Set<string>();
    const buckets: Record<
      MimeStorageSlice['id'],
      { label: string; count: number; bytes: number; color: string }
    > = {
      video: { label: 'Video', count: 0, bytes: 0, color: '#0071E3' },
      image: { label: 'Images', count: 0, bytes: 0, color: '#1F8A4C' },
      document: { label: 'Slides & Docs', count: 0, bytes: 0, color: '#B25E09' },
      other: { label: 'Archives & Other', count: 0, bytes: 0, color: '#6E6E73' },
    };

    for (const asset of assets) {
      const source = inferAssetStorageSource(asset);
      if (source === 'google_drive') {
        totalDriveAssets += 1;
        continue;
      }
      if (source === 's3') {
        totalS3Assets += 1;
      } else {
        totalExternalAssets += 1;
      }

      const bytes = Math.max(0, asset.fileSizeBytes ?? 0);
      const mime = asset.mimeType || this.inferMimeType(asset.name, asset.assetType);
      const storageClass: S3StorageClass = asset.s3StorageClass ?? 'STANDARD';

      if (source === 's3' || bytes > 0) {
        totalBytes += bytes;
        mimeSet.add(mime);
        const gb = bytes / (1024 * 1024 * 1024);
        estimatedMonthlyUsd +=
          gb * S3_STORAGE_CLASS_META[storageClass].usdPerGbMonth;

        if (mime.startsWith('video/')) {
          buckets.video.count += 1;
          buckets.video.bytes += bytes;
        } else if (mime.startsWith('image/')) {
          buckets.image.count += 1;
          buckets.image.bytes += bytes;
        } else if (
          mime === 'application/pdf' ||
          mime.startsWith('text/') ||
          mime.includes('presentation') ||
          mime.includes('document')
        ) {
          buckets.document.count += 1;
          buckets.document.bytes += bytes;
        } else {
          buckets.other.count += 1;
          buckets.other.bytes += bytes;
        }
      }
    }

    const breakdown: MimeStorageSlice[] = (
      Object.entries(buckets) as [
        MimeStorageSlice['id'],
        (typeof buckets)[MimeStorageSlice['id']]
      ][]
    )
      .map(([id, info]) => ({
        id,
        label: info.label,
        count: info.count,
        bytes: info.bytes,
        sharePct: totalBytes > 0 ? (info.bytes / totalBytes) * 100 : 0,
        color: info.color,
      }))
      .filter((slice) => slice.count > 0 || slice.bytes > 0);

    const quotaBytes = config.folderQuotaBytes;
    const quotaUsagePct =
      quotaBytes > 0 ? Math.min(100, (totalBytes / quotaBytes) * 100) : 0;

    return {
      totalS3Assets,
      totalDriveAssets,
      totalExternalAssets,
      totalBytes,
      quotaBytes,
      quotaUsagePct,
      estimatedMonthlyUsd,
      uniqueMimeTypes: Array.from(mimeSet),
      breakdown,
    };
  }

  exportProjectS3Manifest(
    project: ContentProject,
    configOverride?: S3StorageConfig
  ): void {
    const config = configOverride ?? this.getConfig();
    const s3Objects = project.assets
      .filter((a) => inferAssetStorageSource(a) === 's3' || (a.fileSizeBytes ?? 0) > 0)
      .map((asset) => {
        const mime =
          asset.mimeType || this.inferMimeType(asset.name, asset.assetType);
        const key =
          asset.s3Key ||
          this.buildObjectKey(project.folderCode, asset.name, asset.version);
        const parsed = this.parseS3Uri(key, asset.s3Bucket || config.defaultBucket);
        return {
          assetId: asset.id,
          name: asset.name,
          version: asset.version,
          approvalStatus: asset.status,
          bucket: asset.s3Bucket || parsed.bucket,
          region: asset.s3Region || config.region,
          key: parsed.key,
          storageClass: asset.s3StorageClass || config.defaultStorageClass,
          mimeType: mime,
          fileSizeBytes: asset.fileSizeBytes ?? 0,
          fileSizeFormatted: this.formatBytes(asset.fileSizeBytes),
          etag:
            asset.s3ETag ||
            computeLightweightETag(`${asset.id}:${asset.name}:${asset.fileSizeBytes ?? 0}`),
          url: asset.externalUrl,
          updatedAt: asset.updatedAt,
        };
      });

    const summary = this.summarizeProjectStorage(project.assets, config);
    const payload = {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      project: {
        id: project.id,
        folderCode: project.folderCode,
        title: project.title,
      },
      storageConfig: config,
      totals: {
        objectCount: s3Objects.length,
        totalBytes: summary.totalBytes,
        totalFormatted: this.formatBytes(summary.totalBytes),
        estimatedMonthlyUsd: Number(summary.estimatedMonthlyUsd.toFixed(4)),
      },
      objects: s3Objects,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.folderCode.toLowerCase()}-s3-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export const storageManager = new StorageManagerService();
