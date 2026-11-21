import React, { useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Database,
  Download,
  Eye,
  FileUp,
  HardDrive,
  Settings2,
  Table2,
  X,
} from 'lucide-react';
import {
  ContentProject,
  MediaAsset,
  S3StorageClass,
} from '../types/content';
import {
  AWS_REGIONS,
  InspectedS3File,
  S3StorageConfig,
  S3_STORAGE_CLASS_META,
  storageManager,
} from '../services/storageManager';
import { inferAssetStorageSource } from '../utils/googleDrive';
import { FileTypeIcon } from './FileTypeIcon';

interface StorageManagerPanelProps {
  project: ContentProject;
  config: S3StorageConfig;
  onUpdateConfig: (next: S3StorageConfig) => void;
  onRegisterAsset: (asset: Omit<MediaAsset, 'id' | 'updatedAt'>) => void;
  onUpdateAsset: (assetId: string, patch: Partial<MediaAsset>) => void;
  onExportManifest?: () => void;
  onPreviewAsset?: (asset: MediaAsset) => void;
}

const panelInputClass =
  'w-full px-2.5 py-1.5 text-[12px] bg-[#F5F5F7]/75 hover:bg-[#F5F5F7] focus:bg-white border border-black/[0.09] rounded-[8px] text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all';

type ActiveDrawer = 'none' | 'upload' | 'config' | 'inventory';

export function StorageManagerPanel({
  project,
  config,
  onUpdateConfig,
  onRegisterAsset,
  onUpdateAsset,
  onExportManifest,
  onPreviewAsset,
}: StorageManagerPanelProps) {
  const [drawer, setDrawer] = useState<ActiveDrawer>('none');
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<InspectedS3File[]>([]);
  const [stagedVersion, setStagedVersion] = useState('v1.0');
  const [stagedStorageClass, setStagedStorageClass] = useState<S3StorageClass>(
    config.defaultStorageClass
  );
  const [inspecting, setInspecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Bucket config form state
  const [bucketInput, setBucketInput] = useState(config.defaultBucket);
  const [regionInput, setRegionInput] = useState(config.region);
  const [cdnInput, setCdnInput] = useState(config.cdnBaseUrl);
  const [quotaGbInput, setQuotaGbInput] = useState(
    String(
      Math.max(
        0.5,
        Number((config.folderQuotaBytes / (1024 * 1024 * 1024)).toFixed(1))
      )
    )
  );
  const [defaultClassInput, setDefaultClassInput] = useState<S3StorageClass>(
    config.defaultStorageClass
  );

  const summary = useMemo(
    () => storageManager.summarizeProjectStorage(project.assets, config),
    [project.assets, config]
  );

  const trackedS3Assets = useMemo(
    () =>
      project.assets.filter(
        (a) =>
          inferAssetStorageSource(a) === 's3' || (a.fileSizeBytes ?? 0) > 0
      ),
    [project.assets]
  );

  const toggleDrawer = (target: ActiveDrawer) => {
    setDrawer((prev) => (prev === target ? 'none' : target));
  };

  const handleInspectFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setInspecting(true);
    try {
      const inspected = await Promise.all(
        Array.from(fileList).map((file) =>
          storageManager.inspectLocalFileForS3(
            file,
            project.folderCode,
            stagedVersion,
            config
          )
        )
      );
      setStagedFiles((prev) => [...prev, ...inspected]);
    } finally {
      setInspecting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCommitStaged = () => {
    if (stagedFiles.length === 0) return;
    for (const item of stagedFiles) {
      onRegisterAsset({
        name: item.name,
        assetType: item.assetType,
        version: stagedVersion.trim() || 'v1.0',
        status: 'draft',
        storageSource: 's3',
        s3Bucket: item.s3Bucket,
        s3Region: item.s3Region,
        s3Key: item.s3Key,
        s3StorageClass: stagedStorageClass,
        s3ETag: item.s3ETag,
        fileSizeBytes: item.fileSizeBytes,
        mimeType: item.mimeType,
        previewUrl: item.previewUrl,
        externalUrl: item.externalUrl,
        dimensionsOrDuration: item.dimensionsOrDuration,
        notes: `Registered via Storage Manager (${item.s3Bucket}/${item.s3Key})`,
      });
    }
    setStagedFiles([]);
    setDrawer('none');
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedGb = Math.max(0.25, Number(quotaGbInput) || 2);
    const updated = storageManager.updateConfig({
      defaultBucket: bucketInput,
      region: regionInput,
      cdnBaseUrl: cdnInput,
      folderQuotaBytes: Math.round(parsedGb * 1024 * 1024 * 1024),
      defaultStorageClass: defaultClassInput,
    });
    setStagedStorageClass(updated.defaultStorageClass);
    onUpdateConfig(updated);
    setDrawer('none');
  };

  return (
    <section
      aria-label="S3 Storage Manager"
      className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden"
    >
      {/* Top Cloud Storage Telemetry Strip */}
      <div className="px-4 py-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-[9px] bg-[#1D1D1F]/[0.06] flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-[#1D1D1F]" strokeWidth={1.85} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h4 className="text-[12.5px] font-semibold text-[#1D1D1F]">
                  S3 Storage Manager
                </h4>
                <span className="font-mono text-[11px] text-[#6E6E73] truncate">
                  s3://{config.defaultBucket} · {config.region}
                </span>
              </div>
              <div className="text-[11.5px] text-[#6E6E73] font-mono tabular-nums flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5">
                <span className="text-[#1D1D1F] font-semibold">
                  {storageManager.formatBytes(summary.totalBytes)}
                </span>
                <span>of {storageManager.formatBytes(summary.quotaBytes)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-sans">
                  {trackedS3Assets.length}{' '}
                  {trackedS3Assets.length === 1 ? 'cloud object' : 'cloud objects'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Est. ${summary.estimatedMonthlyUsd.toFixed(4)}/mo
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleDrawer('upload')}
              aria-expanded={drawer === 'upload'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] border transition-colors whitespace-nowrap ${
                drawer === 'upload'
                  ? 'bg-[#0071E3] text-white border-[#0071E3]'
                  : 'bg-[#0071E3]/[0.08] text-[#0071E3] border-transparent hover:bg-[#0071E3]/[0.14]'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              Inspect & Register File
            </button>

            <button
              type="button"
              onClick={() => toggleDrawer('inventory')}
              aria-expanded={drawer === 'inventory'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] border transition-colors whitespace-nowrap ${
                drawer === 'inventory'
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-white text-[#515154] hover:text-[#1D1D1F] border-black/[0.09] hover:bg-[#F5F5F7]'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Inventory ({trackedS3Assets.length})
            </button>

            <button
              type="button"
              onClick={() => toggleDrawer('config')}
              aria-expanded={drawer === 'config'}
              title="Configure S3 bucket, region, and quota"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-[8px] border transition-colors whitespace-nowrap ${
                drawer === 'config'
                  ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]'
                  : 'bg-white text-[#515154] hover:text-[#1D1D1F] border-black/[0.09] hover:bg-[#F5F5F7]'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              Bucket
            </button>

            <button
              type="button"
              onClick={() => {
                storageManager.exportProjectS3Manifest(project, config);
                onExportManifest?.();
              }}
              title="Export S3 metadata manifest JSON"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-[#515154] hover:text-[#1D1D1F] bg-[#F5F5F7] hover:bg-black/[0.06] rounded-[8px] transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Manifest
            </button>
          </div>
        </div>

        {/* macOS-Style Segmented Cloud Storage Bar */}
        <div className="space-y-1.5">
          <div
            className="h-2 w-full bg-black/[0.06] rounded-full overflow-hidden flex gap-[1px]"
            role="img"
            aria-label={`S3 storage used: ${storageManager.formatBytes(
              summary.totalBytes
            )} of ${storageManager.formatBytes(summary.quotaBytes)}`}
          >
            {summary.breakdown.map((slice) => {
              const quotaShare =
                summary.quotaBytes > 0
                  ? (slice.bytes / summary.quotaBytes) * 100
                  : 0;
              const widthPct = Math.max(quotaShare > 0 ? 1.5 : 0, Math.min(100, quotaShare));
              return (
                <div
                  key={slice.id}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: slice.color,
                  }}
                  title={`${slice.label}: ${storageManager.formatBytes(
                    slice.bytes
                  )} (${slice.count} ${slice.count === 1 ? 'file' : 'files'})`}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-[#6E6E73]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {summary.breakdown.length > 0 ? (
                summary.breakdown.map((slice) => (
                  <span
                    key={slice.id}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span
                      className="w-2 h-2 rounded-[2.5px] shrink-0"
                      style={{ backgroundColor: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="text-[#1D1D1F] font-medium">
                      {slice.label}
                    </span>
                    <span className="font-mono tabular-nums">
                      {storageManager.formatBytes(slice.bytes)}
                    </span>
                  </span>
                ))
              ) : (
                <span>
                  No S3 cloud file sizes tracked yet — inspect a file to log exact byte size and MIME type.
                </span>
              )}
            </div>

            {summary.totalDriveAssets > 0 && (
              <span className="inline-flex items-center gap-1 text-[#0071E3] font-medium whitespace-nowrap">
                <HardDrive className="w-3 h-3" />
                {summary.totalDriveAssets} linked on Google Drive (0 B S3)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DRAWER 1: INSPECT & REGISTER S3 FILE METADATA */}
      {drawer === 'upload' && (
        <div className="border-t border-black/[0.07] bg-[#FAFAFC] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h5 className="text-[12.5px] font-semibold text-[#1D1D1F]">
                Inspect Local Media for S3 Metadata Registration
              </h5>
              <p className="text-[11.5px] text-[#6E6E73] mt-0.5">
                Reads exact file size, MIME type, and generates normalized S3 object keys under{' '}
                <span className="font-mono text-[#1D1D1F]">
                  s3://{config.defaultBucket}/projects/{project.folderCode}/
                </span>{' '}
                without storing heavy binaries in browser memory.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawer('none')}
              aria-label="Close file inspector"
              className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] rounded-[6px]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#515154] mb-1">
                Version Tag
              </label>
              <input
                type="text"
                value={stagedVersion}
                onChange={(e) => setStagedVersion(e.target.value)}
                placeholder="v1.0"
                className={`${panelInputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#515154] mb-1">
                S3 Storage Class
              </label>
              <select
                value={stagedStorageClass}
                onChange={(e) =>
                  setStagedStorageClass(e.target.value as S3StorageClass)
                }
                className={panelInputClass}
              >
                {(Object.keys(S3_STORAGE_CLASS_META) as S3StorageClass[]).map(
                  (cls) => (
                    <option key={cls} value={cls}>
                      {S3_STORAGE_CLASS_META[cls].label} ($
                      {S3_STORAGE_CLASS_META[cls].usdPerGbMonth}/GB·mo)
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFiles(true);
            }}
            onDragLeave={() => setIsDraggingFiles(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFiles(false);
              void handleInspectFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`border border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-all ${
              isDraggingFiles
                ? 'border-[#0071E3] bg-[#0071E3]/[0.06]'
                : 'border-black/[0.18] bg-white hover:border-[#0071E3]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => void handleInspectFiles(e.target.files)}
              className="hidden"
            />
            <Database
              className="w-5 h-5 text-[#0071E3] mx-auto mb-1.5"
              strokeWidth={1.7}
            />
            <div className="text-[12.5px] font-semibold text-[#1D1D1F]">
              {inspecting
                ? 'Inspecting file sizes and MIME headers…'
                : 'Drop video, slide PDF, image, or archive files here — or click to choose'}
            </div>
            <div className="text-[11.5px] text-[#6E6E73] mt-0.5">
              Extracts exact byte count, MIME type, ETag checksum, and S3 object key automatically.
            </div>
          </div>

          {stagedFiles.length > 0 && (
            <div className="space-y-3">
              <div className="bg-white border border-black/[0.08] rounded-xl overflow-hidden divide-y divide-black/[0.06]">
                {stagedFiles.map((item, idx) => (
                  <div
                    key={`${item.s3Key}-${idx}`}
                    className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[12px]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileTypeIcon
                        fileName={item.name}
                        mimeType={item.mimeType}
                        assetType={item.assetType}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-[#1D1D1F] truncate">
                          {item.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#6E6E73] truncate mt-0.5">
                          {item.s3Key}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono text-[11.5px] tabular-nums">
                      <span className="text-[#515154]">{item.mimeType}</span>
                      <span className="font-semibold text-[#1D1D1F]">
                        {storageManager.formatBytes(item.fileSizeBytes)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setStagedFiles((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        aria-label={`Remove ${item.name} from staging`}
                        className="p-1 text-[#86868B] hover:text-[#D70015] rounded-[6px]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-[#6E6E73] font-mono tabular-nums">
                  {stagedFiles.length}{' '}
                  {stagedFiles.length === 1 ? 'file' : 'files'} ·{' '}
                  {storageManager.formatBytes(
                    stagedFiles.reduce((acc, f) => acc + f.fileSizeBytes, 0)
                  )}{' '}
                  ready to register
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStagedFiles([])}
                    className="px-3 py-1.5 text-[12px] font-medium text-[#515154] hover:text-[#1D1D1F]"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitStaged}
                    className="px-3.5 py-1.5 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] rounded-[8px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all"
                  >
                    Register to Folder
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAWER 2: S3 OBJECT INVENTORY TABLE */}
      {drawer === 'inventory' && (
        <div className="border-t border-black/[0.07] bg-[#FAFAFC] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-[12.5px] font-semibold text-[#1D1D1F]">
              S3 Cloud Object Inventory ({project.folderCode})
            </h5>
            <button
              type="button"
              onClick={() => setDrawer('none')}
              aria-label="Close inventory"
              className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] rounded-[6px]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {trackedS3Assets.length === 0 ? (
            <div className="bg-white border border-black/[0.08] rounded-xl py-8 px-4 text-center text-[12px] text-[#6E6E73]">
              No S3 objects tracked in this folder yet. Use &ldquo;Inspect & Register File&rdquo; or add an S3 asset below.
            </div>
          ) : (
            <div className="bg-white border border-black/[0.08] rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-black/[0.07] bg-[#FAFAFC] text-[11px] font-semibold text-[#6E6E73]">
                    <th className="py-2 px-3">Object / File</th>
                    <th className="py-2 px-3">MIME Type</th>
                    <th className="py-2 px-3 text-right">Size</th>
                    <th className="py-2 px-3">Storage Class</th>
                    <th className="py-2 px-3">Bucket / Key</th>
                    {onPreviewAsset && (
                      <th className="py-2 px-3 text-right">Preview</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06]">
                  {trackedS3Assets.map((asset) => {
                    const mime =
                      asset.mimeType ||
                      storageManager.inferMimeType(asset.name, asset.assetType);
                    const storageClass: S3StorageClass =
                      asset.s3StorageClass || config.defaultStorageClass;
                    const resolvedKey =
                      asset.s3Key ||
                      storageManager.buildObjectKey(
                        project.folderCode,
                        asset.name,
                        asset.version
                      );
                    return (
                      <tr key={asset.id} className="hover:bg-[#F5F5F7]/60">
                        <td className="py-2.5 px-3 font-medium text-[#1D1D1F] max-w-[230px]">
                          {onPreviewAsset ? (
                            <button
                              type="button"
                              onClick={() => onPreviewAsset(asset)}
                              title={`Preview ${asset.name} in Quick Look`}
                              className="flex items-center gap-2 min-w-0 max-w-full text-left hover:text-[#0071E3] transition-colors group"
                            >
                              <FileTypeIcon
                                fileName={asset.name}
                                mimeType={mime}
                                assetType={asset.assetType}
                                driveKind={asset.driveKind}
                                size="sm"
                              />
                              <span className="truncate group-hover:underline underline-offset-2">
                                {asset.name}
                              </span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0">
                              <FileTypeIcon
                                fileName={asset.name}
                                mimeType={mime}
                                assetType={asset.assetType}
                                driveKind={asset.driveKind}
                                size="sm"
                              />
                              <span className="truncate">{asset.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#515154] whitespace-nowrap">
                          {mime}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] tabular-nums text-right text-[#1D1D1F] font-semibold whitespace-nowrap">
                          {storageManager.formatBytes(asset.fileSizeBytes)}
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            aria-label={`S3 storage class for ${asset.name}`}
                            value={storageClass}
                            onChange={(e) =>
                              onUpdateAsset(asset.id, {
                                s3StorageClass: e.target.value as S3StorageClass,
                              })
                            }
                            className="text-[11.5px] bg-[#F5F5F7] border border-black/[0.08] rounded-[6px] px-2 py-1 text-[#1D1D1F] focus:outline-none focus:bg-white focus:border-[#0071E3]"
                          >
                            {(
                              Object.keys(
                                S3_STORAGE_CLASS_META
                              ) as S3StorageClass[]
                            ).map((cls) => (
                              <option key={cls} value={cls}>
                                {S3_STORAGE_CLASS_META[cls].shortLabel}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#6E6E73] max-w-[240px] truncate">
                          {asset.s3Bucket || config.defaultBucket}/{resolvedKey}
                        </td>
                        {onPreviewAsset && (
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onPreviewAsset(asset)}
                              aria-label={`Preview ${asset.name} in Quick Look`}
                              title="Open in Full-Screen Quick Look"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#0071E3] hover:bg-[#0071E3]/[0.09] rounded-[6px] transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Quick Look
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DRAWER 3: S3 BUCKET & QUOTA SETTINGS */}
      {drawer === 'config' && (
        <form
          onSubmit={handleSaveConfig}
          className="border-t border-black/[0.07] bg-[#FAFAFC] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h5 className="text-[12.5px] font-semibold text-[#1D1D1F]">
              S3 Bucket & Folder Quota Configuration
            </h5>
            <button
              type="button"
              onClick={() => setDrawer('none')}
              aria-label="Close bucket settings"
              className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] rounded-[6px]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-[#515154] mb-1">
                Default Bucket Name
              </label>
              <input
                type="text"
                value={bucketInput}
                onChange={(e) => setBucketInput(e.target.value)}
                placeholder="cadence-media-prod"
                className={`${panelInputClass} font-mono`}
                required
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-[#515154] mb-1">
                AWS Region
              </label>
              <select
                value={regionInput}
                onChange={(e) => setRegionInput(e.target.value)}
                className={panelInputClass}
              >
                {AWS_REGIONS.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-[#515154] mb-1">
                Default Storage Class
              </label>
              <select
                value={defaultClassInput}
                onChange={(e) =>
                  setDefaultClassInput(e.target.value as S3StorageClass)
                }
                className={panelInputClass}
              >
                {(Object.keys(S3_STORAGE_CLASS_META) as S3StorageClass[]).map(
                  (cls) => (
                    <option key={cls} value={cls}>
                      {S3_STORAGE_CLASS_META[cls].label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="sm:col-span-8">
              <label className="block text-[11px] font-medium text-[#515154] mb-1">
                CDN / CloudFront Public Base URL (Optional)
              </label>
              <input
                type="url"
                value={cdnInput}
                onChange={(e) => setCdnInput(e.target.value)}
                placeholder="https://cdn.your-domain.com"
                className={panelInputClass}
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-[#515154] mb-1">
                Per-Folder Soft Quota (GB)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="500"
                value={quotaGbInput}
                onChange={(e) => setQuotaGbInput(e.target.value)}
                className={`${panelInputClass} font-mono tabular-nums`}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-3.5 py-1.5 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-[8px] transition-colors"
            >
              Save S3 Configuration
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
