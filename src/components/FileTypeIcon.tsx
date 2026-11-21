import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderOpen,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import { AssetDriveKind, AssetType } from '../types/content';
import { storageManager } from '../services/storageManager';

export interface FileTypeDescriptor {
  Icon: LucideIcon;
  formatLabel: string;
  categoryLabel: string;
  iconColorClass: string;
  surfaceClass: string;
}

export function getFileTypeDescriptor(
  fileName: string,
  mimeType?: string,
  assetType?: AssetType,
  driveKind?: AssetDriveKind
): FileTypeDescriptor {
  if (driveKind === 'folder') {
    return {
      Icon: FolderOpen,
      formatLabel: 'FOLDER',
      categoryLabel: 'Drive Folder',
      iconColorClass: 'text-[#0071E3]',
      surfaceClass: 'bg-[#0071E3]/[0.09] border-[#0071E3]/15',
    };
  }

  if (driveKind === 'slides') {
    return {
      Icon: Presentation,
      formatLabel: 'SLIDES',
      categoryLabel: 'Slide Deck',
      iconColorClass: 'text-[#B25E09]',
      surfaceClass: 'bg-[#B25E09]/[0.09] border-[#B25E09]/15',
    };
  }

  if (driveKind === 'sheets') {
    return {
      Icon: FileSpreadsheet,
      formatLabel: 'SHEETS',
      categoryLabel: 'Spreadsheet',
      iconColorClass: 'text-[#1F8A4C]',
      surfaceClass: 'bg-[#1F8A4C]/[0.09] border-[#1F8A4C]/15',
    };
  }

  if (driveKind === 'docs') {
    return {
      Icon: FileText,
      formatLabel: 'DOC',
      categoryLabel: 'Document',
      iconColorClass: 'text-[#0071E3]',
      surfaceClass: 'bg-[#0071E3]/[0.09] border-[#0071E3]/15',
    };
  }

  const resolvedMime = (
    mimeType || storageManager.inferMimeType(fileName, assetType)
  ).toLowerCase();
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  // SVG vector graphic
  if (resolvedMime === 'image/svg+xml' || ext === 'svg') {
    return {
      Icon: FileCode2,
      formatLabel: 'SVG',
      categoryLabel: 'Vector SVG',
      iconColorClass: 'text-[#6D28D9]',
      surfaceClass: 'bg-[#6D28D9]/[0.09] border-[#6D28D9]/15',
    };
  }

  // Video (MP4, MOV, WEBM, MKV)
  if (
    resolvedMime.startsWith('video/') ||
    ['mp4', 'mov', 'webm', 'm4v', 'mkv'].includes(ext)
  ) {
    const label =
      ext && ['mp4', 'mov', 'webm', 'm4v', 'mkv'].includes(ext)
        ? ext.toUpperCase()
        : resolvedMime === 'video/quicktime'
        ? 'MOV'
        : resolvedMime === 'video/webm'
        ? 'WEBM'
        : 'MP4';
    return {
      Icon: FileVideo,
      formatLabel: label,
      categoryLabel: 'Video',
      iconColorClass: 'text-[#0071E3]',
      surfaceClass: 'bg-[#0071E3]/[0.09] border-[#0071E3]/15',
    };
  }

  // PDF document
  if (resolvedMime === 'application/pdf' || ext === 'pdf') {
    return {
      Icon: FileText,
      formatLabel: 'PDF',
      categoryLabel: 'PDF Deck',
      iconColorClass: 'text-[#D70015]',
      surfaceClass: 'bg-[#D70015]/[0.08] border-[#D70015]/15',
    };
  }

  // Presentation files
  if (
    resolvedMime.includes('presentation') ||
    ['pptx', 'ppt', 'key'].includes(ext)
  ) {
    return {
      Icon: Presentation,
      formatLabel: ext ? ext.toUpperCase() : 'DECK',
      categoryLabel: 'Presentation',
      iconColorClass: 'text-[#B25E09]',
      surfaceClass: 'bg-[#B25E09]/[0.09] border-[#B25E09]/15',
    };
  }

  // Raster Images (PNG, JPG, WEBP, AVIF, GIF)
  if (
    resolvedMime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif'].includes(ext)
  ) {
    const label =
      ext === 'jpeg'
        ? 'JPG'
        : ext && ['png', 'jpg', 'webp', 'avif', 'gif'].includes(ext)
        ? ext.toUpperCase()
        : resolvedMime === 'image/jpeg'
        ? 'JPG'
        : resolvedMime === 'image/webp'
        ? 'WEBP'
        : 'PNG';
    return {
      Icon: FileImage,
      formatLabel: label,
      categoryLabel: 'Image',
      iconColorClass: 'text-[#1F8A4C]',
      surfaceClass: 'bg-[#1F8A4C]/[0.09] border-[#1F8A4C]/15',
    };
  }

  // Archives (ZIP, RAR, TAR)
  if (
    resolvedMime.includes('zip') ||
    resolvedMime.includes('compressed') ||
    ['zip', 'tar', 'gz', 'rar'].includes(ext)
  ) {
    return {
      Icon: FileArchive,
      formatLabel: ext ? ext.toUpperCase() : 'ZIP',
      categoryLabel: 'Archive',
      iconColorClass: 'text-[#B25E09]',
      surfaceClass: 'bg-[#B25E09]/[0.09] border-[#B25E09]/15',
    };
  }

  // Audio (MP3, WAV)
  if (resolvedMime.startsWith('audio/') || ['mp3', 'wav', 'aac'].includes(ext)) {
    return {
      Icon: FileAudio,
      formatLabel: ext ? ext.toUpperCase() : 'AUDIO',
      categoryLabel: 'Audio',
      iconColorClass: 'text-[#0071E3]',
      surfaceClass: 'bg-[#0071E3]/[0.09] border-[#0071E3]/15',
    };
  }

  // Text / Markdown / Word Docs
  if (
    resolvedMime.startsWith('text/') ||
    resolvedMime.includes('document') ||
    ['md', 'txt', 'doc', 'docx'].includes(ext)
  ) {
    const label =
      ext && ['md', 'txt', 'doc', 'docx'].includes(ext)
        ? ext.toUpperCase()
        : 'DOC';
    return {
      Icon: FileText,
      formatLabel: label,
      categoryLabel: 'Document',
      iconColorClass: 'text-[#515154]',
      surfaceClass: 'bg-black/[0.05] border-black/[0.08]',
    };
  }

  return {
    Icon: File,
    formatLabel: ext && ext.length <= 5 ? ext.toUpperCase() : 'FILE',
    categoryLabel: 'Media File',
    iconColorClass: 'text-[#6E6E73]',
    surfaceClass: 'bg-black/[0.045] border-black/[0.08]',
  };
}

interface FileTypeIconProps {
  fileName: string;
  mimeType?: string;
  assetType?: AssetType;
  driveKind?: AssetDriveKind;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function FileTypeIcon({
  fileName,
  mimeType,
  assetType,
  driveKind,
  size = 'md',
  showLabel = false,
}: FileTypeIconProps) {
  const desc = getFileTypeDescriptor(fileName, mimeType, assetType, driveKind);
  const { Icon } = desc;

  const boxSize =
    size === 'sm'
      ? 'w-6 h-6 rounded-[6px]'
      : size === 'lg'
      ? 'w-11 h-11 rounded-xl'
      : 'w-8 h-8 rounded-[8px]';
  const iconSize =
    size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  if (showLabel) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-1 border rounded-[7px] shrink-0 ${desc.surfaceClass}`}
        title={`${desc.categoryLabel} (${mimeType || desc.formatLabel})`}
      >
        <Icon className={`w-3.5 h-3.5 ${desc.iconColorClass}`} strokeWidth={1.85} />
        <span
          className={`font-mono text-[10.5px] font-semibold tracking-tight ${desc.iconColorClass}`}
        >
          {desc.formatLabel}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center border shrink-0 ${boxSize} ${desc.surfaceClass}`}
      title={`${desc.categoryLabel} (${desc.formatLabel})`}
      aria-label={`${desc.formatLabel} file`}
    >
      <Icon className={`${iconSize} ${desc.iconColorClass}`} strokeWidth={1.8} />
    </span>
  );
}
