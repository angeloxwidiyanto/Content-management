import { AssetStorageSource, AssetType, MediaAsset } from '../types/content';

export type DriveResourceKind = 'file' | 'slides' | 'docs' | 'sheets' | 'folder';

export interface ParsedDriveLink {
  fileId: string;
  kind: DriveResourceKind;
  kindLabel: string;
  embedUrl: string;
  thumbnailUrl: string;
  canonicalUrl: string;
  suggestedAssetType: AssetType;
}

const VALID_DRIVE_ID = /^[a-zA-Z0-9_-]{10,120}$/;

function isValidDriveId(candidate: string | null | undefined): candidate is string {
  return Boolean(candidate && VALID_DRIVE_ID.test(candidate));
}

export function parseGoogleDriveUrl(rawUrl: string): ParsedDriveLink | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  // 1. Google Slides: https://docs.google.com/presentation/d/<ID>/...
  if (host === 'docs.google.com') {
    const slidesMatch = path.match(/\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    if (slidesMatch && isValidDriveId(slidesMatch[1])) {
      const fileId = slidesMatch[1];
      return {
        fileId,
        kind: 'slides',
        kindLabel: 'Google Slides',
        embedUrl: `https://docs.google.com/presentation/d/${fileId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        canonicalUrl: `https://docs.google.com/presentation/d/${fileId}/view`,
        suggestedAssetType: 'slide_deck',
      };
    }

    const docsMatch = path.match(/\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch && isValidDriveId(docsMatch[1])) {
      const fileId = docsMatch[1];
      return {
        fileId,
        kind: 'docs',
        kindLabel: 'Google Docs',
        embedUrl: `https://docs.google.com/document/d/${fileId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        canonicalUrl: `https://docs.google.com/document/d/${fileId}/view`,
        suggestedAssetType: 'script_doc',
      };
    }

    const sheetsMatch = path.match(/\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    if (sheetsMatch && isValidDriveId(sheetsMatch[1])) {
      const fileId = sheetsMatch[1];
      return {
        fileId,
        kind: 'sheets',
        kindLabel: 'Google Sheets',
        embedUrl: `https://docs.google.com/spreadsheets/d/${fileId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        canonicalUrl: `https://docs.google.com/spreadsheets/d/${fileId}/view`,
        suggestedAssetType: 'script_doc',
      };
    }

    return null;
  }

  // 2. Google Drive files & folders: https://drive.google.com/...
  if (host === 'drive.google.com' || host === 'drive.usercontent.google.com') {
    // Folder: /drive/folders/<ID> or /drive/u/0/folders/<ID>
    const folderMatch = path.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch && isValidDriveId(folderMatch[1])) {
      const fileId = folderMatch[1];
      return {
        fileId,
        kind: 'folder',
        kindLabel: 'Google Drive Folder',
        embedUrl: `https://drive.google.com/embeddedfolderview?id=${fileId}#grid`,
        thumbnailUrl: '',
        canonicalUrl: `https://drive.google.com/drive/folders/${fileId}`,
        suggestedAssetType: 'raw_clip',
      };
    }

    // Standard File: /file/d/<ID>/view or /file/u/0/d/<ID>/preview
    const fileMatch = path.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    const queryId = parsed.searchParams.get('id');
    const fileId = fileMatch?.[1] ?? queryId;

    if (isValidDriveId(fileId)) {
      return {
        fileId,
        kind: 'file',
        kindLabel: 'Google Drive File',
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        canonicalUrl: `https://drive.google.com/file/d/${fileId}/view`,
        suggestedAssetType: 'video_cut',
      };
    }
  }

  return null;
}

export function buildDriveEmbedUrl(
  fileId: string,
  kind: DriveResourceKind = 'file',
  folderView: 'grid' | 'list' = 'grid'
): string {
  if (!isValidDriveId(fileId)) return '';
  switch (kind) {
    case 'slides':
      return `https://docs.google.com/presentation/d/${fileId}/preview`;
    case 'docs':
      return `https://docs.google.com/document/d/${fileId}/preview`;
    case 'sheets':
      return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    case 'folder':
      return `https://drive.google.com/embeddedfolderview?id=${fileId}#${folderView}`;
    default:
      return `https://drive.google.com/file/d/${fileId}/preview`;
  }
}

export function buildDriveThumbnailUrl(fileId: string): string {
  if (!isValidDriveId(fileId)) return '';
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

export function isSafeHttpUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isS3StyleUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  const lower = rawUrl.toLowerCase();
  return (
    lower.startsWith('s3://') ||
    lower.includes('.amazonaws.com') ||
    lower.includes('.r2.dev') ||
    lower.includes('.r2.cloudflarestorage.com') ||
    lower.includes('.digitaloceanspaces.com') ||
    lower.includes('.cloudfront.net')
  );
}

export function isDirectVideoUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl || !isSafeHttpUrl(rawUrl)) return false;
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    return /\.(mp4|webm|mov|m4v|ogg)$/.test(pathname);
  } catch {
    return false;
  }
}

export function isDirectImageUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  if (rawUrl.startsWith('data:image/') || rawUrl.startsWith('/')) return true;
  if (!isSafeHttpUrl(rawUrl)) return false;
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    return /\.(png|jpe?g|webp|gif|avif|svg)$/.test(pathname);
  } catch {
    return false;
  }
}

export function isDirectPdfUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl || !isSafeHttpUrl(rawUrl)) return false;
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    return pathname.endsWith('.pdf');
  } catch {
    return false;
  }
}

export function isDirectAudioUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl || !isSafeHttpUrl(rawUrl)) return false;
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    return /\.(mp3|wav|m4a|aac|flac|ogg)$/.test(pathname);
  } catch {
    return false;
  }
}

export function buildS3UrlFromRecord(asset: MediaAsset): string {
  if (isSafeHttpUrl(asset.externalUrl)) return asset.externalUrl;
  if (asset.s3Bucket && asset.s3Key) {
    const region = asset.s3Region || 'ap-southeast-1';
    const cleanKey = asset.s3Key.replace(/^\/+/, '');
    if (cleanKey) {
      return `https://${asset.s3Bucket}.s3.${region}.amazonaws.com/${cleanKey}`;
    }
  }
  return '';
}

export function inferAssetStorageSource(asset: MediaAsset): AssetStorageSource {
  if (asset.storageSource) return asset.storageSource;
  if (asset.driveFileId || parseGoogleDriveUrl(asset.externalUrl)) {
    return 'google_drive';
  }
  if (asset.s3Key || isS3StyleUrl(asset.externalUrl) || isS3StyleUrl(asset.previewUrl)) {
    return 's3';
  }
  return 'external';
}

export type ResolvedAssetPreview =
  | {
      mode: 'drive_iframe';
      fileId: string;
      kind: DriveResourceKind;
      kindLabel: string;
      embedUrl: string;
      openUrl: string;
      thumbnailUrl: string;
    }
  | {
      mode: 'native_video';
      videoUrl: string;
      posterUrl: string;
      openUrl: string;
      isLocalSessionBlob?: boolean;
    }
  | {
      mode: 'pdf_iframe';
      embedUrl: string;
      openUrl: string;
      isLocalSessionBlob?: boolean;
    }
  | {
      mode: 'image';
      imageUrl: string;
      openUrl: string;
      isLocalSessionBlob?: boolean;
    }
  | {
      mode: 'native_audio';
      audioUrl: string;
      openUrl: string;
      isLocalSessionBlob?: boolean;
    }
  | {
      mode: 'link_only';
      openUrl: string;
    };

export function resolveAssetPreview(
  asset: MediaAsset,
  sessionBlobUrl?: string | null
): ResolvedAssetPreview {
  const parsedDrive = parseGoogleDriveUrl(asset.externalUrl);
  if (parsedDrive) {
    return {
      mode: 'drive_iframe',
      fileId: parsedDrive.fileId,
      kind: asset.driveKind ?? parsedDrive.kind,
      kindLabel: parsedDrive.kindLabel,
      embedUrl: buildDriveEmbedUrl(
        parsedDrive.fileId,
        asset.driveKind ?? parsedDrive.kind
      ),
      openUrl: isSafeHttpUrl(asset.externalUrl)
        ? asset.externalUrl
        : parsedDrive.canonicalUrl,
      thumbnailUrl: asset.previewUrl || parsedDrive.thumbnailUrl,
    };
  }

  if (asset.driveFileId && isValidDriveId(asset.driveFileId)) {
    const kind = asset.driveKind ?? 'file';
    const kindLabels: Record<DriveResourceKind, string> = {
      file: 'Google Drive File',
      slides: 'Google Slides',
      docs: 'Google Docs',
      sheets: 'Google Sheets',
      folder: 'Google Drive Folder',
    };
    return {
      mode: 'drive_iframe',
      fileId: asset.driveFileId,
      kind,
      kindLabel: kindLabels[kind],
      embedUrl: buildDriveEmbedUrl(asset.driveFileId, kind),
      openUrl: isSafeHttpUrl(asset.externalUrl)
        ? asset.externalUrl
        : `https://drive.google.com/file/d/${asset.driveFileId}/view`,
      thumbnailUrl:
        asset.previewUrl ||
        (kind === 'folder' ? '' : buildDriveThumbnailUrl(asset.driveFileId)),
    };
  }

  const resolvedRemoteUrl = buildS3UrlFromRecord(asset);
  const effectiveMediaUrl = sessionBlobUrl || resolvedRemoteUrl;
  const mime = (asset.mimeType || '').toLowerCase();
  const lowerName = asset.name.toLowerCase();
  const isLocalSessionBlob = Boolean(sessionBlobUrl);

  // 1. Videos (detected via S3 MIME metadata, filename extension, or direct URL)
  if (
    effectiveMediaUrl &&
    (mime.startsWith('video/') ||
      isDirectVideoUrl(resolvedRemoteUrl) ||
      /\.(mp4|webm|mov|m4v|ogg)$/.test(lowerName))
  ) {
    return {
      mode: 'native_video',
      videoUrl: effectiveMediaUrl,
      posterUrl: asset.previewUrl,
      openUrl: resolvedRemoteUrl,
      isLocalSessionBlob,
    };
  }

  // 2. PDFs (detected via S3 MIME metadata, filename extension, or direct URL)
  if (
    effectiveMediaUrl &&
    (mime === 'application/pdf' ||
      isDirectPdfUrl(resolvedRemoteUrl) ||
      lowerName.endsWith('.pdf'))
  ) {
    return {
      mode: 'pdf_iframe',
      embedUrl: effectiveMediaUrl,
      openUrl: resolvedRemoteUrl,
      isLocalSessionBlob,
    };
  }

  // 3. Audio tracks (detected via S3 MIME metadata or direct URL)
  if (
    effectiveMediaUrl &&
    (mime.startsWith('audio/') ||
      isDirectAudioUrl(resolvedRemoteUrl) ||
      /\.(mp3|wav|m4a|aac|flac)$/.test(lowerName))
  ) {
    return {
      mode: 'native_audio',
      audioUrl: effectiveMediaUrl,
      openUrl: resolvedRemoteUrl,
      isLocalSessionBlob,
    };
  }

  // 4. Images (session blob, local/inlined previewUrl, S3 MIME image/*, or image URL)
  const imageSource =
    (isLocalSessionBlob && mime.startsWith('image/') ? sessionBlobUrl : '') ||
    asset.previewUrl ||
    (mime.startsWith('image/') || isDirectImageUrl(resolvedRemoteUrl)
      ? resolvedRemoteUrl
      : '');
  if (imageSource) {
    return {
      mode: 'image',
      imageUrl: imageSource,
      openUrl: resolvedRemoteUrl,
      isLocalSessionBlob: Boolean(isLocalSessionBlob && imageSource === sessionBlobUrl),
    };
  }

  return {
    mode: 'link_only',
    openUrl: resolvedRemoteUrl,
  };
}
