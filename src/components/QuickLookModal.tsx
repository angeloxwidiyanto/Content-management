import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ASSET_STATUS_META,
  ASSET_STORAGE_META,
  ASSET_TYPE_LABELS,
  AssetStatus,
  MediaAsset,
} from '../types/content';
import {
  S3_STORAGE_CLASS_META,
  storageManager,
} from '../services/storageManager';
import {
  buildDriveEmbedUrl,
  inferAssetStorageSource,
  resolveAssetPreview,
} from '../utils/googleDrive';
import { FileTypeIcon, getFileTypeDescriptor } from './FileTypeIcon';

export interface DriveFolderPreviewTarget {
  name: string;
  fileId: string;
  url: string;
}

interface QuickLookModalProps {
  asset: MediaAsset | null;
  allAssets: MediaAsset[];
  driveFolder: DriveFolderPreviewTarget | null;
  onClose: () => void;
  onSelectAsset: (asset: MediaAsset) => void;
  onUpdateAssetStatus?: (assetId: string, status: AssetStatus) => void;
}

export function QuickLookModal({
  asset,
  allAssets,
  driveFolder,
  onClose,
  onSelectAsset,
  onUpdateAssetStatus,
}: QuickLookModalProps) {
  const isOpen = Boolean(asset || driveFolder);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [mediaLoadError, setMediaLoadError] = useState(false);
  const [folderLayout, setFolderLayout] = useState<'grid' | 'list'>('grid');
  const [imageZoom, setImageZoom] = useState(1);
  const [copiedUri, setCopiedUri] = useState(false);

  const sessionBlobUrl = useMemo(
    () => (asset?.s3Key ? storageManager.getSessionPreviewBlob(asset.s3Key) : null),
    [asset?.s3Key]
  );

  const resolved = useMemo(
    () => (asset ? resolveAssetPreview(asset, sessionBlobUrl) : null),
    [asset, sessionBlobUrl]
  );

  const storageSource = useMemo(
    () => (asset ? inferAssetStorageSource(asset) : 'google_drive'),
    [asset]
  );

  const fileDescriptor = useMemo(
    () =>
      asset
        ? getFileTypeDescriptor(
            asset.name,
            asset.mimeType,
            asset.assetType,
            asset.driveKind
          )
        : null,
    [asset]
  );

  const currentIndex = useMemo(() => {
    if (!asset) return -1;
    return allAssets.findIndex((a) => a.id === asset.id);
  }, [asset, allAssets]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allAssets.length - 1;

  const activeEmbedUrl = useMemo(() => {
    if (driveFolder) {
      return buildDriveEmbedUrl(driveFolder.fileId, 'folder', folderLayout);
    }
    if (!resolved) return '';
    if (resolved.mode === 'drive_iframe') {
      if (resolved.kind === 'folder') {
        return buildDriveEmbedUrl(resolved.fileId, 'folder', folderLayout);
      }
      return resolved.embedUrl;
    }
    if (resolved.mode === 'pdf_iframe') {
      return resolved.embedUrl;
    }
    return '';
  }, [driveFolder, resolved, folderLayout]);

  useEffect(() => {
    setIframeLoaded(false);
    setMediaLoadError(false);
    setImageZoom(1);
    setCopiedUri(false);
  }, [asset?.id, driveFolder?.fileId, activeEmbedUrl]);

  useEffect(() => {
    if (isOpen) {
      setIsFullScreen(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (isEditable) return;

      if (asset && e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onSelectAsset(allAssets[currentIndex - 1]);
      } else if (asset && e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onSelectAsset(allAssets[currentIndex + 1]);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsFullScreen((prev) => !prev);
      } else if (asset && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setShowInspector((prev) => !prev);
      } else if (resolved?.mode === 'image' && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setImageZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
      } else if (resolved?.mode === 'image' && e.key === '-') {
        e.preventDefault();
        setImageZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
      } else if (resolved?.mode === 'image' && e.key === '0') {
        e.preventDefault();
        setImageZoom(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isOpen,
    asset,
    allAssets,
    currentIndex,
    hasPrev,
    hasNext,
    resolved?.mode,
    onClose,
    onSelectAsset,
  ]);

  const isFolderEmbed = Boolean(
    driveFolder || (resolved?.mode === 'drive_iframe' && resolved.kind === 'folder')
  );

  const openExternalUrl = driveFolder
    ? driveFolder.url
    : resolved?.openUrl || '';

  const s3Uri =
    asset && (asset.s3Bucket || asset.s3Key)
      ? `s3://${asset.s3Bucket || storageManager.getConfig().defaultBucket}/${(
          asset.s3Key || ''
        ).replace(/^\/+/, '')}`
      : '';

  const resolvedMime = asset
    ? asset.mimeType || storageManager.inferMimeType(asset.name, asset.assetType)
    : '';

  const estimatedMonthlyCost = asset?.fileSizeBytes
    ? storageManager.estimateAssetMonthlyCostUsd(
        asset.fileSizeBytes,
        asset.s3StorageClass ?? 'STANDARD'
      )
    : 0;

  const handleCopyS3Uri = async () => {
    if (!s3Uri) return;
    try {
      await navigator.clipboard.writeText(s3Uri);
      setCopiedUri(true);
      window.setTimeout(() => setCopiedUri(false), 1800);
    } catch {
      // Clipboard API unavailable in restricted iframe
    }
  };

  const isDarkStage =
    resolved?.mode === 'native_video' ||
    resolved?.mode === 'image' ||
    resolved?.mode === 'native_audio';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className={`fixed inset-0 z-50 flex items-center justify-center ${
            isFullScreen
              ? 'bg-[#111113]'
              : 'bg-black/55 backdrop-blur-md p-4 sm:p-6'
          }`}
          onClick={isFullScreen ? undefined : onClose}
          role="dialog"
          aria-modal="true"
          aria-label={
            driveFolder
              ? `Quick Look: ${driveFolder.name}`
              : asset
              ? `Quick Look: ${asset.name}`
              : 'Quick Look preview'
          }
        >
          <motion.div
            initial={{ opacity: 0, scale: isFullScreen ? 0.99 : 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: isFullScreen ? 0.99 : 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`bg-white flex flex-col overflow-hidden transition-[border-radius,width,height] duration-200 ${
              isFullScreen
                ? 'w-screen h-screen rounded-none'
                : 'w-full max-w-6xl h-[90vh] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.32)] border border-black/[0.1]'
            }`}
          >
            {/* Top Full-Screen Quick Look Header */}
            <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-black/[0.08] bg-white/95 backdrop-blur-md shrink-0 z-20">
              <div className="min-w-0 flex-1 flex items-center gap-3">
                {driveFolder ? (
                  <div className="w-8 h-8 rounded-[9px] bg-[#0071E3]/[0.09] flex items-center justify-center shrink-0">
                    <FolderOpen
                      className="w-4 h-4 text-[#0071E3]"
                      strokeWidth={1.85}
                    />
                  </div>
                ) : asset ? (
                  <FileTypeIcon
                    fileName={asset.name}
                    mimeType={asset.mimeType}
                    assetType={asset.assetType}
                    driveKind={asset.driveKind}
                    size="md"
                  />
                ) : (
                  <HardDrive
                    className="w-4 h-4 text-[#0071E3] shrink-0"
                    strokeWidth={1.85}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-[14.5px] font-semibold text-[#1D1D1F] tracking-[-0.015em] truncate">
                      {driveFolder ? driveFolder.name : asset?.name}
                    </h3>
                    {fileDescriptor && (
                      <span
                        className={`font-mono text-[11px] font-semibold shrink-0 ${fileDescriptor.iconColorClass}`}
                      >
                        {fileDescriptor.formatLabel}
                      </span>
                    )}
                  </div>

                  <div className="text-[11.5px] text-[#6E6E73] font-mono tabular-nums mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {driveFolder ? (
                      <>
                        <span className="font-sans font-medium text-[#0071E3]">
                          Google Drive Working Folder
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>ID: {driveFolder.fileId.slice(0, 14)}…</span>
                      </>
                    ) : asset ? (
                      <>
                        <span
                          className={`font-sans font-medium ${ASSET_STORAGE_META[storageSource].textClass}`}
                        >
                          {ASSET_STORAGE_META[storageSource].label}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{asset.version}</span>
                        {asset.fileSizeBytes && asset.fileSizeBytes > 0 ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-[#1D1D1F] font-medium">
                              {storageManager.formatBytes(asset.fileSizeBytes)}
                            </span>
                          </>
                        ) : null}
                        {resolvedMime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{resolvedMime}</span>
                          </>
                        )}
                        {asset.dimensionsOrDuration && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{asset.dimensionsOrDuration}</span>
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Image Zoom Controls */}
                {resolved?.mode === 'image' && !mediaLoadError && (
                  <div
                    role="group"
                    aria-label="Image zoom controls"
                    className="hidden sm:inline-flex items-center border border-black/[0.08] bg-[#F5F5F7] rounded-[8px] overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setImageZoom((z) =>
                          Math.max(0.5, Number((z - 0.25).toFixed(2)))
                        )
                      }
                      disabled={imageZoom <= 0.5}
                      title="Zoom out (-)"
                      aria-label="Zoom out"
                      className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-white disabled:opacity-35 transition-colors"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom(1)}
                      title="Reset zoom (0)"
                      className="px-2 py-1 text-[11px] font-mono tabular-nums text-[#1D1D1F] hover:bg-white border-x border-black/[0.07] transition-colors whitespace-nowrap"
                    >
                      {Math.round(imageZoom * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setImageZoom((z) =>
                          Math.min(3, Number((z + 0.25).toFixed(2)))
                        )
                      }
                      disabled={imageZoom >= 3}
                      title="Zoom in (+)"
                      aria-label="Zoom in"
                      className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-white disabled:opacity-35 transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {isFolderEmbed && (
                  <div
                    role="group"
                    aria-label="Folder embed layout"
                    className="inline-flex items-center p-[2px] bg-black/[0.05] rounded-[8px]"
                  >
                    <button
                      type="button"
                      onClick={() => setFolderLayout('grid')}
                      aria-pressed={folderLayout === 'grid'}
                      title="Grid view"
                      className={`p-1.5 rounded-[6px] transition-all ${
                        folderLayout === 'grid'
                          ? 'apple-segment-active'
                          : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFolderLayout('list')}
                      aria-pressed={folderLayout === 'list'}
                      title="List view"
                      className={`p-1.5 rounded-[6px] transition-all ${
                        folderLayout === 'list'
                          ? 'apple-segment-active'
                          : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {asset && onUpdateAssetStatus && (
                  <select
                    aria-label={`Approval status for ${asset.name}`}
                    value={asset.status}
                    onChange={(e) =>
                      onUpdateAssetStatus(asset.id, e.target.value as AssetStatus)
                    }
                    className="text-[12px] font-medium text-[#1D1D1F] bg-[#F5F5F7] hover:bg-white border border-black/[0.09] rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
                  >
                    <option value="draft">Draft</option>
                    <option value="in_review">In Review</option>
                    <option value="approved">Approved</option>
                  </select>
                )}

                {asset && allAssets.length > 1 && (
                  <div className="inline-flex items-center border border-black/[0.08] bg-white rounded-[8px] overflow-hidden">
                    <button
                      type="button"
                      disabled={!hasPrev}
                      onClick={() =>
                        hasPrev && onSelectAsset(allAssets[currentIndex - 1])
                      }
                      aria-label="Previous asset"
                      title="Previous asset (←)"
                      className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2 text-[11px] font-mono tabular-nums text-[#6E6E73] border-x border-black/[0.07]">
                      {currentIndex + 1}/{allAssets.length}
                    </span>
                    <button
                      type="button"
                      disabled={!hasNext}
                      onClick={() =>
                        hasNext && onSelectAsset(allAssets[currentIndex + 1])
                      }
                      aria-label="Next asset"
                      title="Next asset (→)"
                      className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.04] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {asset && (
                  <button
                    type="button"
                    onClick={() => setShowInspector((prev) => !prev)}
                    aria-pressed={showInspector}
                    title={
                      showInspector
                        ? 'Hide S3 metadata inspector (I)'
                        : 'Show S3 metadata inspector (I)'
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] border transition-colors whitespace-nowrap ${
                      showInspector
                        ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                        : 'bg-white text-[#515154] hover:text-[#1D1D1F] border-black/[0.09] hover:bg-[#F5F5F7]'
                    }`}
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Metadata</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullScreen((prev) => !prev)}
                  title={
                    isFullScreen
                      ? 'Switch to windowed view (F)'
                      : 'Expand to full screen (F)'
                  }
                  aria-label={
                    isFullScreen ? 'Switch to windowed view' : 'Expand to full screen'
                  }
                  className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.06] rounded-[8px] transition-colors"
                >
                  {isFullScreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>

                {openExternalUrl && (
                  <a
                    href={openExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] border border-black/[0.09] rounded-[8px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[#0071E3]" />
                    <span className="hidden sm:inline">
                      {driveFolder || storageSource === 'google_drive'
                        ? 'Open in Drive'
                        : 'Open Source'}
                    </span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Quick Look"
                  title="Close (Esc)"
                  className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.06] rounded-[8px] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Center Stage + Optional S3 Metadata Inspector */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Main Preview Canvas */}
              <div
                className={`relative flex-1 min-w-0 min-h-0 flex items-center justify-center overflow-hidden ${
                  isDarkStage ? 'bg-[#0E0E11]' : 'bg-[#F5F5F7]'
                }`}
              >
                {/* 1. Google Drive / PDF Iframe Stage */}
                {activeEmbedUrl && !mediaLoadError ? (
                  <div className="relative w-full h-full flex flex-col">
                    {!iframeLoaded && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#F5F5F7] z-10 pointer-events-none">
                        <Loader2 className="w-5 h-5 text-[#0071E3] animate-spin" />
                        <span className="text-[12px] text-[#6E6E73]">
                          {resolved?.mode === 'pdf_iframe'
                            ? 'Loading PDF document preview…'
                            : 'Loading interactive preview…'}
                        </span>
                      </div>
                    )}
                    <iframe
                      key={activeEmbedUrl}
                      src={activeEmbedUrl}
                      title={
                        driveFolder
                          ? `Google Drive Folder: ${driveFolder.name}`
                          : asset?.name || 'Document Preview'
                      }
                      allow="autoplay; fullscreen"
                      allowFullScreen
                      onLoad={() => setIframeLoaded(true)}
                      onError={() => setMediaLoadError(true)}
                      className="w-full h-full border-0 bg-white"
                    />
                    {resolved?.mode === 'pdf_iframe' &&
                      !resolved.isLocalSessionBlob && (
                        <div className="px-4 py-2 bg-white/95 border-t border-black/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6E6E73] shrink-0">
                          <span>
                            Rendering PDF from S3 metadata record ({resolvedMime}). If your S3 bucket restricts inline framing, open directly in a new tab.
                          </span>
                          {openExternalUrl && (
                            <a
                              href={openExternalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium text-[#0071E3] hover:underline whitespace-nowrap"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Open PDF Directly
                            </a>
                          )}
                        </div>
                      )}
                  </div>
                ) : resolved?.mode === 'native_video' && !mediaLoadError ? (
                  /* 2. Native Video Player */
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-6">
                    <video
                      key={resolved.videoUrl}
                      src={resolved.videoUrl}
                      poster={resolved.posterUrl || undefined}
                      controls
                      playsInline
                      onError={() => setMediaLoadError(true)}
                      className="max-h-full max-w-full w-auto h-auto rounded-lg shadow-[0_16px_48px_rgba(0,0,0,0.45)] outline-none bg-black"
                    />
                  </div>
                ) : resolved?.mode === 'native_video' && mediaLoadError ? (
                  /* 2b. S3 Video Graceful Fallback (Private/CORS-protected S3 object) */
                  <div className="w-full h-full flex items-center justify-center p-6 overflow-y-auto">
                    <div className="max-w-2xl w-full bg-[#18181C] border border-white/[0.1] rounded-2xl overflow-hidden text-white shadow-2xl">
                      {resolved.posterUrl ? (
                        <div className="relative aspect-video bg-black overflow-hidden">
                          <img
                            src={resolved.posterUrl}
                            alt={asset?.name || 'Video frame preview'}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover opacity-85"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-5">
                            <span className="text-[11px] font-mono text-white/75">
                              S3 VIDEO POSTER FRAME · {resolvedMime}
                            </span>
                            <h4 className="text-[16px] font-semibold text-white mt-0.5 truncate">
                              {asset?.name}
                            </h4>
                          </div>
                        </div>
                      ) : (
                        <div className="py-12 px-6 flex flex-col items-center justify-center bg-[#141417] border-b border-white/[0.08]">
                          {asset && (
                            <FileTypeIcon
                              fileName={asset.name}
                              mimeType={asset.mimeType}
                              assetType={asset.assetType}
                              size="lg"
                            />
                          )}
                          <h4 className="mt-3 text-[15px] font-semibold text-white text-center">
                            {asset?.name}
                          </h4>
                        </div>
                      )}
                      <div className="p-5 space-y-3">
                        <p className="text-[12.5px] text-white/75 leading-relaxed">
                          Direct browser playback could not reach this S3 object URL (bucket may require a pre-signed URL or CORS policy). All S3 metadata is loaded in the inspector, or drop the local video file into Storage Manager for instant local session playback.
                        </p>
                        {s3Uri && (
                          <div className="px-3 py-2 rounded-[9px] bg-black/40 border border-white/[0.08] font-mono text-[11.5px] text-white/85 break-all">
                            {s3Uri}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setMediaLoadError(false)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-white/10 hover:bg-white/15 rounded-[8px] transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Retry Stream
                          </button>
                          {openExternalUrl && (
                            <a
                              href={openExternalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-[8px] transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Open S3 Object URL
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : resolved?.mode === 'image' && !mediaLoadError ? (
                  /* 3. Interactive Zoomable Image Canvas */
                  <div className="w-full h-full overflow-auto flex items-center justify-center p-6">
                    <img
                      src={resolved.imageUrl}
                      alt={asset?.name || 'Asset preview'}
                      referrerPolicy="no-referrer"
                      onError={() => setMediaLoadError(true)}
                      onClick={() =>
                        setImageZoom((z) => (z === 1 ? 1.5 : 1))
                      }
                      style={{
                        transform: `scale(${imageZoom})`,
                        transformOrigin: 'center center',
                      }}
                      className="max-h-full max-w-full w-auto object-contain rounded-lg shadow-[0_14px_44px_rgba(0,0,0,0.4)] transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-zoom-in"
                    />
                  </div>
                ) : resolved?.mode === 'native_audio' && !mediaLoadError ? (
                  /* 4. Native Audio Player */
                  <div className="max-w-lg w-full mx-6 bg-[#18181C] border border-white/[0.1] rounded-2xl p-6 text-white space-y-5 shadow-2xl">
                    <div className="flex items-center gap-3.5">
                      {asset && (
                        <FileTypeIcon
                          fileName={asset.name}
                          mimeType={asset.mimeType}
                          assetType={asset.assetType}
                          size="lg"
                        />
                      )}
                      <div className="min-w-0">
                        <h4 className="text-[15px] font-semibold text-white truncate">
                          {asset?.name}
                        </h4>
                        <p className="text-[12px] font-mono text-white/65 mt-0.5">
                          {resolvedMime}
                          {asset?.fileSizeBytes
                            ? ` · ${storageManager.formatBytes(asset.fileSizeBytes)}`
                            : ''}
                        </p>
                      </div>
                    </div>
                    <audio
                      key={resolved.audioUrl}
                      src={resolved.audioUrl}
                      controls
                      onError={() => setMediaLoadError(true)}
                      className="w-full"
                    />
                  </div>
                ) : (
                  /* 5. Clean S3 / External Object Fallback */
                  <div className="py-16 px-6 text-center max-w-md">
                    {asset && (
                      <div className="flex justify-center mb-4">
                        <FileTypeIcon
                          fileName={asset.name}
                          mimeType={asset.mimeType}
                          assetType={asset.assetType}
                          driveKind={asset.driveKind}
                          size="lg"
                        />
                      </div>
                    )}
                    <p
                      className={`text-[15px] font-semibold ${
                        isDarkStage ? 'text-white' : 'text-[#1D1D1F]'
                      }`}
                    >
                      {mediaLoadError
                        ? 'Preview stream unavailable from remote bucket'
                        : 'Inline preview not supported for this file format'}
                    </p>
                    <p
                      className={`text-[12.5px] mt-1.5 leading-relaxed ${
                        isDarkStage ? 'text-white/65' : 'text-[#6E6E73]'
                      }`}
                    >
                      {s3Uri
                        ? `Recorded in S3 as ${s3Uri}. Open the direct URL or inspect full cloud metadata in the panel.`
                        : 'Open the external link directly, or attach a Google Drive / S3 video, PDF, or image URL for in-app Quick Look playback.'}
                    </p>
                    {openExternalUrl && (
                      <a
                        href={openExternalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-[9px] transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Source Link
                      </a>
                    )}
                  </div>
                )}

                {/* Floating Stage Prev/Next Arrows for Full-Screen Navigation */}
                {asset && allAssets.length > 1 && (
                  <>
                    {hasPrev && (
                      <button
                        type="button"
                        onClick={() => onSelectAsset(allAssets[currentIndex - 1])}
                        aria-label="Previous asset"
                        className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 text-white backdrop-blur-sm transition-all active:scale-95"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}
                    {hasNext && (
                      <button
                        type="button"
                        onClick={() => onSelectAsset(allAssets[currentIndex + 1])}
                        aria-label="Next asset"
                        className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 text-white backdrop-blur-sm transition-all active:scale-95"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Collapsible Right-Hand S3 Metadata Inspector */}
              {asset && showInspector && (
                <aside
                  aria-label="Asset S3 metadata inspector"
                  className="hidden lg:flex w-[312px] shrink-0 border-l border-black/[0.08] bg-[#FAFAFC] flex-col overflow-y-auto"
                >
                  <div className="p-4 border-b border-black/[0.07] space-y-2.5">
                    <div className="text-[11px] font-semibold text-[#6E6E73]">
                      Asset Record
                    </div>
                    <dl className="space-y-2 text-[12px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">Category</dt>
                        <dd className="text-[#1D1D1F] font-medium text-right">
                          {ASSET_TYPE_LABELS[asset.assetType]}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">Format</dt>
                        <dd className="font-mono text-[#1D1D1F] font-semibold text-right">
                          {fileDescriptor?.formatLabel ?? 'FILE'}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">MIME Type</dt>
                        <dd className="font-mono text-[11.5px] text-[#1D1D1F] text-right truncate max-w-[180px]">
                          {resolvedMime}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">Version</dt>
                        <dd className="font-mono tabular-nums text-[#1D1D1F] text-right">
                          {asset.version}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">Status</dt>
                        <dd
                          className={`font-semibold text-right ${
                            ASSET_STATUS_META[asset.status].textClass
                          }`}
                        >
                          {ASSET_STATUS_META[asset.status].label}
                        </dd>
                      </div>
                      {asset.dimensionsOrDuration && (
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[#6E6E73]">Specs</dt>
                          <dd className="font-mono text-[11.5px] tabular-nums text-[#1D1D1F] text-right">
                            {asset.dimensionsOrDuration}
                          </dd>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">Updated</dt>
                        <dd className="font-mono text-[11px] tabular-nums text-[#515154] text-right">
                          {new Date(asset.updatedAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {/* S3 Cloud Storage Metadata Block */}
                  <div className="p-4 border-b border-black/[0.07] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6E6E73]">
                        <Cloud className="w-3.5 h-3.5 text-[#515154]" />
                        S3 Storage Metadata
                      </span>
                      {s3Uri && (
                        <button
                          type="button"
                          onClick={handleCopyS3Uri}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0071E3] hover:text-[#0062CC]"
                        >
                          {copiedUri ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy URI
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <dl className="space-y-2 text-[12px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">Source</dt>
                        <dd
                          className={`font-medium text-right ${ASSET_STORAGE_META[storageSource].textClass}`}
                        >
                          {ASSET_STORAGE_META[storageSource].label}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#6E6E73]">File Size</dt>
                        <dd className="font-mono tabular-nums text-[#1D1D1F] font-semibold text-right">
                          {asset.fileSizeBytes
                            ? storageManager.formatBytes(asset.fileSizeBytes)
                            : 'Not tracked'}
                        </dd>
                      </div>
                      {asset.fileSizeBytes && asset.fileSizeBytes > 0 ? (
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[#6E6E73]">Exact Bytes</dt>
                          <dd className="font-mono text-[11px] tabular-nums text-[#6E6E73] text-right">
                            {asset.fileSizeBytes.toLocaleString()} B
                          </dd>
                        </div>
                      ) : null}
                      {asset.s3Bucket && (
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[#6E6E73]">Bucket</dt>
                          <dd className="font-mono text-[11.5px] text-[#1D1D1F] text-right truncate max-w-[175px]">
                            {asset.s3Bucket}
                          </dd>
                        </div>
                      )}
                      {asset.s3Region && (
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[#6E6E73]">Region</dt>
                          <dd className="font-mono text-[11.5px] text-[#1D1D1F] text-right">
                            {asset.s3Region}
                          </dd>
                        </div>
                      )}
                      {asset.s3StorageClass && (
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[#6E6E73]">Storage Class</dt>
                          <dd className="text-[#1D1D1F] font-medium text-right">
                            {S3_STORAGE_CLASS_META[asset.s3StorageClass]
                              ?.shortLabel ?? asset.s3StorageClass}
                          </dd>
                        </div>
                      )}
                      {estimatedMonthlyCost > 0 && (
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[#6E6E73]">Est. Monthly</dt>
                          <dd className="font-mono text-[11.5px] tabular-nums text-[#1D1D1F] text-right">
                            ${estimatedMonthlyCost.toFixed(4)}/mo
                          </dd>
                        </div>
                      )}
                      {asset.s3ETag && (
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-[#6E6E73]">ETag</dt>
                          <dd className="font-mono text-[11px] text-[#515154] text-right truncate max-w-[175px]">
                            {asset.s3ETag}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {asset.s3Key && (
                      <div className="pt-1">
                        <div className="text-[11px] text-[#6E6E73] mb-1">
                          Object Key
                        </div>
                        <div className="px-2.5 py-1.5 bg-white border border-black/[0.08] rounded-[8px] font-mono text-[11px] text-[#1D1D1F] break-all leading-relaxed">
                          {asset.s3Key}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Editorial Notes */}
                  <div className="p-4 space-y-1.5">
                    <div className="text-[11px] font-semibold text-[#6E6E73]">
                      Deliverable Notes
                    </div>
                    <p className="text-[12px] text-[#515154] leading-relaxed">
                      {asset.notes || 'No editorial notes attached to this deliverable.'}
                    </p>
                  </div>
                </aside>
              )}
            </div>

            {/* Bottom Filmstrip / Status Bar */}
            {asset && allAssets.length > 1 ? (
              <footer className="px-4 py-2 border-t border-black/[0.08] bg-white flex items-center gap-2 overflow-x-auto shrink-0">
                {allAssets.map((item, idx) => {
                  const isActive = item.id === asset.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectAsset(item)}
                      className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] border text-left transition-all whitespace-nowrap shrink-0 max-w-[220px] ${
                        isActive
                          ? 'bg-[#0071E3]/[0.09] border-[#0071E3]/40 text-[#1D1D1F]'
                          : 'bg-[#FAFAFC] border-black/[0.07] text-[#515154] hover:text-[#1D1D1F] hover:bg-[#F5F5F7]'
                      }`}
                    >
                      <span className="font-mono text-[10.5px] tabular-nums text-[#86868B] shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <FileTypeIcon
                        fileName={item.name}
                        mimeType={item.mimeType}
                        assetType={item.assetType}
                        driveKind={item.driveKind}
                        size="sm"
                      />
                      <span className="text-[12px] font-medium truncate">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </footer>
            ) : (
              <footer className="px-5 py-2 border-t border-black/[0.07] bg-white flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-[#6E6E73] shrink-0">
                <span className="truncate">
                  {driveFolder
                    ? 'Shared Google Drive working folder — files stay hosted on Drive.'
                    : asset?.notes ||
                      'Press F to toggle full screen · I for metadata inspector · Esc to close.'}
                </span>
                <span className="font-mono text-[11px] text-[#86868B] whitespace-nowrap shrink-0">
                  Esc close · F fullscreen
                  {asset ? ' · I metadata' : ''}
                </span>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
