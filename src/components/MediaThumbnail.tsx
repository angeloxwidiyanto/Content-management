import { useEffect, useState } from 'react';
import { HardDrive, Play } from 'lucide-react';
import { AssetDriveKind, AssetStorageSource, AssetType } from '../types/content';
import { FileTypeIcon, getFileTypeDescriptor } from './FileTypeIcon';

interface MediaThumbnailProps {
  src?: string;
  alt: string;
  assetType: AssetType;
  mimeType?: string;
  storageSource?: AssetStorageSource;
  driveKind?: AssetDriveKind;
  isDriveFolder?: boolean;
  className?: string;
}

export function MediaThumbnail({
  src,
  alt,
  assetType,
  mimeType,
  storageSource,
  driveKind,
  isDriveFolder = false,
  className = 'w-full h-40',
}: MediaThumbnailProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const effectiveDriveKind = isDriveFolder ? 'folder' : driveKind;
  const descriptor = getFileTypeDescriptor(
    alt,
    mimeType,
    assetType,
    effectiveDriveKind
  );
  const isPlayable =
    assetType === 'video_cut' ||
    assetType === 'raw_clip' ||
    Boolean(mimeType?.toLowerCase().startsWith('video/'));

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-[#F5F5F7] border-b border-black/[0.06] flex flex-col items-center justify-center gap-2 px-4 text-center select-none relative`}
      >
        <div className="flex items-center gap-2">
          <FileTypeIcon
            fileName={alt}
            mimeType={mimeType}
            assetType={assetType}
            driveKind={effectiveDriveKind}
            size="lg"
          />
        </div>
        <div className="space-y-0.5 max-w-[230px]">
          <div className="text-[12px] font-semibold text-[#1D1D1F] line-clamp-1">
            {alt}
          </div>
          <div className="text-[11px] font-mono text-[#6E6E73] inline-flex items-center justify-center gap-1.5">
            <span className={`font-semibold ${descriptor.iconColorClass}`}>
              {descriptor.formatLabel}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-sans inline-flex items-center gap-1">
              {storageSource === 'google_drive' ? (
                <>
                  <HardDrive className="w-3 h-3 text-[#0071E3]" strokeWidth={1.8} />
                  Preview in Drive
                </>
              ) : storageSource === 's3' ? (
                'Inspect S3 object'
              ) : (
                'Open Quick Look'
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} bg-[#F5F5F7] overflow-hidden relative`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
      />
      {isPlayable && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/[0.08] group-hover:bg-black/[0.16] transition-colors"
          aria-hidden="true"
        >
          <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-md shadow-[0_4px_14px_rgba(0,0,0,0.22)] flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
            <Play className="w-4 h-4 text-[#1D1D1F] fill-[#1D1D1F] ml-0.5" />
          </div>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.05]"
        aria-hidden="true"
      />
    </div>
  );
}
