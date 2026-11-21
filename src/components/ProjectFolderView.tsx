import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  ExternalLink,
  Eye,
  FileUp,
  FolderOpen,
  GripVertical,
  HardDrive,
  Link2,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ASSET_STATUS_META,
  ASSET_STORAGE_META,
  ASSET_TYPE_LABELS,
  ActivityLogEntry,
  AssetStatus,
  AssetStorageSource,
  AssetType,
  CHANNELS,
  CHANNEL_MAP,
  CONTENT_MODELS_BY_STRATEGY,
  CTA_PRESETS_BY_STRATEGY,
  ChannelId,
  ContentFormat,
  ContentProject,
  FUNNEL_GROUPS,
  FolderComment,
  MediaAsset,
  PerformanceSnapshot,
  S3StorageClass,
  STATUS_META,
  StrategyType,
  TEAM_MEMBERS,
  TimelineMilestone,
  WorkflowStatus,
  getLatestMetrics,
  normalizeTagList,
} from '../types/content';
import { ActivityLogDraft } from '../store/useWorkspaceStore';
import {
  COMMON_MIME_TYPES,
  S3StorageConfig,
  S3_STORAGE_CLASS_META,
  storageManager,
} from '../services/storageManager';
import {
  inferAssetStorageSource,
  isSafeHttpUrl,
  parseGoogleDriveUrl,
  resolveAssetPreview,
} from '../utils/googleDrive';
import { applyOnionDragGhost } from '../utils/onionSkinDrag';
import { ActivityLogView } from './ActivityLogView';
import { CollaborationComments } from './CollaborationComments';
import { FileTypeIcon, getFileTypeDescriptor } from './FileTypeIcon';
import { MediaThumbnail } from './MediaThumbnail';
import { DriveFolderPreviewTarget, QuickLookModal } from './QuickLookModal';
import { StorageManagerPanel } from './StorageManagerPanel';
import { TagInputField } from './TagInputField';

type FolderTab =
  | 'metadata'
  | 'timeline'
  | 'assets'
  | 'comments'
  | 'performance'
  | 'activity';

const inspectorInputClass =
  'w-full px-3 py-2 text-[13.5px] bg-[#F5F5F7]/75 hover:bg-[#F5F5F7] focus:bg-white border border-black/[0.09] rounded-[9px] text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all';

const compactInputClass =
  'w-full px-2.5 py-1.5 text-[12px] bg-[#F5F5F7]/75 hover:bg-[#F5F5F7] focus:bg-white border border-black/[0.09] rounded-[8px] text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all';

function buildInitialComments(project: ContentProject): FolderComment[] {
  const firstAsset = project.assets[0] ?? null;
  const now = Date.now();
  const owner = project.assigneeName || TEAM_MEMBERS[0].name;
  const reviewer =
    TEAM_MEMBERS.find((m) => m.name !== owner) ?? TEAM_MEMBERS[1];
  const designer =
    TEAM_MEMBERS.find((m) => m.name !== owner && m.name !== reviewer.name) ??
    TEAM_MEMBERS[2];

  const refStamp =
    firstAsset?.assetType === 'video_cut'
      ? '00:38'
      : firstAsset?.assetType === 'slide_deck'
      ? 'Slide 03'
      : firstAsset
      ? 'Frame 01'
      : '';

  return [
    {
      id: `cmt-${project.id}-1`,
      authorName: reviewer.name,
      authorRole: reviewer.role,
      body: firstAsset
        ? `@${owner} CTA hierarchy looks sharp—let's hold the callout slightly longer for "${project.ctaLabel}" so viewers can catch the destination clearly.`
        : `@${owner} Brief alignment looks solid for the ${project.contentModel} structure. Ready for first media upload when prepared.`,
      taggedMembers: [owner],
      mentionedAssetId: firstAsset ? firstAsset.id : null,
      mentionedAssetName: firstAsset ? firstAsset.name : null,
      assetTimestamp: refStamp,
      createdAt: new Date(now - 1000 * 60 * 95).toISOString(),
      resolved: false,
    },
    {
      id: `cmt-${project.id}-2`,
      authorName: designer.name,
      authorRole: designer.role,
      body: `@${reviewer.name} Verified contrast and safe margins across mobile and display surfaces. Updated export version is ready in the Media Assets tab.`,
      taggedMembers: [reviewer.name],
      mentionedAssetId: firstAsset ? firstAsset.id : null,
      mentionedAssetName: firstAsset ? firstAsset.name : null,
      assetTimestamp:
        firstAsset?.assetType === 'video_cut'
          ? '00:04'
          : firstAsset?.assetType === 'slide_deck'
          ? 'Slide 01'
          : '',
      createdAt: new Date(now - 1000 * 60 * 32).toISOString(),
      resolved: true,
    },
  ];
}

interface ProjectFolderViewProps {
  project: ContentProject;
  liveStreamActive: boolean;
  onToggleLiveStream: () => void;
  onBack: () => void;
  onUpdateProject: (
    projectId: string,
    patch: Partial<ContentProject>,
    silent?: boolean
  ) => void;
  onDeleteProject: (projectId: string) => void;
  onToggleMilestone: (projectId: string, milestoneId: string) => void;
  onAddMilestone: (
    projectId: string,
    milestone: Omit<TimelineMilestone, 'id'>
  ) => void;
  onRemoveMilestone: (projectId: string, milestoneId: string) => void;
  onAddAsset: (
    projectId: string,
    asset: Omit<MediaAsset, 'id' | 'updatedAt'>
  ) => void;
  onUpdateAsset: (
    projectId: string,
    assetId: string,
    patch: Partial<MediaAsset>
  ) => void;
  onUpdateAssetStatus: (
    projectId: string,
    assetId: string,
    status: AssetStatus
  ) => void;
  onRemoveAsset: (projectId: string, assetId: string) => void;
  onReorderAssets: (
    projectId: string,
    sourceAssetId: string,
    targetAssetId: string
  ) => void;
  onLogSnapshot: (
    projectId: string,
    snapshot: Omit<PerformanceSnapshot, 'id' | 'recordedAt'>
  ) => void;
  activityLogs: ActivityLogEntry[];
  onLogActivity: (draft: ActivityLogDraft) => void;
  onExportActivityCsv: (entries: ActivityLogEntry[]) => void;
  existingTags?: string[];
}

export function ProjectFolderView({
  project,
  liveStreamActive,
  onToggleLiveStream,
  onBack,
  onUpdateProject,
  onDeleteProject,
  onToggleMilestone,
  onAddMilestone,
  onRemoveMilestone,
  onAddAsset,
  onUpdateAsset,
  onUpdateAssetStatus,
  onRemoveAsset,
  onReorderAssets,
  onLogSnapshot,
  activityLogs,
  onLogActivity,
  onExportActivityCsv,
  existingTags = [],
}: ProjectFolderViewProps) {
  const [activeTab, setActiveTab] = useState<FolderTab>('metadata');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const [dragOverAssetId, setDragOverAssetId] = useState<string | null>(null);
  const [commentsByProject, setCommentsByProject] = useState<
    Record<string, FolderComment[]>
  >(() => ({
    [project.id]: buildInitialComments(project),
  }));

  const currentComments = useMemo(
    () => commentsByProject[project.id] ?? buildInitialComments(project),
    [commentsByProject, project]
  );

  const openCommentsCount = useMemo(
    () => currentComments.filter((c) => !c.resolved).length,
    [currentComments]
  );

  const projectActivityCount = useMemo(
    () => activityLogs.filter((entry) => entry.projectId === project.id).length,
    [activityLogs, project.id]
  );

  const handleAddComment = (
    draft: Omit<FolderComment, 'id' | 'createdAt' | 'resolved'>
  ) => {
    const newComment: FolderComment = {
      ...draft,
      id: `cmt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    setCommentsByProject((prev) => ({
      ...prev,
      [project.id]: [newComment, ...(prev[project.id] ?? buildInitialComments(project))],
    }));
    const snippet =
      draft.body.length > 72 ? `${draft.body.slice(0, 72)}…` : draft.body;
    onLogActivity({
      category: 'comment',
      action: 'Comment Posted',
      summary: `${draft.authorName} commented on ${project.folderCode}`,
      projectId: project.id,
      folderCode: project.folderCode,
      projectTitle: project.title,
      detail: draft.mentionedAssetName
        ? `${draft.mentionedAssetName}${draft.assetTimestamp ? ` @ ${draft.assetTimestamp}` : ''} · "${snippet}"`
        : `"${snippet}"`,
    });
  };

  const handleToggleResolveComment = (commentId: string) => {
    const existing = currentComments.find((c) => c.id === commentId);
    setCommentsByProject((prev) => {
      const list = prev[project.id] ?? buildInitialComments(project);
      return {
        ...prev,
        [project.id]: list.map((c) =>
          c.id === commentId ? { ...c, resolved: !c.resolved } : c
        ),
      };
    });
    if (existing) {
      const nextResolved = !existing.resolved;
      onLogActivity({
        category: 'comment',
        action: nextResolved ? 'Comment Resolved' : 'Comment Reopened',
        summary: `${nextResolved ? 'Resolved' : 'Reopened'} comment by ${existing.authorName}`,
        projectId: project.id,
        folderCode: project.folderCode,
        projectTitle: project.title,
        detail:
          existing.body.length > 72
            ? `"${existing.body.slice(0, 72)}…"`
            : `"${existing.body}"`,
      });
    }
  };

  const handleDeleteComment = (commentId: string) => {
    const existing = currentComments.find((c) => c.id === commentId);
    setCommentsByProject((prev) => {
      const list = prev[project.id] ?? buildInitialComments(project);
      return {
        ...prev,
        [project.id]: list.filter((c) => c.id !== commentId),
      };
    });
    if (existing) {
      onLogActivity({
        category: 'comment',
        action: 'Comment Deleted',
        summary: `Deleted comment by ${existing.authorName}`,
        projectId: project.id,
        folderCode: project.folderCode,
        projectTitle: project.title,
      });
    }
  };

  const [metaForm, setMetaForm] = useState({
    title: project.title,
    summary: project.summary,
    strategy: project.strategy,
    format: project.format,
    contentModel: project.contentModel,
    ctaLabel: project.ctaLabel,
    ctaDestination: project.ctaDestination,
    channel: project.channel,
    status: project.status,
    scheduledDate: project.scheduledDate ?? '',
    scheduledTime: project.scheduledTime,
    assigneeName: project.assigneeName,
    campaign: project.campaign,
    tags: project.tags ?? [],
    briefNotes: project.briefNotes,
  });

  useEffect(() => {
    setMetaForm({
      title: project.title,
      summary: project.summary,
      strategy: project.strategy,
      format: project.format,
      contentModel: project.contentModel,
      ctaLabel: project.ctaLabel,
      ctaDestination: project.ctaDestination,
      channel: project.channel,
      status: project.status,
      scheduledDate: project.scheduledDate ?? '',
      scheduledTime: project.scheduledTime,
      assigneeName: project.assigneeName,
      campaign: project.campaign,
      tags: project.tags ?? [],
      briefNotes: project.briefNotes,
    });
    setConfirmDelete(false);
  }, [project.id, project.updatedAt]);

  // New milestone form
  const [msTitle, setMsTitle] = useState('');
  const [msPhase, setMsPhase] = useState('Production');
  const [msOwner, setMsOwner] = useState(project.assigneeName);
  const [msDueDate, setMsDueDate] = useState(
    project.scheduledDate ?? new Date().toISOString().slice(0, 10)
  );

  // New asset form & Google Drive / S3 source controls
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [assetSourceFilter, setAssetSourceFilter] = useState<
    'all' | 'google_drive' | 's3'
  >('all');
  const [assetStorageMode, setAssetStorageMode] = useState<
    'google_drive' | 's3'
  >('google_drive');
  const [assetName, setAssetName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(
    project.format === 'video' ? 'video_cut' : 'slide_deck'
  );
  const [assetVersion, setAssetVersion] = useState('v1.0');
  const [assetDims, setAssetDims] = useState('');
  const [assetExternalUrl, setAssetExternalUrl] = useState('');
  const [assetPreviewUrl, setAssetPreviewUrl] = useState('');
  const [assetS3Key, setAssetS3Key] = useState('');
  const [assetMimeType, setAssetMimeType] = useState('');
  const [assetSizeValue, setAssetSizeValue] = useState('');
  const [assetSizeUnit, setAssetSizeUnit] = useState<'KB' | 'MB' | 'GB'>('MB');
  const [assetExactBytes, setAssetExactBytes] = useState<number | null>(null);
  const [storageConfig, setStorageConfig] = useState<S3StorageConfig>(() =>
    storageManager.getConfig()
  );
  const [assetStorageClass, setAssetStorageClass] = useState<S3StorageClass>(
    () => storageManager.getConfig().defaultStorageClass
  );
  const [assetNotes, setAssetNotes] = useState('');
  const [lightboxAssetId, setLightboxAssetId] = useState<string | null>(null);
  const [previewDriveFolder, setPreviewDriveFolder] =
    useState<DriveFolderPreviewTarget | null>(null);

  // Project-level Google Drive working folder link editor
  const [editingDriveFolder, setEditingDriveFolder] = useState(false);
  const [driveFolderUrlInput, setDriveFolderUrlInput] = useState(
    project.driveFolderUrl ?? ''
  );
  const [driveFolderNameInput, setDriveFolderNameInput] = useState(
    project.driveFolderName ?? ''
  );

  useEffect(() => {
    setDriveFolderUrlInput(project.driveFolderUrl ?? '');
    setDriveFolderNameInput(project.driveFolderName ?? '');
    setEditingDriveFolder(false);
    setLightboxAssetId(null);
    setPreviewDriveFolder(null);
  }, [project.id, project.driveFolderUrl, project.driveFolderName]);

  const parsedDriveDraft = useMemo(
    () => parseGoogleDriveUrl(assetExternalUrl),
    [assetExternalUrl]
  );

  const parsedProjectDriveFolder = useMemo(
    () => (project.driveFolderUrl ? parseGoogleDriveUrl(project.driveFolderUrl) : null),
    [project.driveFolderUrl]
  );

  const parsedDriveFolderInput = useMemo(
    () => parseGoogleDriveUrl(driveFolderUrlInput),
    [driveFolderUrlInput]
  );

  const lightboxAsset = useMemo(
    () =>
      lightboxAssetId
        ? project.assets.find((a) => a.id === lightboxAssetId) ?? null
        : null,
    [project.assets, lightboxAssetId]
  );

  const assetSourceCounts = useMemo(() => {
    let drive = 0;
    let s3OrOther = 0;
    for (const item of project.assets) {
      if (inferAssetStorageSource(item) === 'google_drive') {
        drive += 1;
      } else {
        s3OrOther += 1;
      }
    }
    return { all: project.assets.length, drive, s3OrOther };
  }, [project.assets]);

  const visibleAssets = useMemo(() => {
    if (assetSourceFilter === 'all') return project.assets;
    return project.assets.filter((item) => {
      const source = inferAssetStorageSource(item);
      if (assetSourceFilter === 'google_drive') return source === 'google_drive';
      return source !== 'google_drive';
    });
  }, [project.assets, assetSourceFilter]);

  // New performance snapshot form
  const latestMetrics = useMemo(() => getLatestMetrics(project), [project]);
  const [snapLabel, setSnapLabel] = useState('');
  const [snapViews, setSnapViews] = useState(
    String(latestMetrics.views > 0 ? latestMetrics.views + 250 : 500)
  );
  const [snapEngagements, setSnapEngagements] = useState(
    String(latestMetrics.engagements > 0 ? latestMetrics.engagements + 42 : 65)
  );
  const [snapCtaClicks, setSnapCtaClicks] = useState(
    String(latestMetrics.ctaClicks > 0 ? latestMetrics.ctaClicks + 18 : 28)
  );
  const [snapCompletion, setSnapCompletion] = useState(
    String(latestMetrics.completionRate > 0 ? latestMetrics.completionRate : 75)
  );

  useEffect(() => {
    const latest = getLatestMetrics(project);
    setSnapViews(String(latest.views > 0 ? latest.views + 120 : 450));
    setSnapEngagements(
      String(latest.engagements > 0 ? latest.engagements + 24 : 58)
    );
    setSnapCtaClicks(
      String(latest.ctaClicks > 0 ? latest.ctaClicks + 12 : 24)
    );
    setSnapCompletion(
      String(latest.completionRate > 0 ? latest.completionRate : 76)
    );
  }, [project.id, project.metrics.length]);

  const completedMilestones = project.milestones.filter((m) => m.completed).length;
  const progressPct =
    project.milestones.length > 0
      ? Math.round((completedMilestones / project.milestones.length) * 100)
      : 0;

  const handleSaveMetadata = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metaForm.title.trim()) return;
    onUpdateProject(project.id, {
      title: metaForm.title.trim(),
      summary: metaForm.summary.trim(),
      strategy: metaForm.strategy,
      format: metaForm.format,
      contentModel: metaForm.contentModel,
      ctaLabel: metaForm.ctaLabel.trim(),
      ctaDestination: metaForm.ctaDestination.trim(),
      channel: metaForm.channel,
      status: metaForm.status,
      scheduledDate: metaForm.scheduledDate || null,
      scheduledTime: metaForm.scheduledTime,
      assigneeName: metaForm.assigneeName.trim() || 'Unassigned',
      campaign: metaForm.campaign.trim(),
      tags: normalizeTagList(metaForm.tags),
      briefNotes: metaForm.briefNotes.trim(),
    });
  };

  const handleStrategySwitch = (nextStrategy: StrategyType) => {
    const models = CONTENT_MODELS_BY_STRATEGY[nextStrategy];
    const ctas = CTA_PRESETS_BY_STRATEGY[nextStrategy];
    setMetaForm((prev) => ({
      ...prev,
      strategy: nextStrategy,
      contentModel: models.includes(prev.contentModel)
        ? prev.contentModel
        : models[0],
      ctaLabel: prev.ctaLabel || ctas[0],
    }));
  };

  const handleCreateMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msTitle.trim()) return;
    onAddMilestone(project.id, {
      title: msTitle.trim(),
      phase: msPhase,
      ownerName: msOwner.trim() || project.assigneeName,
      dueDate: msDueDate || new Date().toISOString().slice(0, 10),
      completed: false,
    });
    setMsTitle('');
  };

  const handleOpenAssetQuickLook = (asset: MediaAsset, contextNote?: string) => {
    setPreviewDriveFolder(null);
    setLightboxAssetId(asset.id);
    const mime =
      asset.mimeType ||
      storageManager.inferMimeType(asset.name, asset.assetType);
    const sizeText = asset.fileSizeBytes
      ? ` · ${storageManager.formatBytes(asset.fileSizeBytes)}`
      : '';
    onLogActivity({
      category: 'asset',
      action: 'Quick Look Opened',
      summary: contextNote
        ? `Previewed "${asset.name}" in Quick Look (${contextNote})`
        : `Previewed "${asset.name}" in Quick Look`,
      projectId: project.id,
      folderCode: project.folderCode,
      projectTitle: project.title,
      detail: `${asset.version} · ${mime}${sizeText}`,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const inspected = await storageManager.inspectLocalFileForS3(
      file,
      project.folderCode,
      assetVersion,
      storageConfig
    );
    if (!assetName) {
      setAssetName(inspected.name);
    }
    if (inspected.previewUrl) {
      setAssetPreviewUrl(inspected.previewUrl);
    }
    setAssetExactBytes(inspected.fileSizeBytes);
    if (inspected.fileSizeBytes >= 1024 * 1024 * 1024) {
      setAssetSizeUnit('GB');
      setAssetSizeValue(
        (inspected.fileSizeBytes / (1024 * 1024 * 1024)).toFixed(2)
      );
    } else if (inspected.fileSizeBytes >= 1024 * 1024) {
      setAssetSizeUnit('MB');
      setAssetSizeValue((inspected.fileSizeBytes / (1024 * 1024)).toFixed(2));
    } else {
      setAssetSizeUnit('KB');
      setAssetSizeValue((inspected.fileSizeBytes / 1024).toFixed(1));
    }
    setAssetMimeType(inspected.mimeType);
    if (assetStorageMode === 's3') {
      setAssetType(inspected.assetType);
      if (!assetS3Key.trim()) {
        setAssetS3Key(inspected.s3Key);
      }
      if (!assetExternalUrl.trim()) {
        setAssetExternalUrl(inspected.externalUrl);
      }
      if (!assetDims.trim()) {
        setAssetDims(inspected.dimensionsOrDuration);
      }
    }
  };

  const handleExternalUrlChange = (value: string) => {
    setAssetExternalUrl(value);
    const parsed = parseGoogleDriveUrl(value);
    if (parsed) {
      setAssetStorageMode('google_drive');
      if (!assetName.trim()) {
        setAssetType(parsed.suggestedAssetType);
      }
    }
  };

  const handleSaveProjectDriveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = driveFolderUrlInput.trim();
    if (!trimmedUrl) {
      onUpdateProject(project.id, {
        driveFolderUrl: '',
        driveFolderName: '',
      });
      setEditingDriveFolder(false);
      return;
    }
    onUpdateProject(project.id, {
      driveFolderUrl: trimmedUrl,
      driveFolderName:
        driveFolderNameInput.trim() || `${project.folderCode} Working Drive`,
    });
    setEditingDriveFolder(false);
  };

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName.trim()) return;

    const parsedDrive = parseGoogleDriveUrl(assetExternalUrl);
    const resolvedSource: AssetStorageSource =
      parsedDrive || assetStorageMode === 'google_drive'
        ? 'google_drive'
        : assetS3Key.trim() || assetStorageMode === 's3'
        ? 's3'
        : 'external';

    const resolvedPreviewUrl =
      assetPreviewUrl.trim() ||
      (parsedDrive && parsedDrive.kind !== 'folder'
        ? parsedDrive.thumbnailUrl
        : '');

    const manualBytes = assetSizeValue.trim()
      ? storageManager.parseSizeToBytes(Number(assetSizeValue), assetSizeUnit)
      : 0;
    const resolvedBytes =
      assetExactBytes !== null && assetExactBytes > 0
        ? assetExactBytes
        : manualBytes > 0
        ? manualBytes
        : undefined;

    const parsedS3 =
      resolvedSource === 's3'
        ? storageManager.parseS3Uri(
            assetS3Key.trim() ||
              storageManager.buildObjectKey(
                project.folderCode,
                assetName.trim(),
                assetVersion.trim() || 'v1.0'
              ),
            storageConfig.defaultBucket
          )
        : null;

    const resolvedMime =
      assetMimeType.trim() ||
      (resolvedSource === 's3'
        ? storageManager.inferMimeType(assetName.trim(), assetType)
        : undefined);

    const resolvedExternalUrl =
      assetExternalUrl.trim() ||
      (parsedS3
        ? storageManager.buildObjectUrl(
            parsedS3.bucket,
            storageConfig.region,
            parsedS3.key,
            storageConfig.cdnBaseUrl
          )
        : '');

    onAddAsset(project.id, {
      name: assetName.trim(),
      assetType,
      version: assetVersion.trim() || 'v1.0',
      status: 'draft',
      storageSource: resolvedSource,
      driveFileId: parsedDrive?.fileId,
      driveKind: parsedDrive?.kind,
      s3Bucket: parsedS3?.bucket,
      s3Region: parsedS3 ? storageConfig.region : undefined,
      s3Key: parsedS3?.key,
      s3StorageClass: resolvedSource === 's3' ? assetStorageClass : undefined,
      fileSizeBytes: resolvedBytes,
      mimeType: resolvedMime,
      previewUrl: resolvedPreviewUrl,
      externalUrl: resolvedExternalUrl,
      dimensionsOrDuration:
        assetDims.trim() ||
        (parsedDrive ? parsedDrive.kindLabel : 'Standard deliverable'),
      notes: assetNotes.trim(),
    });
    setAssetName('');
    setAssetVersion('v1.0');
    setAssetDims('');
    setAssetExternalUrl('');
    setAssetPreviewUrl('');
    setAssetS3Key('');
    setAssetMimeType('');
    setAssetSizeValue('');
    setAssetExactBytes(null);
    setAssetNotes('');
    setShowAssetForm(false);
  };

  const handleRecordSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    const fallbackLabel = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
    onLogSnapshot(project.id, {
      label: snapLabel.trim() || fallbackLabel,
      views: Math.max(0, Number(snapViews) || 0),
      engagements: Math.max(0, Number(snapEngagements) || 0),
      ctaClicks: Math.max(0, Number(snapCtaClicks) || 0),
      completionRate: Math.min(100, Math.max(0, Number(snapCompletion) || 0)),
    });
    setSnapLabel('');
  };

  const channelMeta = CHANNEL_MAP[project.channel];
  const statusMeta = STATUS_META[project.status];

  const tabs: { id: FolderTab; label: string; count?: string }[] = [
    { id: 'metadata', label: 'Metadata' },
    {
      id: 'timeline',
      label: 'Timeline',
      count: `${completedMilestones}/${project.milestones.length}`,
    },
    {
      id: 'assets',
      label: 'Media Assets',
      count: String(project.assets.length),
    },
    {
      id: 'comments',
      label: 'Comments',
      count: String(openCommentsCount),
    },
    {
      id: 'performance',
      label: 'Performance',
      count: latestMetrics.views > 0 ? latestMetrics.views.toLocaleString() : '0',
    },
    {
      id: 'activity',
      label: 'Activity',
      count: String(projectActivityCount),
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Translucent Folder Summary Header */}
      <div className="apple-glass-bar border-b border-black/[0.07] px-6 pt-5 pb-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[12px] text-[#6E6E73] mb-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 text-[#0071E3] hover:text-[#0062CC] font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
                Back
              </button>
              <span className="text-[#C7C7CC]" aria-hidden="true">/</span>
              <span className="font-mono tabular-nums text-[#515154]">
                {project.folderCode}
              </span>
              <span className="text-[#C7C7CC]" aria-hidden="true">·</span>
              <span
                className={
                  project.strategy === 'internal'
                    ? 'text-[#0071E3] font-semibold'
                    : 'text-[#1D1D1F] font-semibold'
                }
              >
                {project.strategy === 'internal'
                  ? 'Internal Strategy'
                  : 'External Strategy'}
              </span>
              <span className="text-[#C7C7CC]" aria-hidden="true">·</span>
              <span className="capitalize">
                {project.format === 'slide' ? 'Slide / Deck' : 'Video'}
              </span>
              <span className="text-[#C7C7CC]" aria-hidden="true">·</span>
              <span>{channelMeta?.label}</span>
            </div>

            <h2 className="text-[21px] font-semibold text-[#1D1D1F] tracking-[-0.025em]">
              {project.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#515154]">
              <span>
                Model:{' '}
                <strong className="font-semibold text-[#1D1D1F]">
                  {project.contentModel}
                </strong>
              </span>
              <span className="text-[#D2D2D7]" aria-hidden="true">
                |
              </span>
              <span>
                CTA:{' '}
                <strong className="font-semibold text-[#1D1D1F]">
                  {project.ctaLabel}
                </strong>
              </span>
              <span className="text-[#D2D2D7]" aria-hidden="true">
                |
              </span>
              <span className="font-mono tabular-nums">
                {project.scheduledDate
                  ? `${project.scheduledDate} ${project.scheduledTime}`
                  : 'Unscheduled Backlog'}
              </span>
              <span className="text-[#D2D2D7]" aria-hidden="true">
                |
              </span>
              <span className={`font-semibold ${statusMeta.textClass}`}>
                {statusMeta.label}
              </span>
              {project.tags.length > 0 && (
                <>
                  <span className="text-[#D2D2D7]" aria-hidden="true">
                    |
                  </span>
                  <span className="font-mono text-[11.5px] text-[#6E6E73]">
                    {project.tags.map((t) => `#${t}`).join('  ')}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {confirmDelete ? (
              <div className="flex items-center gap-2.5 border border-[#D70015]/25 bg-[#D70015]/[0.06] px-3 py-1.5 rounded-[10px]">
                <span className="text-[12px] font-medium text-[#D70015]">
                  Delete folder?
                </span>
                <button
                  type="button"
                  onClick={() => onDeleteProject(project.id)}
                  className="text-[12px] font-semibold text-[#D70015] hover:underline whitespace-nowrap"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="text-[12px] text-[#515154] hover:text-[#1D1D1F] whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#515154] hover:text-[#D70015] hover:bg-[#D70015]/[0.06] bg-white border border-black/[0.09] rounded-[9px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-all duration-150 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Folder
              </button>
            )}
          </div>
        </div>

        {/* Folder Section Tabs */}
        <nav
          role="tablist"
          className="mt-5 flex items-center gap-6 overflow-x-auto"
          aria-label="Project folder sections"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-[13px] border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none ${
                  isActive
                    ? 'border-[#0071E3] text-[#1D1D1F] font-semibold'
                    : 'border-transparent text-[#6E6E73] font-medium hover:text-[#1D1D1F]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-[#0071E3]' : 'text-[#86868B]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#F5F5F7]">
        {/* TAB 1: PROJECT METADATA */}
        {activeTab === 'metadata' && (
          <form
            onSubmit={handleSaveMetadata}
            className="max-w-4xl bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] divide-y divide-black/[0.07]"
          >
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
                    Strategy, Format & Call-to-Action
                  </h3>
                  <p className="text-[12px] text-[#6E6E73] mt-0.5">
                    Define whether this folder serves an Internal or External strategy, its deliverable format, framework model, and conversion CTA.
                  </p>
                </div>
                <span className="font-mono text-[12px] tabular-nums text-[#6E6E73]">
                  {project.folderCode}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-[#515154] mb-1.5">
                    Strategy Separation
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-[3px] bg-black/[0.05] rounded-[9px]">
                    {(['internal', 'external'] as StrategyType[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={metaForm.strategy === s}
                        onClick={() => handleStrategySwitch(s)}
                        className={`py-1.5 px-3 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 ${
                          metaForm.strategy === s
                            ? 'apple-segment-active'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        {s === 'internal' ? 'Internal' : 'External'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#515154] mb-1.5">
                    Format (Slide vs. Video)
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-[3px] bg-black/[0.05] rounded-[9px]">
                    {(['slide', 'video'] as ContentFormat[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={metaForm.format === f}
                        onClick={() => setMetaForm({ ...metaForm, format: f })}
                        className={`py-1.5 px-3 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 ${
                          metaForm.format === f
                            ? 'apple-segment-active'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        {f === 'slide' ? 'Slide / Deck' : 'Video'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="meta-model"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Content Model
                  </label>
                  <select
                    id="meta-model"
                    value={metaForm.contentModel}
                    onChange={(e) =>
                      setMetaForm({ ...metaForm, contentModel: e.target.value })
                    }
                    className={inspectorInputClass}
                  >
                    {CONTENT_MODELS_BY_STRATEGY[metaForm.strategy].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="meta-channel"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Target Funnel
                  </label>
                  <select
                    id="meta-channel"
                    value={metaForm.channel}
                    onChange={(e) =>
                      setMetaForm({
                        ...metaForm,
                        channel: e.target.value as ChannelId,
                      })
                    }
                    className={inspectorInputClass}
                  >
                    {FUNNEL_GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {CHANNELS.filter((c) => c.group === group).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="meta-cta"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Call-to-Action (CTA)
                  </label>
                  <input
                    id="meta-cta"
                    list="folder-cta-presets"
                    type="text"
                    value={metaForm.ctaLabel}
                    onChange={(e) =>
                      setMetaForm({ ...metaForm, ctaLabel: e.target.value })
                    }
                    className={inspectorInputClass}
                  />
                  <datalist id="folder-cta-presets">
                    {CTA_PRESETS_BY_STRATEGY[metaForm.strategy].map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label
                    htmlFor="meta-cta-dest"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    CTA Destination / Link
                  </label>
                  <input
                    id="meta-cta-dest"
                    type="text"
                    value={metaForm.ctaDestination}
                    onChange={(e) =>
                      setMetaForm({
                        ...metaForm,
                        ctaDestination: e.target.value,
                      })
                    }
                    className={inspectorInputClass}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
                Scheduling, Ownership & Editorial Brief
              </h3>

              <div>
                <label
                  htmlFor="meta-title"
                  className="block text-[12px] font-medium text-[#515154] mb-1.5"
                >
                  Project Title
                </label>
                <input
                  id="meta-title"
                  type="text"
                  value={metaForm.title}
                  onChange={(e) =>
                    setMetaForm({ ...metaForm, title: e.target.value })
                  }
                  className={inspectorInputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label
                    htmlFor="meta-status"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Workflow Stage
                  </label>
                  <select
                    id="meta-status"
                    value={metaForm.status}
                    onChange={(e) =>
                      setMetaForm({
                        ...metaForm,
                        status: e.target.value as WorkflowStatus,
                      })
                    }
                    className={inspectorInputClass}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="scripting">Scripting</option>
                    <option value="production">Production</option>
                    <option value="review">In Review</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="published">Published</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="meta-date"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Publish Date
                  </label>
                  <input
                    id="meta-date"
                    type="date"
                    value={metaForm.scheduledDate}
                    onChange={(e) =>
                      setMetaForm({
                        ...metaForm,
                        scheduledDate: e.target.value,
                      })
                    }
                    className={`${inspectorInputClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="meta-time"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Time Slot
                  </label>
                  <input
                    id="meta-time"
                    type="time"
                    value={metaForm.scheduledTime}
                    onChange={(e) =>
                      setMetaForm({
                        ...metaForm,
                        scheduledTime: e.target.value,
                      })
                    }
                    className={`${inspectorInputClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="meta-owner"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Owner
                  </label>
                  <input
                    id="meta-owner"
                    type="text"
                    value={metaForm.assigneeName}
                    onChange={(e) =>
                      setMetaForm({
                        ...metaForm,
                        assigneeName: e.target.value,
                      })
                    }
                    className={inspectorInputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="meta-campaign"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Campaign / Editorial Pillar
                  </label>
                  <input
                    id="meta-campaign"
                    type="text"
                    value={metaForm.campaign}
                    onChange={(e) =>
                      setMetaForm({ ...metaForm, campaign: e.target.value })
                    }
                    className={inspectorInputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="meta-summary"
                    className="block text-[12px] font-medium text-[#515154] mb-1.5"
                  >
                    Executive Summary
                  </label>
                  <input
                    id="meta-summary"
                    type="text"
                    value={metaForm.summary}
                    onChange={(e) =>
                      setMetaForm({ ...metaForm, summary: e.target.value })
                    }
                    className={inspectorInputClass}
                  />
                </div>
              </div>

              <TagInputField
                id="meta-tags"
                label="Custom Tags"
                tags={metaForm.tags}
                onChange={(nextTags) =>
                  setMetaForm((prev) => ({ ...prev, tags: nextTags }))
                }
                strategy={metaForm.strategy}
                existingTags={existingTags}
                placeholder="e.g., warta, retreat, highlight"
              />

              <div>
                <label
                  htmlFor="meta-brief"
                  className="block text-[12px] font-medium text-[#515154] mb-1.5"
                >
                  Production Brief & Script Notes
                </label>
                <textarea
                  id="meta-brief"
                  rows={4}
                  value={metaForm.briefNotes}
                  onChange={(e) =>
                    setMetaForm({ ...metaForm, briefNotes: e.target.value })
                  }
                  placeholder="Outline hook structure, slide breakdown, pacing notes, and review instructions..."
                  className={`${inspectorInputClass} leading-relaxed`}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[12px] text-[#6E6E73] font-mono tabular-nums">
                  Last saved {new Date(project.updatedAt).toLocaleTimeString()}
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062CC] active:scale-[0.98] rounded-[10px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all whitespace-nowrap"
                >
                  Save Folder Metadata
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: PRODUCTION TIMELINE */}
        {activeTab === 'timeline' && (
          <div className="max-w-4xl space-y-6">
            <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
                    Production Timeline & Milestones
                  </h3>
                  <p className="text-[12px] text-[#6E6E73] mt-0.5">
                    Track briefing, scripting, design/filming, approval, and launch checkpoints for this folder.
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-[15px] font-semibold text-[#1D1D1F]">
                    {progressPct}% complete
                  </div>
                  <div className="text-[11px] text-[#6E6E73]">
                    {completedMilestones} of {project.milestones.length} milestones done
                  </div>
                </div>
              </div>

              {/* Clean structural progress bar */}
              <div className="h-1.5 w-full bg-black/[0.06] rounded-full overflow-hidden mb-6">
                <div
                  className="h-full bg-[#0071E3] rounded-full transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {project.milestones.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-black/[0.14] rounded-xl bg-[#FAFAFC]">
                  <CalendarIcon className="w-5 h-5 text-[#86868B] mx-auto mb-2" />
                  <p className="text-[13px] font-semibold text-[#1D1D1F]">
                    No timeline milestones yet
                  </p>
                  <p className="text-[12px] text-[#6E6E73] mt-0.5">
                    Add your first checkpoint below to map the production schedule.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-black/[0.06] border-t border-b border-black/[0.07]">
                  {project.milestones.map((ms, index) => (
                    <div
                      key={ms.id}
                      className="py-3.5 flex items-center justify-between gap-4 hover:bg-[#F5F5F7]/70 px-2.5 -mx-2.5 rounded-xl transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleMilestone(project.id, ms.id)}
                          aria-label={
                            ms.completed
                              ? `Mark "${ms.title}" incomplete`
                              : `Mark "${ms.title}" complete`
                          }
                          className={`mt-0.5 w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center shrink-0 transition-all active:scale-95 ${
                            ms.completed
                              ? 'bg-[#0071E3] border-[#0071E3] text-white'
                              : 'bg-white border-black/[0.22] hover:border-[#0071E3]'
                          }`}
                        >
                          {ms.completed && <Check className="w-3 h-3" strokeWidth={2.6} />}
                        </button>
                        <div className="min-w-0">
                          <div
                            className={`text-[13.5px] ${
                              ms.completed
                                ? 'line-through text-[#86868B]'
                                : 'text-[#1D1D1F] font-medium'
                            }`}
                          >
                            <span className="font-mono text-[11.5px] text-[#86868B] mr-2 tabular-nums">
                              {String(index + 1).padStart(2, '0')}.
                            </span>
                            {ms.title}
                          </div>
                          <div className="text-[12px] text-[#6E6E73] mt-0.5 flex items-center gap-2">
                            <span>{ms.phase}</span>
                            <span aria-hidden="true">·</span>
                            <span>{ms.ownerName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="font-mono text-[12px] tabular-nums text-[#515154]">
                          {ms.dueDate}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveMilestone(project.id, ms.id)}
                          aria-label={`Remove milestone ${ms.title}`}
                          className="p-1.5 text-[#86868B] hover:text-[#D70015] hover:bg-[#D70015]/[0.06] rounded-[7px] transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Milestone Form */}
              <form
                onSubmit={handleCreateMilestone}
                className="mt-6 pt-5 border-t border-black/[0.07] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-5">
                  <label
                    htmlFor="ms-title"
                    className="block text-[11px] font-medium text-[#515154] mb-1"
                  >
                    New Milestone
                  </label>
                  <input
                    id="ms-title"
                    type="text"
                    value={msTitle}
                    onChange={(e) => setMsTitle(e.target.value)}
                    placeholder="e.g., Editorial & brand tone sign-off"
                    className={compactInputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="ms-phase"
                    className="block text-[11px] font-medium text-[#515154] mb-1"
                  >
                    Phase
                  </label>
                  <select
                    id="ms-phase"
                    value={msPhase}
                    onChange={(e) => setMsPhase(e.target.value)}
                    className={compactInputClass}
                  >
                    <option value="Brief">Brief</option>
                    <option value="Script">Script</option>
                    <option value="Design">Design</option>
                    <option value="Production">Production</option>
                    <option value="Review">Review</option>
                    <option value="Publish">Publish</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="ms-owner"
                    className="block text-[11px] font-medium text-[#515154] mb-1"
                  >
                    Owner
                  </label>
                  <input
                    id="ms-owner"
                    type="text"
                    value={msOwner}
                    onChange={(e) => setMsOwner(e.target.value)}
                    className={compactInputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor="ms-due"
                    className="block text-[11px] font-medium text-[#515154] mb-1"
                  >
                    Due Date
                  </label>
                  <input
                    id="ms-due"
                    type="date"
                    value={msDueDate}
                    onChange={(e) => setMsDueDate(e.target.value)}
                    className={`${compactInputClass} font-mono tabular-nums`}
                  />
                </div>
                <div className="sm:col-span-1">
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] rounded-[8px] shadow-[0_1px_2px_rgba(0,113,227,0.25)] transition-all whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: MEDIA ASSETS (Google Drive Links + S3-Ready Media Library) */}
        {activeTab === 'assets' && (
          <div className="max-w-5xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
                  Folder Media Library
                </h3>
                <p className="text-[12px] text-[#6E6E73] mt-0.5">
                  Preview Google Drive videos, slides, and PDFs directly in Quick Look while keeping deliverables structured for S3 media storage.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Storage Source Filter */}
                <div
                  role="group"
                  aria-label="Filter assets by storage source"
                  className="inline-flex items-center p-[3px] bg-black/[0.05] rounded-[9px]"
                >
                  {(
                    [
                      { id: 'all', label: 'All', count: assetSourceCounts.all },
                      {
                        id: 'google_drive',
                        label: 'Google Drive',
                        count: assetSourceCounts.drive,
                      },
                      {
                        id: 's3',
                        label: 'S3 / Media',
                        count: assetSourceCounts.s3OrOther,
                      },
                    ] as const
                  ).map((item) => {
                    const active = assetSourceFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setAssetSourceFilter(item.id)}
                        className={`px-2.5 py-1 text-[11.5px] font-medium rounded-[6.5px] transition-all duration-150 inline-flex items-center gap-1.5 whitespace-nowrap ${
                          active
                            ? 'apple-segment-active'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="font-mono text-[10.5px] tabular-nums opacity-70">
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAssetStorageMode('google_drive');
                    setShowAssetForm((s) => !s);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] rounded-[10px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
                  Add Drive / Media Link
                </button>
              </div>
            </div>

            {/* S3 Cloud Storage Manager Telemetry & File Inspector */}
            <StorageManagerPanel
              project={project}
              config={storageConfig}
              onUpdateConfig={(next) => {
                setStorageConfig(next);
                setAssetStorageClass(next.defaultStorageClass);
                onLogActivity({
                  category: 'storage',
                  action: 'S3 Config Updated',
                  summary: `Updated S3 bucket configuration for ${project.folderCode}`,
                  projectId: project.id,
                  folderCode: project.folderCode,
                  projectTitle: project.title,
                  detail: `s3://${next.defaultBucket} · ${next.region} · Quota ${storageManager.formatBytes(next.folderQuotaBytes)}`,
                });
              }}
              onRegisterAsset={(assetDraft) => onAddAsset(project.id, assetDraft)}
              onUpdateAsset={(assetId, patch) =>
                onUpdateAsset(project.id, assetId, patch)
              }
              onExportManifest={() =>
                onLogActivity({
                  category: 'storage',
                  action: 'S3 Manifest Exported',
                  summary: `Exported S3 metadata manifest for ${project.folderCode}`,
                  projectId: project.id,
                  folderCode: project.folderCode,
                  projectTitle: project.title,
                  detail: `s3://${storageConfig.defaultBucket} · ${project.assets.length} assets`,
                })
              }
              onPreviewAsset={(asset) =>
                handleOpenAssetQuickLook(asset, 'S3 inventory')
              }
            />

            {/* Project-Level Google Drive Working Folder Strip */}
            <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] px-4 py-3">
              {!editingDriveFolder ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-[9px] bg-[#0071E3]/[0.08] flex items-center justify-center shrink-0">
                      <HardDrive
                        className="w-4 h-4 text-[#0071E3]"
                        strokeWidth={1.85}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-[#1D1D1F] truncate">
                        {project.driveFolderUrl
                          ? project.driveFolderName ||
                            `${project.folderCode} Google Drive Folder`
                          : 'Project Google Drive Folder'}
                      </div>
                      <div className="text-[11.5px] text-[#6E6E73] truncate">
                        {project.driveFolderUrl
                          ? parsedProjectDriveFolder
                            ? `Linked ${parsedProjectDriveFolder.kindLabel} · ID ${parsedProjectDriveFolder.fileId.slice(0, 12)}…`
                            : project.driveFolderUrl
                          : 'Attach a shared Drive folder link to browse raw footage & drafts in-app without uploading heavy files.'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {project.driveFolderUrl && parsedProjectDriveFolder && (
                      <button
                        type="button"
                        onClick={() => {
                          setLightboxAssetId(null);
                          const folderLabel =
                            project.driveFolderName ||
                            `${project.folderCode} Drive Folder`;
                          setPreviewDriveFolder({
                            name: folderLabel,
                            fileId: parsedProjectDriveFolder.fileId,
                            url: project.driveFolderUrl || parsedProjectDriveFolder.canonicalUrl,
                          });
                          onLogActivity({
                            category: 'asset',
                            action: 'Quick Look Opened',
                            summary: `Previewed Google Drive folder "${folderLabel}"`,
                            projectId: project.id,
                            folderCode: project.folderCode,
                            projectTitle: project.title,
                            detail: `Drive ID: ${parsedProjectDriveFolder.fileId}`,
                          });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#0071E3] bg-[#0071E3]/[0.08] hover:bg-[#0071E3]/[0.14] rounded-[8px] transition-colors whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview Folder
                      </button>
                    )}
                    {isSafeHttpUrl(project.driveFolderUrl) && (
                      <a
                        href={project.driveFolderUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[12px] font-medium text-[#515154] hover:text-[#1D1D1F] bg-[#F5F5F7] hover:bg-black/[0.06] rounded-[8px] transition-colors whitespace-nowrap"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingDriveFolder(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] border border-black/[0.09] rounded-[8px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-colors whitespace-nowrap"
                    >
                      <Link2 className="w-3.5 h-3.5 text-[#6E6E73]" />
                      {project.driveFolderUrl ? 'Edit Link' : 'Link Drive Folder'}
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={handleSaveProjectDriveFolder}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#1D1D1F]">
                      Link Google Drive Working Folder
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingDriveFolder(false)}
                      className="text-[12px] text-[#6E6E73] hover:text-[#1D1D1F]"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        Folder Label
                      </label>
                      <input
                        type="text"
                        value={driveFolderNameInput}
                        onChange={(e) => setDriveFolderNameInput(e.target.value)}
                        placeholder={`${project.folderCode} Raw & Exports`}
                        className={compactInputClass}
                      />
                    </div>
                    <div className="sm:col-span-6">
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        Google Drive Folder URL
                      </label>
                      <input
                        type="url"
                        value={driveFolderUrlInput}
                        onChange={(e) => setDriveFolderUrlInput(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/..."
                        className={compactInputClass}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="w-full py-1.5 px-3 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-[8px] transition-colors whitespace-nowrap"
                      >
                        Save Link
                      </button>
                    </div>
                  </div>
                  {driveFolderUrlInput.trim() && (
                    <div className="text-[11.5px] text-[#6E6E73]">
                      {parsedDriveFolderInput ? (
                        <span className="text-[#1F8A4C] font-medium">
                          Detected {parsedDriveFolderInput.kindLabel} (ID:{' '}
                          <span className="font-mono">
                            {parsedDriveFolderInput.fileId.slice(0, 14)}…
                          </span>
                          ) — inline Quick Look preview enabled.
                        </span>
                      ) : (
                        <span>
                          Paste a standard <span className="font-mono">drive.google.com/drive/folders/...</span> share link for inline folder preview.
                        </span>
                      )}
                    </div>
                  )}
                </form>
              )}
            </div>

            {showAssetForm && (
              <form
                onSubmit={handleCreateAsset}
                className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[13.5px] font-semibold text-[#1D1D1F]">
                      Attach Deliverable to {project.folderCode}
                    </h4>
                    <p className="text-[11.5px] text-[#6E6E73] mt-0.5">
                      Choose Google Drive for lightweight link-based previews, or S3 / Media for direct bucket URLs.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center p-[3px] bg-black/[0.05] rounded-[9px]">
                      <button
                        type="button"
                        aria-pressed={assetStorageMode === 'google_drive'}
                        onClick={() => setAssetStorageMode('google_drive')}
                        className={`px-3 py-1 text-[12px] font-medium rounded-[6.5px] transition-all inline-flex items-center gap-1.5 ${
                          assetStorageMode === 'google_drive'
                            ? 'apple-segment-active'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        Google Drive Link
                      </button>
                      <button
                        type="button"
                        aria-pressed={assetStorageMode === 's3'}
                        onClick={() => setAssetStorageMode('s3')}
                        className={`px-3 py-1 text-[12px] font-medium rounded-[6.5px] transition-all inline-flex items-center gap-1.5 ${
                          assetStorageMode === 's3'
                            ? 'apple-segment-active'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                        }`}
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        S3 / Direct Media
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAssetForm(false)}
                      className="text-[12px] text-[#6E6E73] hover:text-[#1D1D1F]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Primary Link Input Row */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-medium text-[#515154] mb-1">
                      {assetStorageMode === 'google_drive'
                        ? 'Google Drive Share Link (Video, Slides, PDF, Docs, Image, or Folder)'
                        : 'S3 / CDN Media URL (MP4, PNG, JPG, PDF)'}
                    </label>
                    <input
                      type="url"
                      value={assetExternalUrl}
                      onChange={(e) => handleExternalUrlChange(e.target.value)}
                      placeholder={
                        assetStorageMode === 'google_drive'
                          ? 'https://drive.google.com/file/d/.../view?usp=sharing'
                          : 'https://your-bucket.s3.amazonaws.com/exports/master.mp4'
                      }
                      className={compactInputClass}
                      required={assetStorageMode === 'google_drive'}
                    />
                    {assetStorageMode === 'google_drive' && (
                      <div className="mt-1.5 text-[11.5px]">
                        {parsedDriveDraft ? (
                          <span className="text-[#1F8A4C] font-medium">
                            Detected {parsedDriveDraft.kindLabel} · ID{' '}
                            <span className="font-mono">
                              {parsedDriveDraft.fileId.slice(0, 14)}…
                            </span>{' '}
                            · In-App Quick Look Ready
                          </span>
                        ) : assetExternalUrl.trim() ? (
                          <span className="text-[#B25E09]">
                            Link not recognized as a Google Drive/Docs share URL yet — it will still save as an external link.
                          </span>
                        ) : (
                          <span className="text-[#6E6E73]">
                            Set Drive sharing to &ldquo;Anyone with the link can view&rdquo; or share with your team for seamless in-app playback.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-medium text-[#515154] mb-1">
                      File or Deliverable Name
                    </label>
                    <input
                      type="text"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      placeholder="e.g., Warta_Retreat_Master_v2.mp4"
                      className={compactInputClass}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-[#515154] mb-1">
                      Asset Category
                    </label>
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value as AssetType)}
                      className={compactInputClass}
                    >
                      {Object.entries(ASSET_TYPE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        Version
                      </label>
                      <input
                        type="text"
                        value={assetVersion}
                        onChange={(e) => setAssetVersion(e.target.value)}
                        className={`${compactInputClass} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        Specs / Length
                      </label>
                      <input
                        type="text"
                        value={assetDims}
                        onChange={(e) => setAssetDims(e.target.value)}
                        placeholder="01:15 · 1080p"
                        className={compactInputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#515154] mb-1">
                      {assetStorageMode === 's3'
                        ? 'Inspect Local File Size & Type (Optional)'
                        : 'Custom Cover Thumbnail (Optional)'}
                    </label>
                    <label className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#515154] bg-[#F5F5F7]/75 border border-dashed border-black/[0.18] hover:border-[#0071E3] rounded-[8px] cursor-pointer transition-colors">
                      <FileUp className="w-3.5 h-3.5 text-[#6E6E73] shrink-0" />
                      <span className="truncate">
                        {assetExactBytes && assetStorageMode === 's3'
                          ? `${storageManager.formatBytes(assetExactBytes)} · ${assetMimeType || 'detected'}`
                          : assetPreviewUrl
                          ? 'Custom cover loaded'
                          : assetStorageMode === 'google_drive'
                          ? 'Auto from Drive (or upload override)'
                          : 'Pick video, PDF, or image to auto-fill'}
                      </span>
                      <input
                        type="file"
                        accept={assetStorageMode === 's3' ? undefined : 'image/*'}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {assetStorageMode === 's3' && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        S3 Object Key (Bucket: {storageConfig.defaultBucket})
                      </label>
                      <input
                        type="text"
                        value={assetS3Key}
                        onChange={(e) => setAssetS3Key(e.target.value)}
                        placeholder={`projects/${project.folderCode}/v1.0/deliverable.mp4`}
                        className={`${compactInputClass} font-mono`}
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        MIME Type
                      </label>
                      <input
                        type="text"
                        list="s3-mime-presets"
                        value={assetMimeType}
                        onChange={(e) => setAssetMimeType(e.target.value)}
                        placeholder="video/mp4"
                        className={`${compactInputClass} font-mono`}
                      />
                      <datalist id="s3-mime-presets">
                        {COMMON_MIME_TYPES.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        File Size
                      </label>
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={assetSizeValue}
                          onChange={(e) => {
                            setAssetExactBytes(null);
                            setAssetSizeValue(e.target.value);
                          }}
                          placeholder="142"
                          className={`${compactInputClass} font-mono tabular-nums`}
                        />
                        <select
                          aria-label="File size unit"
                          value={assetSizeUnit}
                          onChange={(e) => {
                            setAssetExactBytes(null);
                            setAssetSizeUnit(
                              e.target.value as 'KB' | 'MB' | 'GB'
                            );
                          }}
                          className="px-1.5 py-1.5 text-[11.5px] font-mono bg-[#F5F5F7] border border-black/[0.09] rounded-[8px] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                        >
                          <option value="KB">KB</option>
                          <option value="MB">MB</option>
                          <option value="GB">GB</option>
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-[#515154] mb-1">
                        Storage Class
                      </label>
                      <select
                        value={assetStorageClass}
                        onChange={(e) =>
                          setAssetStorageClass(e.target.value as S3StorageClass)
                        }
                        className={compactInputClass}
                      >
                        {(
                          Object.keys(S3_STORAGE_CLASS_META) as S3StorageClass[]
                        ).map((cls) => (
                          <option key={cls} value={cls}>
                            {S3_STORAGE_CLASS_META[cls].shortLabel}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[#515154] mb-1">
                    Review Notes
                  </label>
                  <input
                    type="text"
                    value={assetNotes}
                    onChange={(e) => setAssetNotes(e.target.value)}
                    placeholder="Export specs, safe zone notes, or caption instructions..."
                    className={compactInputClass}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] rounded-[9px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all"
                  >
                    Save Asset to Folder
                  </button>
                </div>
              </form>
            )}

            {visibleAssets.length === 0 ? (
              <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] py-14 px-6 text-center">
                <FolderOpen
                  className="w-6 h-6 text-[#86868B] mx-auto mb-2.5"
                  strokeWidth={1.6}
                />
                <p className="text-[14px] font-semibold text-[#1D1D1F]">
                  {project.assets.length === 0
                    ? 'No media assets attached yet'
                    : assetSourceFilter === 'google_drive'
                    ? 'No Google Drive links in this folder yet'
                    : 'No S3 / direct media assets in this folder yet'}
                </p>
                <p className="text-[12.5px] text-[#6E6E73] mt-1 max-w-md mx-auto">
                  {assetSourceFilter === 'google_drive'
                    ? 'Paste any Google Drive video, Google Slides, PDF, or Docs share link to watch and review it directly inside Quick Look.'
                    : `Attach Google Drive links for lightweight review or S3 media URLs to centralize deliverables inside ${project.folderCode}.`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setAssetStorageMode(
                      assetSourceFilter === 's3' ? 's3' : 'google_drive'
                    );
                    setShowAssetForm(true);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-[9px] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {assetSourceFilter === 's3'
                    ? 'Add S3 / Media Link'
                    : 'Paste Google Drive Link'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {project.assets.length > 1 && (
                  <p className="text-[12px] text-[#6E6E73] flex items-center justify-between px-0.5">
                    <span>
                      {assetSourceFilter === 'all'
                        ? 'Drag and drop media cards to reorder deliverables. Click any card to preview videos, slides, or PDFs in Quick Look.'
                        : 'Switch filter to All to drag-and-drop reorder deliverables across the folder.'}
                    </span>
                    <span className="font-mono tabular-nums text-[11px]">
                      {visibleAssets.length} of {project.assets.length} files
                    </span>
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {visibleAssets.map((asset) => {
                    const index = project.assets.findIndex(
                      (a) => a.id === asset.id
                    );
                    const statusInfo = ASSET_STATUS_META[asset.status];
                    const storageSource = inferAssetStorageSource(asset);
                    const storageMeta = ASSET_STORAGE_META[storageSource];
                    const resolvedPreview = resolveAssetPreview(asset);
                    const thumbSrc =
                      asset.previewUrl ||
                      (resolvedPreview.mode === 'drive_iframe'
                        ? resolvedPreview.thumbnailUrl
                        : '');
                    const isDriveFolderCard =
                      resolvedPreview.mode === 'drive_iframe' &&
                      resolvedPreview.kind === 'folder';
                    const canReorder =
                      assetSourceFilter === 'all' && project.assets.length > 1;
                    const isDragging = draggingAssetId === asset.id;
                    const isDropTarget =
                      dragOverAssetId === asset.id &&
                      draggingAssetId !== null &&
                      draggingAssetId !== asset.id;
                    const incomingAsset = isDropTarget
                      ? project.assets.find((a) => a.id === draggingAssetId) ??
                        null
                      : null;
                    const incomingPreview = incomingAsset
                      ? resolveAssetPreview(incomingAsset)
                      : null;
                    const incomingThumb =
                      incomingAsset?.previewUrl ||
                      (incomingPreview?.mode === 'drive_iframe'
                        ? incomingPreview.thumbnailUrl
                        : '');

                    return (
                      <div
                        key={asset.id}
                        draggable={canReorder}
                        onDragStart={(e) => {
                          if (!canReorder) return;
                          setDraggingAssetId(asset.id);
                          e.dataTransfer.setData('text/plain', asset.id);
                          e.dataTransfer.effectAllowed = 'move';
                          applyOnionDragGhost(e, e.currentTarget);
                        }}
                        onDragOver={(e) => {
                          if (!canReorder) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverAssetId !== asset.id) {
                            setDragOverAssetId(asset.id);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (
                            e.currentTarget.contains(
                              e.relatedTarget as Node | null
                            )
                          ) {
                            return;
                          }
                          if (dragOverAssetId === asset.id) {
                            setDragOverAssetId(null);
                          }
                        }}
                        onDrop={(e) => {
                          if (!canReorder) return;
                          e.preventDefault();
                          const sourceId =
                            e.dataTransfer.getData('text/plain') || draggingAssetId;
                          setDraggingAssetId(null);
                          setDragOverAssetId(null);
                          if (sourceId && sourceId !== asset.id) {
                            onReorderAssets(project.id, sourceId, asset.id);
                          }
                        }}
                        onDragEnd={() => {
                          setDraggingAssetId(null);
                          setDragOverAssetId(null);
                        }}
                        className={`relative bg-white border rounded-2xl overflow-hidden flex flex-col transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                          isDropTarget
                            ? 'border-[#0071E3]/60 shadow-[0_8px_24px_-8px_rgba(0,113,227,0.22)]'
                            : 'border-black/[0.08] hover:border-black/[0.15] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)]'
                        } ${isDragging ? 'onion-skin-origin' : ''}`}
                      >
                        {/* Onion-Skin Incoming Placement Preview Overlay */}
                        {isDropTarget && incomingAsset && (
                          <div
                            aria-hidden="true"
                            className="onion-skin-target absolute inset-0 z-10 rounded-2xl overflow-hidden flex flex-col justify-between p-3.5"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                              <span className="font-semibold text-[#0071E3] bg-white/90 px-2 py-0.5 rounded-[6px] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                                → {String(index + 1).padStart(2, '0')}
                                {index === 0 ? ' · Folder Cover' : ''}
                              </span>
                              <span className="text-[#0071E3] bg-white/85 px-2 py-0.5 rounded-[6px] font-sans font-medium">
                                Drop to place here
                              </span>
                            </div>

                            {incomingThumb && (
                              <div className="my-2 flex-1 min-h-0 rounded-xl overflow-hidden border border-[#0071E3]/30 bg-white/50">
                                <img
                                  src={incomingThumb}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover opacity-50"
                                />
                              </div>
                            )}

                            <div className="bg-white/90 backdrop-blur-sm border border-[#0071E3]/25 rounded-xl px-3 py-2">
                              <div className="text-[12.5px] font-semibold text-[#1D1D1F] truncate">
                                {incomingAsset.name}
                              </div>
                              <div className="text-[11px] font-mono text-[#515154] truncate">
                                {ASSET_TYPE_LABELS[incomingAsset.assetType]} ·{' '}
                                {incomingAsset.version}
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Top sequence & drag handle bar */}
                        <div className="px-3.5 py-2 border-b border-black/[0.06] bg-[#FAFAFC] flex items-center justify-between gap-2">
                          <div
                            className={`flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[#6E6E73] select-none ${
                              canReorder ? 'cursor-grab active:cursor-grabbing' : ''
                            }`}
                            title={
                              canReorder
                                ? 'Drag to reorder media asset'
                                : undefined
                            }
                          >
                            <GripVertical className="w-3.5 h-3.5 text-[#AEAEB2]" />
                            <span className="font-semibold text-[#1D1D1F]">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            {index === 0 && thumbSrc && (
                              <>
                                <span
                                  className="text-[#C7C7CC]"
                                  aria-hidden="true"
                                >
                                  ·
                                </span>
                                <span className="font-sans text-[#0071E3] font-semibold">
                                  Folder Cover
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[11px] font-medium ${storageMeta.textClass}`}
                            >
                              {storageMeta.shortLabel}
                            </span>

                            {canReorder && (
                              <div className="flex items-center gap-0.5 pl-1 border-l border-black/[0.08]">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() =>
                                    onReorderAssets(
                                      project.id,
                                      asset.id,
                                      project.assets[index - 1].id
                                    )
                                  }
                                  aria-label={`Move ${asset.name} earlier`}
                                  className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white disabled:opacity-30 disabled:pointer-events-none rounded-[6px] transition-colors"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === project.assets.length - 1}
                                  onClick={() =>
                                    onReorderAssets(
                                      project.id,
                                      asset.id,
                                      project.assets[index + 1].id
                                    )
                                  }
                                  aria-label={`Move ${asset.name} later`}
                                  className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-white disabled:opacity-30 disabled:pointer-events-none rounded-[6px] transition-colors"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenAssetQuickLook(asset)}
                          className="w-full text-left focus:outline-none group"
                        >
                          <MediaThumbnail
                            src={thumbSrc}
                            alt={asset.name}
                            assetType={asset.assetType}
                            mimeType={asset.mimeType}
                            storageSource={storageSource}
                            driveKind={asset.driveKind}
                            isDriveFolder={isDriveFolderCard}
                            className="w-full h-44"
                          />
                        </button>

                        <div className="p-4 flex-1 flex flex-col">
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#6E6E73] mb-2">
                            <span>
                              {ASSET_TYPE_LABELS[asset.assetType]} ·{' '}
                              <span className="font-mono tabular-nums">
                                {asset.version}
                              </span>
                            </span>
                            <span
                              className={`font-semibold ${statusInfo.textClass}`}
                            >
                              {statusInfo.label}
                            </span>
                          </div>

                          <div className="flex items-start gap-2.5 min-w-0">
                            <FileTypeIcon
                              fileName={asset.name}
                              mimeType={asset.mimeType}
                              assetType={asset.assetType}
                              driveKind={asset.driveKind}
                              size="md"
                            />
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => handleOpenAssetQuickLook(asset)}
                                title={`Preview ${asset.name} in Quick Look`}
                                className="block max-w-full text-left text-[13.5px] font-semibold text-[#1D1D1F] hover:text-[#0071E3] truncate leading-snug transition-colors"
                              >
                                {asset.name}
                              </button>
                              <div className="text-[11.5px] text-[#6E6E73] font-mono tabular-nums mt-0.5 truncate">
                                <span
                                  className={`font-semibold ${
                                    getFileTypeDescriptor(
                                      asset.name,
                                      asset.mimeType,
                                      asset.assetType,
                                      asset.driveKind
                                    ).iconColorClass
                                  }`}
                                >
                                  {
                                    getFileTypeDescriptor(
                                      asset.name,
                                      asset.mimeType,
                                      asset.assetType,
                                      asset.driveKind
                                    ).formatLabel
                                  }
                                </span>
                                <span className="mx-1 text-[#C7C7CC]" aria-hidden="true">
                                  ·
                                </span>
                                {asset.dimensionsOrDuration}
                              </div>
                            </div>
                          </div>

                          {(asset.fileSizeBytes || asset.mimeType) && (
                            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-[#515154] bg-[#F5F5F7]/85 border border-black/[0.05] rounded-[7px] px-2.5 py-1">
                              <span className="truncate">
                                {asset.mimeType ||
                                  storageManager.inferMimeType(
                                    asset.name,
                                    asset.assetType
                                  )}
                              </span>
                              <span className="font-semibold text-[#1D1D1F] shrink-0">
                                {asset.fileSizeBytes
                                  ? storageManager.formatBytes(
                                      asset.fileSizeBytes
                                    )
                                  : '—'}
                              </span>
                            </div>
                          )}

                          {asset.notes && (
                            <p className="text-[12px] text-[#515154] mt-2 line-clamp-2 leading-relaxed">
                              {asset.notes}
                            </p>
                          )}

                          <div className="mt-auto pt-3.5 flex items-center justify-between gap-2 border-t border-black/[0.06] mt-4">
                            <select
                              aria-label={`Approval status for ${asset.name}`}
                              value={asset.status}
                              onChange={(e) =>
                                onUpdateAssetStatus(
                                  project.id,
                                  asset.id,
                                  e.target.value as AssetStatus
                                )
                              }
                              className="text-[12px] font-medium text-[#1D1D1F] bg-[#F5F5F7] border border-black/[0.08] rounded-[7px] px-2 py-1 focus:outline-none focus:bg-white focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
                            >
                              <option value="draft">Draft</option>
                              <option value="in_review">In Review</option>
                              <option value="approved">Approved</option>
                            </select>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenAssetQuickLook(asset)}
                                title="Preview in Quick Look"
                                aria-label={`Preview ${asset.name} in Quick Look`}
                                className="p-1.5 text-[#0071E3] hover:bg-[#0071E3]/[0.08] rounded-[7px] transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {isSafeHttpUrl(asset.externalUrl) && (
                                <a
                                  href={asset.externalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={
                                    storageSource === 'google_drive'
                                      ? 'Open in Google Drive'
                                      : 'Open external source link'
                                  }
                                  className="p-1.5 text-[#6E6E73] hover:text-[#0071E3] hover:bg-[#0071E3]/[0.07] rounded-[7px] transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onRemoveAsset(project.id, asset.id)}
                                aria-label={`Remove ${asset.name}`}
                                className="p-1.5 text-[#86868B] hover:text-[#D70015] hover:bg-[#D70015]/[0.06] rounded-[7px] transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: REAL-TIME PERFORMANCE */}
        {activeTab === 'performance' && (
          <div className="max-w-5xl space-y-6">
            {/* Control Strip */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
                  Real-Time Performance Tracking
                </h3>
                <p className="text-[12px] text-[#6E6E73] mt-0.5">
                  Monitor reach, engagements, CTA conversion ({project.ctaLabel}), and completion rate with live cross-tab sync.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleLiveStream}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-medium rounded-[9px] border transition-all duration-150 active:scale-[0.98] whitespace-nowrap ${
                  liveStreamActive
                    ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                    : 'bg-white text-[#1D1D1F] border-black/[0.09] hover:bg-black/[0.03] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'
                }`}
              >
                {liveStreamActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pause Live Feed
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Stream Live Metrics
                  </>
                )}
              </button>
            </div>

            {/* Flat KPI Grid */}
            <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-black/[0.07]">
              <div className="p-4">
                <div className="text-[12px] text-[#6E6E73]">Total Reach / Views</div>
                <div className="mt-1.5 text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-[#1D1D1F]">
                  {latestMetrics.views.toLocaleString()}
                </div>
              </div>
              <div className="p-4">
                <div className="text-[12px] text-[#6E6E73]">Engagements</div>
                <div className="mt-1.5 text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-[#1D1D1F]">
                  {latestMetrics.engagements.toLocaleString()}
                </div>
              </div>
              <div className="p-4">
                <div className="text-[12px] text-[#6E6E73]">CTA Actions</div>
                <div className="mt-1.5 text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-[#0071E3]">
                  {latestMetrics.ctaClicks.toLocaleString()}
                </div>
              </div>
              <div className="p-4">
                <div className="text-[12px] text-[#6E6E73]">CTA Conversion</div>
                <div className="mt-1.5 text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-[#1D1D1F]">
                  {latestMetrics.ctr.toFixed(1)}%
                </div>
              </div>
              <div className="p-4 col-span-2 lg:col-span-1">
                <div className="text-[12px] text-[#6E6E73]">
                  {project.format === 'slide' ? 'Slide Completion' : 'Avg Watch Rate'}
                </div>
                <div className="mt-1.5 text-[22px] font-semibold font-mono tabular-nums tracking-[-0.02em] text-[#1F8A4C]">
                  {latestMetrics.completionRate}%
                </div>
              </div>
            </div>

            {/* Time-Series Chart */}
            <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-[14px] font-semibold text-[#1D1D1F]">
                    Reach & CTA Conversion Velocity
                  </h4>
                  <p className="text-[11.5px] text-[#6E6E73] mt-0.5">
                    Target CTA: {project.ctaLabel}
                  </p>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-[#6E6E73]">
                  {project.metrics.length} snapshots recorded
                </span>
              </div>

              {project.metrics.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center border border-dashed border-black/[0.14] rounded-xl text-center px-4 bg-[#FAFAFC]">
                  <Activity className="w-5 h-5 text-[#86868B] mb-2" />
                  <p className="text-[13px] font-semibold text-[#1D1D1F]">
                    No performance data recorded yet
                  </p>
                  <p className="text-[12px] text-[#6E6E73] mt-1 max-w-sm">
                    Log an initial snapshot below once published, or enable Stream Live Metrics on a Published folder to observe real-time telemetry.
                  </p>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={project.metrics}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0071E3" stopOpacity={0.14} />
                          <stop offset="95%" stopColor="#0071E3" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#6E6E73', fontFamily: 'JetBrains Mono' }}
                        axisLine={{ stroke: '#E5E5EA' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6E6E73', fontFamily: 'JetBrains Mono' }}
                        axisLine={false}
                        tickLine={false}
                        width={54}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(255,255,255,0.96)',
                          borderColor: 'rgba(0,0,0,0.08)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="views"
                        name="Views"
                        stroke="#0071E3"
                        strokeWidth={2}
                        fill="url(#viewsFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="engagements"
                        name="Engagements"
                        stroke="#1D1D1F"
                        strokeWidth={1.6}
                        fill="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="ctaClicks"
                        name="CTA Clicks"
                        stroke="#1F8A4C"
                        strokeWidth={1.6}
                        fill="none"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Manual Real-Time Metric Logger */}
            <form
              onSubmit={handleRecordSnapshot}
              className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5"
            >
              <h4 className="text-[13.5px] font-semibold text-[#1D1D1F] mb-3.5">
                Log Live Performance Snapshot
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-medium text-[#515154] mb-1">
                    Interval Label
                  </label>
                  <input
                    type="text"
                    value={snapLabel}
                    onChange={(e) => setSnapLabel(e.target.value)}
                    placeholder="e.g., 48h / Now"
                    className={compactInputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#515154] mb-1">
                    Total Views
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={snapViews}
                    onChange={(e) => setSnapViews(e.target.value)}
                    className={`${compactInputClass} font-mono tabular-nums`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#515154] mb-1">
                    Engagements
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={snapEngagements}
                    onChange={(e) => setSnapEngagements(e.target.value)}
                    className={`${compactInputClass} font-mono tabular-nums`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#515154] mb-1">
                    CTA Clicks
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={snapCtaClicks}
                    onChange={(e) => setSnapCtaClicks(e.target.value)}
                    className={`${compactInputClass} font-mono tabular-nums`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#515154] mb-1">
                    Completion %
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={snapCompletion}
                    onChange={(e) => setSnapCompletion(e.target.value)}
                    className={`${compactInputClass} font-mono tabular-nums`}
                  />
                </div>
                <div>
                  <button
                    type="submit"
                    className="w-full py-1.5 px-3 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] rounded-[8px] shadow-[0_1px_2px_rgba(0,113,227,0.25)] transition-all whitespace-nowrap"
                  >
                    Record Snapshot
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* TAB 5: COLLABORATION COMMENTS */}
        {activeTab === 'comments' && (
          <CollaborationComments
            project={project}
            comments={currentComments}
            onAddComment={handleAddComment}
            onToggleResolve={handleToggleResolveComment}
            onDeleteComment={handleDeleteComment}
            onInspectAsset={(asset) =>
              handleOpenAssetQuickLook(asset, 'comment reference')
            }
          />
        )}

        {/* TAB 6: PER-FOLDER ACTIVITY LOG */}
        {activeTab === 'activity' && (
          <ActivityLogView
            logs={activityLogs}
            projects={[project]}
            scopedProjectId={project.id}
            onExportCsv={onExportActivityCsv}
          />
        )}
      </div>

      {/* Apple Quick Look Modal (Google Drive Embeds + S3 Direct Media) */}
      <QuickLookModal
        asset={lightboxAsset}
        allAssets={project.assets}
        driveFolder={previewDriveFolder}
        onClose={() => {
          setLightboxAssetId(null);
          setPreviewDriveFolder(null);
        }}
        onSelectAsset={(next) => {
          setPreviewDriveFolder(null);
          setLightboxAssetId(next.id);
        }}
        onUpdateAssetStatus={(assetId, nextStatus) =>
          onUpdateAssetStatus(project.id, assetId, nextStatus)
        }
      />
    </div>
  );
}
