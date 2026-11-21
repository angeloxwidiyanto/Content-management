export type StrategyType = 'internal' | 'external';

export type ContentFormat = 'slide' | 'video';

export type ChannelId =
  | 'whatsapp_channel'
  | 'ig_short'
  | 'ig_reel'
  | 'ig_post'
  | 'tiktok'
  | 'youtube_long'
  | 'youtube_short'
  | 'website'
  | 'warta_mimbar'
  | 'warta_running'
  | 'warta_setelah_khotbah';

export type WorkflowStatus =
  | 'backlog'
  | 'scripting'
  | 'production'
  | 'review'
  | 'scheduled'
  | 'published';

export type AssetType =
  | 'slide_deck'
  | 'video_cut'
  | 'thumbnail'
  | 'script_doc'
  | 'raw_clip';

export type AssetStatus = 'draft' | 'in_review' | 'approved';

export type AssetStorageSource = 'google_drive' | 's3' | 'external';

export type AssetDriveKind = 'file' | 'slides' | 'docs' | 'sheets' | 'folder';

export type S3StorageClass =
  | 'STANDARD'
  | 'INTELLIGENT_TIERING'
  | 'STANDARD_IA'
  | 'GLACIER_IR';

export interface TimelineMilestone {
  id: string;
  title: string;
  phase: string;
  ownerName: string;
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
}

export interface MediaAsset {
  id: string;
  name: string;
  assetType: AssetType;
  version: string;
  status: AssetStatus;
  storageSource?: AssetStorageSource;
  driveFileId?: string;
  driveKind?: AssetDriveKind;
  s3Key?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3StorageClass?: S3StorageClass;
  s3ETag?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  previewUrl: string;
  externalUrl: string;
  dimensionsOrDuration: string;
  notes: string;
  updatedAt: string; // ISO string
}

export interface PerformanceSnapshot {
  id: string;
  recordedAt: string; // ISO string
  label: string; // e.g. "Day 1", "14:00", "Nov 18"
  views: number;
  engagements: number;
  ctaClicks: number;
  completionRate: number; // 0 - 100
}

export interface ContentProject {
  id: string;
  folderCode: string; // e.g., INT-014, EXT-028
  title: string;
  summary: string;
  strategy: StrategyType;
  format: ContentFormat;
  contentModel: string;
  ctaLabel: string;
  ctaDestination: string;
  channel: ChannelId;
  status: WorkflowStatus;
  scheduledDate: string | null; // YYYY-MM-DD or null for Unscheduled Backlog
  scheduledTime: string; // HH:mm
  assigneeName: string;
  campaign: string;
  tags: string[];
  briefNotes: string;
  driveFolderUrl?: string;
  driveFolderName?: string;
  createdAt: string;
  updatedAt: string;
  milestones: TimelineMilestone[];
  assets: MediaAsset[];
  metrics: PerformanceSnapshot[];
}

export interface FilterState {
  strategy: 'all' | StrategyType;
  format: 'all' | ContentFormat;
  channel: 'all' | ChannelId;
  status: 'all' | WorkflowStatus;
  tag: 'all' | string;
  search: string;
}

export type FunnelGroup =
  | 'Warta'
  | 'WhatsApp & Website'
  | 'Instagram'
  | 'TikTok & YouTube';

export interface ChannelMeta {
  id: ChannelId;
  label: string;
  shortLabel: string;
  group: FunnelGroup;
  defaultFormat: ContentFormat;
  recommendedStrategy: StrategyType;
}

export const CHANNELS: ChannelMeta[] = [
  {
    id: 'whatsapp_channel',
    label: 'WhatsApp Channel',
    shortLabel: 'WA Channel',
    group: 'WhatsApp & Website',
    defaultFormat: 'slide',
    recommendedStrategy: 'internal',
  },
  {
    id: 'ig_short',
    label: 'IG Short',
    shortLabel: 'IG Short',
    group: 'Instagram',
    defaultFormat: 'video',
    recommendedStrategy: 'external',
  },
  {
    id: 'ig_reel',
    label: 'IG Reel',
    shortLabel: 'IG Reel',
    group: 'Instagram',
    defaultFormat: 'video',
    recommendedStrategy: 'external',
  },
  {
    id: 'ig_post',
    label: 'IG Post',
    shortLabel: 'IG Post',
    group: 'Instagram',
    defaultFormat: 'slide',
    recommendedStrategy: 'external',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    shortLabel: 'TikTok',
    group: 'TikTok & YouTube',
    defaultFormat: 'video',
    recommendedStrategy: 'external',
  },
  {
    id: 'youtube_long',
    label: 'YouTube Long',
    shortLabel: 'YT Long',
    group: 'TikTok & YouTube',
    defaultFormat: 'video',
    recommendedStrategy: 'external',
  },
  {
    id: 'youtube_short',
    label: 'YouTube Short',
    shortLabel: 'YT Short',
    group: 'TikTok & YouTube',
    defaultFormat: 'video',
    recommendedStrategy: 'external',
  },
  {
    id: 'website',
    label: 'Website',
    shortLabel: 'Website',
    group: 'WhatsApp & Website',
    defaultFormat: 'slide',
    recommendedStrategy: 'external',
  },
  {
    id: 'warta_mimbar',
    label: 'Warta — Mimbar',
    shortLabel: 'Warta Mimbar',
    group: 'Warta',
    defaultFormat: 'slide',
    recommendedStrategy: 'internal',
  },
  {
    id: 'warta_running',
    label: 'Warta — Running',
    shortLabel: 'Warta Running',
    group: 'Warta',
    defaultFormat: 'slide',
    recommendedStrategy: 'internal',
  },
  {
    id: 'warta_setelah_khotbah',
    label: 'Warta — Setelah Khotbah',
    shortLabel: 'Warta Post-Khotbah',
    group: 'Warta',
    defaultFormat: 'video',
    recommendedStrategy: 'internal',
  },
];

export const FUNNEL_GROUPS: FunnelGroup[] = [
  'Warta',
  'WhatsApp & Website',
  'Instagram',
  'TikTok & YouTube',
];

export const CHANNEL_MAP: Record<ChannelId, ChannelMeta> = CHANNELS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ChannelId, ChannelMeta>
);

export const CONTENT_MODELS_BY_STRATEGY: Record<StrategyType, string[]> = {
  internal: [
    'Event Announcement',
    'Ministry Highlight',
    'Congregation Briefing',
    'Registration Push',
    'Weekly Schedule',
    'Volunteer Call',
    'Testimony Spotlight',
  ],
  external: [
    'Educational Carousel',
    'Hook-Story-Offer',
    'Sermon Highlight Clip',
    'Event Invitation',
    'Behind-the-Scenes',
    'Community Story',
    'Full Session Replay',
  ],
};

export const CTA_PRESETS_BY_STRATEGY: Record<StrategyType, string[]> = {
  internal: [
    'Scan QR to Register',
    'Join WhatsApp Channel',
    'Visit Website Registration',
    'Contact Info Desk',
    'Confirm Attendance',
    'Watch Full Announcement',
  ],
  external: [
    'Follow WhatsApp Channel',
    'Visit Website',
    'Comment Keyword for Info',
    'Click Bio Link',
    'Save & Share',
    'Subscribe on YouTube',
  ],
};

export const TAG_SUGGESTIONS_BY_STRATEGY: Record<StrategyType, string[]> = {
  internal: [
    'warta',
    'sunday',
    'retreat',
    'volunteer',
    'qr-register',
    'prayer',
    'logistics',
    'broadcast',
  ],
  external: [
    'sermon',
    'highlight',
    'carousel',
    'reel',
    'bts',
    'replay',
    'registration',
    'community',
  ],
};

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function normalizeTagList(rawTags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawTags) {
    for (const part of raw.split(',')) {
      const normalized = normalizeTag(part);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    }
  }
  return result;
}

export const STATUS_META: Record<
  WorkflowStatus,
  { label: string; textClass: string; order: number }
> = {
  backlog: { label: 'Backlog', textClass: 'text-[#6E6E73]', order: 0 },
  scripting: { label: 'Scripting', textClass: 'text-[#515154]', order: 1 },
  production: { label: 'Production', textClass: 'text-[#0071E3]', order: 2 },
  review: { label: 'In Review', textClass: 'text-[#B25E09]', order: 3 },
  scheduled: { label: 'Scheduled', textClass: 'text-[#0071E3]', order: 4 },
  published: { label: 'Published', textClass: 'text-[#1F8A4C]', order: 5 },
};

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  slide_deck: 'Slide Deck',
  video_cut: 'Video Cut',
  thumbnail: 'Cover / Frame',
  script_doc: 'Script / Copy',
  raw_clip: 'Raw Footage',
};

export const ASSET_STATUS_META: Record<
  AssetStatus,
  { label: string; textClass: string }
> = {
  draft: { label: 'Draft', textClass: 'text-[#6E6E73]' },
  in_review: { label: 'In Review', textClass: 'text-[#B25E09]' },
  approved: { label: 'Approved', textClass: 'text-[#1F8A4C]' },
};

export const ASSET_STORAGE_META: Record<
  AssetStorageSource,
  { label: string; shortLabel: string; textClass: string }
> = {
  google_drive: {
    label: 'Google Drive',
    shortLabel: 'Google Drive',
    textClass: 'text-[#0071E3]',
  },
  s3: {
    label: 'S3 Media Bucket',
    shortLabel: 'S3 Media',
    textClass: 'text-[#1D1D1F]',
  },
  external: {
    label: 'External Link',
    shortLabel: 'External',
    textClass: 'text-[#6E6E73]',
  },
};

export interface TeamMember {
  id: string;
  name: string;
  handle: string;
  role: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'tm-nadia', name: 'Nadia Pratama', handle: 'Nadia', role: 'Content Lead' },
  { id: 'tm-dimas', name: 'Dimas Kusuma', handle: 'Dimas', role: 'Video Producer' },
  { id: 'tm-raka', name: 'Raka Wijaya', handle: 'Raka', role: 'Visual Designer' },
  { id: 'tm-sora', name: 'Sora Lindqvist', handle: 'Sora', role: 'Social Strategist' },
  { id: 'tm-claire', name: 'Claire Halim', handle: 'Claire', role: 'Editorial Director' },
];

export interface FolderComment {
  id: string;
  authorName: string;
  authorRole: string;
  body: string;
  taggedMembers: string[];
  mentionedAssetId: string | null;
  mentionedAssetName: string | null;
  assetTimestamp: string;
  createdAt: string;
  resolved: boolean;
}

export type ActivityCategory =
  | 'project'
  | 'workflow'
  | 'schedule'
  | 'asset'
  | 'storage'
  | 'milestone'
  | 'comment'
  | 'performance'
  | 'workspace';

export interface ActivityLogEntry {
  id: string;
  timestamp: string; // ISO string
  category: ActivityCategory;
  action: string;
  summary: string;
  projectId?: string;
  folderCode?: string;
  projectTitle?: string;
  detail?: string;
}

export const ACTIVITY_CATEGORY_META: Record<
  ActivityCategory,
  { label: string; textClass: string }
> = {
  project: { label: 'Project', textClass: 'text-[#0071E3]' },
  workflow: { label: 'Workflow', textClass: 'text-[#7C3AED]' },
  schedule: { label: 'Schedule', textClass: 'text-[#0071E3]' },
  asset: { label: 'Asset', textClass: 'text-[#1F8A4C]' },
  storage: { label: 'S3 Storage', textClass: 'text-[#1D1D1F]' },
  milestone: { label: 'Milestone', textClass: 'text-[#B25E09]' },
  comment: { label: 'Comment', textClass: 'text-[#515154]' },
  performance: { label: 'Performance', textClass: 'text-[#1F8A4C]' },
  workspace: { label: 'Workspace', textClass: 'text-[#6E6E73]' },
};

export function matchesProjectQuery(
  project: ContentProject,
  rawQuery: string
): boolean {
  const trimmed = rawQuery.trim().toLowerCase();
  if (!trimmed) return true;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const channelLabel = CHANNEL_MAP[project.channel]?.label ?? '';
  const channelShort = CHANNEL_MAP[project.channel]?.shortLabel ?? '';
  const tagsList = (project.tags ?? []).map((t) => t.toLowerCase());
  const tagsText = tagsList.map((t) => `${t} #${t}`).join(' ');

  const haystack = [
    project.folderCode,
    project.title,
    tagsText,
    project.campaign,
    project.contentModel,
    project.ctaLabel,
    project.assigneeName,
    project.strategy,
    project.format,
    channelLabel,
    channelShort,
  ]
    .join(' ')
    .toLowerCase();

  return tokens.every((token) => {
    const clean = token.startsWith('#') ? token.slice(1) : token;
    if (!clean) return true;
    return haystack.includes(clean);
  });
}

export function getLatestMetrics(project: ContentProject) {
  if (!project.metrics || project.metrics.length === 0) {
    return { views: 0, engagements: 0, ctaClicks: 0, completionRate: 0, ctr: 0 };
  }
  const latest = project.metrics[project.metrics.length - 1];
  const ctr = latest.views > 0 ? (latest.ctaClicks / latest.views) * 100 : 0;
  return {
    views: latest.views,
    engagements: latest.engagements,
    ctaClicks: latest.ctaClicks,
    completionRate: latest.completionRate,
    ctr,
  };
}
