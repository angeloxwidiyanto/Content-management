import { useCallback, useEffect, useRef, useState } from 'react';
import { createSeedProjects } from '../data/seedProjects';
import { storageManager } from '../services/storageManager';
import {
  ConflictError,
  ForbiddenError,
  fetchMe,
  fetchWorkspace,
  saveWorkspace,
  type CurrentUser,
} from '../services/workspaceApi';
import {
  ASSET_STATUS_META,
  ActivityCategory,
  ActivityLogEntry,
  AssetStatus,
  CHANNEL_MAP,
  ContentProject,
  MediaAsset,
  PerformanceSnapshot,
  STATUS_META,
  StrategyType,
  TimelineMilestone,
  WorkflowStatus,
  normalizeTagList,
} from '../types/content';

const STORAGE_KEY = 'cadence_studio_projects_v3';
const LOG_STORAGE_KEY = 'cadence_studio_activity_log_v1';
const CHANNEL_NAME = 'cadence_studio_sync_channel_v3';
const MAX_ACTIVITY_LOGS = 500;

export interface ActivityLogDraft {
  category: ActivityCategory;
  action: string;
  summary: string;
  projectId?: string;
  folderCode?: string;
  projectTitle?: string;
  detail?: string;
}

export interface ToastNotice {
  id: string;
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
}

function loadInitialActivityLogs(initialProjects: ContentProject[]): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, MAX_ACTIVITY_LOGS);
      }
    }
  } catch {
    // Ignore storage read errors
  }

  const starterLog: ActivityLogEntry[] = [
    {
      id: `log-init-${Date.now()}`,
      timestamp: new Date().toISOString(),
      category: 'workspace',
      action: 'Session Started',
      summary: `Workspace loaded with ${initialProjects.length} project folders`,
      detail: 'Local persistence & cross-tab sync active',
    },
  ];
  try {
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(starterLog));
  } catch {
    // Ignore quota errors
  }
  return starterLog;
}

function loadInitialProjects(): ContentProject[] {
  const seeded = createSeedProjects();
  const seedTagMap = new Map(seeded.map((s) => [s.id, s.tags ?? []]));
  const seedAssetMap = new Map<string, MediaAsset>();
  for (const proj of seeded) {
    for (const asset of proj.assets) {
      seedAssetMap.set(asset.id, asset);
    }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every((p) => p && CHANNEL_MAP[p.channel as keyof typeof CHANNEL_MAP])
      ) {
        return parsed.map((p: ContentProject) => ({
          ...p,
          tags: normalizeTagList(
            Array.isArray(p.tags) ? p.tags : seedTagMap.get(p.id) ?? []
          ),
          assets: Array.isArray(p.assets)
            ? p.assets.map((asset: MediaAsset) => {
                const seedMatch = seedAssetMap.get(asset.id);
                if (!seedMatch) return asset;
                return {
                  ...asset,
                  storageSource: asset.storageSource ?? seedMatch.storageSource,
                  s3Bucket: asset.s3Bucket ?? seedMatch.s3Bucket,
                  s3Region: asset.s3Region ?? seedMatch.s3Region,
                  s3Key: asset.s3Key ?? seedMatch.s3Key,
                  s3StorageClass:
                    asset.s3StorageClass ?? seedMatch.s3StorageClass,
                  fileSizeBytes: asset.fileSizeBytes ?? seedMatch.fileSizeBytes,
                  mimeType: asset.mimeType ?? seedMatch.mimeType,
                };
              })
            : [],
        }));
      }
    }
  } catch {
    // Fallback to curated seed workspace
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  } catch {
    // Ignore storage quota issues in restricted iframes
  }
  return seeded;
}

export function useWorkspaceStore() {
  const [projects, setProjects] = useState<ContentProject[]>(() =>
    loadInitialProjects()
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>(() =>
    loadInitialActivityLogs(loadInitialProjects())
  );
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const [serverVersion, setServerVersion] = useState(0);
  const versionRef = useRef(0);
  const justHydratedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [syncState, setSyncState] = useState<
    'menghubungkan' | 'siap' | 'menyimpan' | 'konflik' | 'galat' | 'ditolak'
  >('menghubungkan');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<{ updatedAt: string | null; updatedBy: string | null }>({
    updatedAt: null,
    updatedBy: null,
  });
  const [liveStreamActive, setLiveStreamActive] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toISOString()
  );
  const channelRef = useRef<BroadcastChannel | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const projectsRef = useRef<ContentProject[]>(projects);
  projectsRef.current = projects;

  const showToast = useCallback(
    (message: string, options?: { undoLabel?: string; onUndo?: () => void }) => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      const id = `toast-${Date.now()}`;
      setToast({
        id,
        message,
        undoLabel: options?.undoLabel,
        onUndo: options?.onUndo,
      });
      toastTimeoutRef.current = window.setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    setToast(null);
  }, []);

  const persistAndBroadcastLogs = useCallback((nextLogs: ActivityLogEntry[]) => {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(nextLogs));
    } catch {
      // Ignore storage quota errors
    }
    try {
      channelRef.current?.postMessage({ type: 'SYNC_LOGS', logs: nextLogs });
    } catch {
      // BroadcastChannel optional
    }
  }, []);

  const recordLog = useCallback(
    (draft: ActivityLogDraft) => {
      const entry: ActivityLogEntry = {
        ...draft,
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => {
        const next = [entry, ...prev].slice(0, MAX_ACTIVITY_LOGS);
        persistAndBroadcastLogs(next);
        return next;
      });
    },
    [persistAndBroadcastLogs]
  );

  const clearActivityLogs = useCallback(() => {
    const resetEntry: ActivityLogEntry = {
      id: `log-${Date.now()}-clear`,
      timestamp: new Date().toISOString(),
      category: 'workspace',
      action: 'Activity Log Cleared',
      summary: 'Cleared previous activity log entries',
    };
    const next = [resetEntry];
    setActivityLogs(next);
    persistAndBroadcastLogs(next);
    showToast('Activity log cleared');
  }, [persistAndBroadcastLogs, showToast]);

  const exportActivityLogsCsv = useCallback(
    (entriesToExport?: ActivityLogEntry[]) => {
      const rows = entriesToExport ?? activityLogs;
      const escapeCell = (value: string | undefined) => {
        const safe = (value ?? '').replace(/"/g, '""');
        return `"${safe}"`;
      };
      const header = [
        'Timestamp',
        'Category',
        'Action',
        'Folder Code',
        'Project Title',
        'Summary',
        'Detail',
      ].join(',');
      const lines = rows.map((entry) =>
        [
          escapeCell(entry.timestamp),
          escapeCell(entry.category),
          escapeCell(entry.action),
          escapeCell(entry.folderCode),
          escapeCell(entry.projectTitle),
          escapeCell(entry.summary),
          escapeCell(entry.detail),
        ].join(',')
      );
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cadence-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      recordLog({
        category: 'workspace',
        action: 'Activity Log Exported',
        summary: `Exported ${rows.length} log ${rows.length === 1 ? 'entry' : 'entries'} to CSV`,
        detail: `cadence-activity-log-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      showToast(`Exported ${rows.length} activity log entries (CSV)`);
    },
    [activityLogs, recordLog, showToast]
  );

  const persistAndBroadcast = useCallback((next: ContentProject[]) => {
    const stamp = new Date().toISOString();
    setLastSyncedAt(stamp);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
    try {
      channelRef.current?.postMessage({ type: 'SYNC_PROJECTS', projects: next });
    } catch {
      // BroadcastChannel optional
    }
  }, []);

  // Cross-tab real-time sync via BroadcastChannel + storage event
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data?.type === 'SYNC_PROJECTS' && Array.isArray(event.data.projects)) {
          setProjects(event.data.projects);
          setLastSyncedAt(new Date().toISOString());
        } else if (event.data?.type === 'SYNC_LOGS' && Array.isArray(event.data.logs)) {
          setActivityLogs(event.data.logs);
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setProjects(parsed);
            setLastSyncedAt(new Date().toISOString());
          }
        } catch {
          // Ignore malformed payload
        }
      } else if (e.key === LOG_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setActivityLogs(parsed);
          }
        } catch {
          // Ignore malformed payload
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channelRef.current?.close();
    };
  }, []);

  const commit = useCallback(
    (updater: (prev: ContentProject[]) => ContentProject[]) => {
      setProjects((prev) => {
        const next = updater(prev);
        persistAndBroadcast(next);
        return next;
      });
    },
    [persistAndBroadcast]
  );

  // Optional real-time performance feed for live tracking demonstrations
  useEffect(() => {
    if (!liveStreamActive) return;

    const timer = window.setInterval(() => {
      const now = new Date();
      const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      commit((prev) =>
        prev.map((project) => {
          if (project.status !== 'published') return project;
          const last = project.metrics[project.metrics.length - 1] ?? {
            views: project.strategy === 'internal' ? 40 : 1200,
            engagements: project.strategy === 'internal' ? 18 : 110,
            ctaClicks: project.strategy === 'internal' ? 12 : 42,
            completionRate: 72,
          };

          const isInternal = project.strategy === 'internal';
          const viewDelta = isInternal
            ? Math.floor(Math.random() * 5) + 1
            : Math.floor(Math.random() * 140) + 25;
          const engDelta = Math.max(
            1,
            Math.round(viewDelta * (isInternal ? 0.45 : 0.11))
          );
          const ctaDelta = Math.max(
            0,
            Math.round(viewDelta * (isInternal ? 0.35 : 0.045))
          );
          const nextCompletion = Math.min(
            98,
            Math.max(45, Math.round(last.completionRate + (Math.random() * 2 - 0.8)))
          );

          const snapshot: PerformanceSnapshot = {
            id: `mt-live-${Date.now()}-${project.id}`,
            recordedAt: now.toISOString(),
            label: timeLabel,
            views: last.views + viewDelta,
            engagements: last.engagements + engDelta,
            ctaClicks: last.ctaClicks + ctaDelta,
            completionRate: nextCompletion,
          };

          const trimmed = [...project.metrics, snapshot].slice(-14);
          return {
            ...project,
            updatedAt: now.toISOString(),
            metrics: trimmed,
          };
        })
      );
    }, 3500);

    return () => window.clearInterval(timer);
  }, [liveStreamActive, commit]);

  const generateNextFolderCode = useCallback(
    (strategy: StrategyType, currentList: ContentProject[]) => {
      const prefix = strategy === 'internal' ? 'INT' : 'EXT';
      let maxNum = strategy === 'internal' ? 10 : 20;
      for (const p of currentList) {
        if (p.folderCode.startsWith(`${prefix}-`)) {
          const parsed = parseInt(p.folderCode.split('-')[1], 10);
          if (!Number.isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
      return `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    },
    []
  );

  const createProject = useCallback(
    (
      draft: Omit<
        ContentProject,
        'id' | 'folderCode' | 'createdAt' | 'updatedAt' | 'milestones' | 'assets' | 'metrics'
      >
    ) => {
      const now = new Date().toISOString();
      const id = `proj-${Date.now()}`;
      const folderCode = generateNextFolderCode(draft.strategy, projectsRef.current);
      const defaultDue =
        draft.scheduledDate ?? new Date().toISOString().slice(0, 10);
      const starterMilestones: TimelineMilestone[] = [
        {
          id: `ms-${Date.now()}-1`,
          title: 'Finalize brief, hook, and CTA alignment',
          phase: 'Brief',
          ownerName: draft.assigneeName || 'Unassigned',
          dueDate: defaultDue,
          completed: false,
        },
        {
          id: `ms-${Date.now()}-2`,
          title:
            draft.format === 'slide'
              ? 'Design slide deck & export master frames'
              : 'Shoot, edit cut, and burn in captions',
          phase: 'Production',
          ownerName: draft.assigneeName || 'Unassigned',
          dueDate: defaultDue,
          completed: false,
        },
        {
          id: `ms-${Date.now()}-3`,
          title: 'Stakeholder review & publish approval',
          phase: 'Review',
          ownerName: draft.assigneeName || 'Unassigned',
          dueDate: defaultDue,
          completed: false,
        },
      ];

      const normalizedTags = normalizeTagList(draft.tags ?? []);

      const project: ContentProject = {
        ...draft,
        tags: normalizedTags,
        id,
        folderCode,
        createdAt: now,
        updatedAt: now,
        milestones: starterMilestones,
        assets: [],
        metrics: [],
      };

      commit((prev) => [project, ...prev]);

      const channelLabel = CHANNEL_MAP[draft.channel]?.shortLabel ?? draft.channel;
      const tagsSuffix =
        normalizedTags.length > 0
          ? ` · ${normalizedTags.map((t) => `#${t}`).join(' ')}`
          : '';
      recordLog({
        category: 'project',
        action: 'Folder Created',
        summary: `Created project folder "${draft.title}"`,
        projectId: project.id,
        folderCode: project.folderCode,
        projectTitle: project.title,
        detail: `${draft.strategy === 'internal' ? 'Internal' : 'External'} · ${channelLabel} · ${draft.scheduledDate ?? 'Unscheduled Backlog'}${tagsSuffix}`,
      });

      showToast(`Created folder for "${draft.title}"`);
      return project;
    },
    [commit, generateNextFolderCode, recordLog, showToast]
  );

  const updateProject = useCallback(
    (projectId: string, patch: Partial<ContentProject>, silent = false) => {
      const normalizedPatch: Partial<ContentProject> =
        patch.tags !== undefined
          ? { ...patch, tags: normalizeTagList(patch.tags) }
          : patch;
      const existing = projectsRef.current.find((p) => p.id === projectId);
      commit((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, ...normalizedPatch, updatedAt: new Date().toISOString() }
            : p
        )
      );

      if (existing) {
        const changedKeys = (Object.keys(patch) as (keyof ContentProject)[]).filter(
          (key) => {
            if (key === 'updatedAt') return false;
            return JSON.stringify(existing[key]) !== JSON.stringify(patch[key]);
          }
        );

        if (changedKeys.length > 0) {
          const isDriveLinkOnly = changedKeys.every(
            (k) => k === 'driveFolderUrl' || k === 'driveFolderName'
          );
          if (isDriveLinkOnly) {
            const linked = Boolean(patch.driveFolderUrl?.trim());
            recordLog({
              category: 'project',
              action: linked ? 'Drive Folder Linked' : 'Drive Folder Unlinked',
              summary: linked
                ? `Linked Google Drive folder "${patch.driveFolderName || existing.folderCode}"`
                : `Removed Google Drive folder link from "${existing.title}"`,
              projectId: existing.id,
              folderCode: existing.folderCode,
              projectTitle: patch.title ?? existing.title,
              detail: linked ? patch.driveFolderUrl : undefined,
            });
          } else {
            const fieldLabels: Partial<Record<keyof ContentProject, string>> = {
              title: 'Title',
              summary: 'Summary',
              strategy: 'Strategy',
              format: 'Format',
              contentModel: 'Model',
              ctaLabel: 'CTA',
              ctaDestination: 'CTA Link',
              channel: 'Funnel',
              status: 'Stage',
              scheduledDate: 'Publish Date',
              scheduledTime: 'Time Slot',
              assigneeName: 'Owner',
              campaign: 'Campaign',
              tags: 'Tags',
              briefNotes: 'Brief Notes',
            };
            const readableFields = changedKeys
              .map((k) => fieldLabels[k] ?? String(k))
              .slice(0, 6);
            const suffix =
              changedKeys.length > 6 ? ` +${changedKeys.length - 6} more` : '';
            recordLog({
              category: 'project',
              action: 'Metadata Updated',
              summary: `Updated details for "${patch.title ?? existing.title}"`,
              projectId: existing.id,
              folderCode: existing.folderCode,
              projectTitle: patch.title ?? existing.title,
              detail: `Changed: ${readableFields.join(', ')}${suffix}`,
            });
          }
        }
      }

      if (!silent) {
        showToast('Project folder updated');
      }
    },
    [commit, recordLog, showToast]
  );

  const rescheduleProject = useCallback(
    (projectId: string, newDate: string | null) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      if (!target || target.scheduledDate === newDate) return;

      const previousDate = target.scheduledDate;
      const previousStatus = target.status;
      const nextStatus =
        newDate === null
          ? target.status === 'scheduled'
            ? 'backlog'
            : target.status
          : target.status === 'backlog'
          ? 'scheduled'
          : target.status;

      commit((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                scheduledDate: newDate,
                status: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );

      const label = newDate
        ? `Moved "${target.title}" to ${newDate}`
        : `Moved "${target.title}" to Unscheduled Backlog`;

      recordLog({
        category: 'schedule',
        action: newDate ? 'Rescheduled' : 'Moved to Backlog',
        summary: label,
        projectId: target.id,
        folderCode: target.folderCode,
        projectTitle: target.title,
        detail: `${previousDate ?? 'Backlog'} → ${newDate ?? 'Backlog'}${
          previousStatus !== nextStatus
            ? ` · Stage: ${STATUS_META[previousStatus].label} → ${STATUS_META[nextStatus].label}`
            : ''
        }`,
      });

      showToast(label, {
        undoLabel: 'Undo',
        onUndo: () => {
          commit((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    scheduledDate: previousDate,
                    status: previousStatus,
                    updatedAt: new Date().toISOString(),
                  }
                : p
            )
          );
          recordLog({
            category: 'schedule',
            action: 'Undo Reschedule',
            summary: `Restored schedule for "${target.title}"`,
            projectId: target.id,
            folderCode: target.folderCode,
            projectTitle: target.title,
            detail: `${newDate ?? 'Backlog'} → ${previousDate ?? 'Backlog'}`,
          });
          dismissToast();
        },
      });
    },
    [commit, recordLog, showToast, dismissToast]
  );

  const moveProjectStatus = useCallback(
    (projectId: string, nextStatus: WorkflowStatus, stageLabel?: string) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      if (!target || target.status === nextStatus) return;

      const previousStatus = target.status;

      commit((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                status: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );

      const displayStage = stageLabel ?? STATUS_META[nextStatus].label;
      const previousStageLabel = STATUS_META[previousStatus].label;

      recordLog({
        category: 'workflow',
        action: 'Stage Changed',
        summary: `Moved "${target.title}" to ${displayStage}`,
        projectId: target.id,
        folderCode: target.folderCode,
        projectTitle: target.title,
        detail: `${previousStageLabel} → ${displayStage}`,
      });

      showToast(`Moved "${target.title}" to ${displayStage}`, {
        undoLabel: 'Undo',
        onUndo: () => {
          commit((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? {
                    ...p,
                    status: previousStatus,
                    updatedAt: new Date().toISOString(),
                  }
                : p
            )
          );
          recordLog({
            category: 'workflow',
            action: 'Undo Stage Change',
            summary: `Restored "${target.title}" back to ${previousStageLabel}`,
            projectId: target.id,
            folderCode: target.folderCode,
            projectTitle: target.title,
            detail: `${displayStage} → ${previousStageLabel}`,
          });
          dismissToast();
        },
      });
    },
    [commit, recordLog, showToast, dismissToast]
  );

  const deleteProject = useCallback(
    (projectId: string) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      commit((prev) => prev.filter((p) => p.id !== projectId));
      if (target) {
        recordLog({
          category: 'project',
          action: 'Folder Deleted',
          summary: `Deleted project folder "${target.title}"`,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: `${target.assets.length} assets · ${target.milestones.length} milestones removed`,
        });
        showToast(`Deleted folder ${target.folderCode}`);
      }
    },
    [commit, recordLog, showToast]
  );

  const toggleMilestone = useCallback(
    (projectId: string, milestoneId: string) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      const ms = target?.milestones.find((m) => m.id === milestoneId);

      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            milestones: p.milestones.map((m) =>
              m.id === milestoneId ? { ...m, completed: !m.completed } : m
            ),
          };
        })
      );

      if (target && ms) {
        const nextCompleted = !ms.completed;
        recordLog({
          category: 'milestone',
          action: nextCompleted ? 'Milestone Completed' : 'Milestone Reopened',
          summary: `${nextCompleted ? 'Completed' : 'Reopened'} "${ms.title}"`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: `${ms.phase} · Due ${ms.dueDate} · ${ms.ownerName}`,
        });
      }
    },
    [commit, recordLog]
  );

  const addMilestone = useCallback(
    (projectId: string, milestone: Omit<TimelineMilestone, 'id'>) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            milestones: [
              ...p.milestones,
              { ...milestone, id: `ms-${Date.now()}` },
            ],
          };
        })
      );
      if (target) {
        recordLog({
          category: 'milestone',
          action: 'Milestone Added',
          summary: `Added milestone "${milestone.title}"`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: `${milestone.phase} · Due ${milestone.dueDate} · ${milestone.ownerName}`,
        });
      }
      showToast('Timeline milestone added');
    },
    [commit, recordLog, showToast]
  );

  const removeMilestone = useCallback(
    (projectId: string, milestoneId: string) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      const ms = target?.milestones.find((m) => m.id === milestoneId);
      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            milestones: p.milestones.filter((m) => m.id !== milestoneId),
          };
        })
      );
      if (target && ms) {
        recordLog({
          category: 'milestone',
          action: 'Milestone Removed',
          summary: `Removed milestone "${ms.title}"`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: `${ms.phase} · Due ${ms.dueDate}`,
        });
      }
    },
    [commit, recordLog]
  );

  const addAsset = useCallback(
    (projectId: string, asset: Omit<MediaAsset, 'id' | 'updatedAt'>) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            assets: [
              {
                ...asset,
                id: `as-${Date.now()}`,
                updatedAt: new Date().toISOString(),
              },
              ...p.assets,
            ],
          };
        })
      );
      if (target) {
        const sourceTag =
          asset.storageSource === 'google_drive'
            ? 'Google Drive'
            : asset.storageSource === 's3'
            ? 'S3 Media'
            : 'External';
        const metaParts = [
          sourceTag,
          asset.version,
          asset.fileSizeBytes
            ? storageManager.formatBytes(asset.fileSizeBytes)
            : null,
          asset.mimeType ?? null,
        ].filter(Boolean);
        recordLog({
          category: 'asset',
          action:
            asset.storageSource === 's3'
              ? 'S3 Asset Registered'
              : asset.storageSource === 'google_drive'
              ? 'Drive Asset Linked'
              : 'Asset Added',
          summary: `Attached "${asset.name}" to ${target.folderCode}`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: metaParts.join(' · '),
        });
      }
      showToast(`Added asset "${asset.name}"`);
    },
    [commit, recordLog, showToast]
  );

  const updateAssetStatus = useCallback(
    (projectId: string, assetId: string, status: AssetStatus) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      const existingAsset = target?.assets.find((a) => a.id === assetId);
      if (existingAsset && existingAsset.status === status) return;

      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            assets: p.assets.map((a) =>
              a.id === assetId
                ? { ...a, status, updatedAt: new Date().toISOString() }
                : a
            ),
          };
        })
      );

      if (target && existingAsset) {
        recordLog({
          category: 'asset',
          action: 'Asset Status Changed',
          summary: `Marked "${existingAsset.name}" as ${ASSET_STATUS_META[status].label}`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: `${ASSET_STATUS_META[existingAsset.status].label} → ${ASSET_STATUS_META[status].label}`,
        });
      }
    },
    [commit, recordLog]
  );

  const updateAsset = useCallback(
    (projectId: string, assetId: string, patch: Partial<MediaAsset>) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      const existingAsset = target?.assets.find((a) => a.id === assetId);

      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            assets: p.assets.map((a) =>
              a.id === assetId
                ? { ...a, ...patch, updatedAt: new Date().toISOString() }
                : a
            ),
          };
        })
      );

      if (target && existingAsset) {
        const parts: string[] = [];
        if (patch.fileSizeBytes !== undefined) {
          parts.push(storageManager.formatBytes(patch.fileSizeBytes));
        }
        if (patch.mimeType) parts.push(patch.mimeType);
        if (patch.s3StorageClass) parts.push(patch.s3StorageClass);
        if (patch.s3Key) parts.push(patch.s3Key);
        recordLog({
          category: 'storage',
          action: 'S3 Metadata Updated',
          summary: `Updated S3 object metadata for "${patch.name ?? existingAsset.name}"`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: parts.length > 0 ? parts.join(' · ') : undefined,
        });
      }
      showToast('Updated S3 asset metadata');
    },
    [commit, recordLog, showToast]
  );

  const removeAsset = useCallback(
    (projectId: string, assetId: string) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      const existingAsset = target?.assets.find((a) => a.id === assetId);

      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: new Date().toISOString(),
            assets: p.assets.filter((a) => a.id !== assetId),
          };
        })
      );

      if (target && existingAsset) {
        recordLog({
          category: 'asset',
          action: 'Asset Removed',
          summary: `Removed "${existingAsset.name}" from ${target.folderCode}`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: `${existingAsset.version}${
            existingAsset.fileSizeBytes
              ? ` · ${storageManager.formatBytes(existingAsset.fileSizeBytes)}`
              : ''
          }`,
        });
      }
      showToast('Asset removed from folder');
    },
    [commit, recordLog, showToast]
  );

  const reorderAssets = useCallback(
    (projectId: string, sourceAssetId: string, targetAssetId: string) => {
      if (sourceAssetId === targetAssetId) return;
      const targetProject = projectsRef.current.find((p) => p.id === projectId);
      if (!targetProject) return;

      const previousAssets = targetProject.assets;
      const sourceIdx = previousAssets.findIndex((a) => a.id === sourceAssetId);
      const targetIdx = previousAssets.findIndex((a) => a.id === targetAssetId);
      if (sourceIdx === -1 || targetIdx === -1) return;

      const reordered = [...previousAssets];
      const [moved] = reordered.splice(sourceIdx, 1);
      reordered.splice(targetIdx, 0, moved);

      commit((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                updatedAt: new Date().toISOString(),
                assets: reordered,
              }
            : p
        )
      );

      const fromPos = String(sourceIdx + 1).padStart(2, '0');
      const toPos = String(targetIdx + 1).padStart(2, '0');

      recordLog({
        category: 'asset',
        action: 'Asset Reordered',
        summary: `Reordered "${moved.name}" to slot #${toPos}`,
        projectId: targetProject.id,
        folderCode: targetProject.folderCode,
        projectTitle: targetProject.title,
        detail: `Position #${fromPos} → #${toPos}`,
      });

      showToast(
        `Moved "${moved.name}" to position ${toPos}`,
        {
          undoLabel: 'Undo',
          onUndo: () => {
            commit((prev) =>
              prev.map((p) =>
                p.id === projectId
                  ? {
                      ...p,
                      updatedAt: new Date().toISOString(),
                      assets: previousAssets,
                    }
                  : p
              )
            );
            recordLog({
              category: 'asset',
              action: 'Undo Asset Reorder',
              summary: `Restored "${moved.name}" back to slot #${fromPos}`,
              projectId: targetProject.id,
              folderCode: targetProject.folderCode,
              projectTitle: targetProject.title,
              detail: `Position #${toPos} → #${fromPos}`,
            });
            dismissToast();
          },
        }
      );
    },
    [commit, recordLog, showToast, dismissToast]
  );

  const logPerformanceSnapshot = useCallback(
    (
      projectId: string,
      snapshot: Omit<PerformanceSnapshot, 'id' | 'recordedAt'>
    ) => {
      const target = projectsRef.current.find((p) => p.id === projectId);
      const now = new Date().toISOString();
      commit((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            updatedAt: now,
            metrics: [
              ...p.metrics,
              {
                ...snapshot,
                id: `mt-${Date.now()}`,
                recordedAt: now,
              },
            ],
          };
        })
      );
      if (target) {
        recordLog({
          category: 'performance',
          action: 'Snapshot Logged',
          summary: `Logged performance checkpoint "${snapshot.label}" for "${target.title}"`,
          projectId: target.id,
          folderCode: target.folderCode,
          projectTitle: target.title,
          detail: `${snapshot.views.toLocaleString()} views · ${snapshot.engagements.toLocaleString()} engagements · ${snapshot.ctaClicks.toLocaleString()} CTA clicks · ${snapshot.completionRate}% completion`,
        });
      }
      showToast('Performance snapshot logged');
    },
    [commit, recordLog, showToast]
  );

  const toggleLiveStream = useCallback(() => {
    const next = !liveStreamActive;
    setLiveStreamActive(next);
    recordLog({
      category: 'performance',
      action: next ? 'Live Feed Started' : 'Live Feed Paused',
      summary: next
        ? 'Enabled live performance telemetry stream'
        : 'Paused live performance telemetry stream',
    });
  }, [liveStreamActive, recordLog]);

  const resetDemoWorkspace = useCallback(() => {
    const seeded = createSeedProjects();
    persistAndBroadcast(seeded);
    setProjects(seeded);
    recordLog({
      category: 'workspace',
      action: 'Workspace Reset',
      summary: `Restored workspace to ${seeded.length} starter project folders`,
    });
    showToast('Workspace reset to starter project folders');
  }, [persistAndBroadcast, recordLog, showToast]);

  const exportWorkspaceJson = useCallback(() => {
    const current = projectsRef.current;
    const filename = `cadence-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(current, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    recordLog({
      category: 'workspace',
      action: 'Workspace Exported',
      summary: `Exported backup of ${current.length} project folders`,
      detail: filename,
    });
    showToast('Exported workspace backup (JSON)');
  }, [recordLog, showToast]);

  // ── sinkronisasi server (tahap 1) ────────────────────────────────
  const hydrateFromServer = useCallback(async () => {
    try {
      setSyncMessage(null);
      const [me, data] = await Promise.all([fetchMe(), fetchWorkspace()]);
      setCurrentUser(me);
      if (data.payload) {
        if (Array.isArray(data.payload.projects)) {
          setProjects(data.payload.projects as ContentProject[]);
        }
        if (Array.isArray(data.payload.activityLogs)) {
          setActivityLogs(data.payload.activityLogs as ActivityLogEntry[]);
        }
        versionRef.current = data.version;
        setServerVersion(data.version);
        setSyncInfo({ updatedAt: data.updatedAt, updatedBy: data.updatedBy });
        justHydratedRef.current = true;
        setSyncState('siap');
      } else {
        // Server masih kosong: unggah workspace lokal sebagai isi awal.
        const seeded = await saveWorkspace(0, {
          projects: loadInitialProjects(),
          activityLogs: loadInitialActivityLogs(loadInitialProjects()),
        });
        versionRef.current = seeded.version;
        setServerVersion(seeded.version);
        justHydratedRef.current = true;
        setSyncState('siap');
      }
    } catch {
      // Tanpa server, aplikasi tetap jalan dengan salinan lokal.
      setSyncState('galat');
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void hydrateFromServer();
  }, [hydrateFromServer]);

  // Simpan otomatis (debounce) setiap kali proyek atau log berubah.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    // Lewati satu kali: perubahan state ini berasal dari hidrasi server, bukan
    // dari tindakan pengguna.
    if (justHydratedRef.current) {
      justHydratedRef.current = false;
      return;
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      setSyncState((prev) => (prev === 'konflik' ? prev : 'menyimpan'));
      void saveWorkspace(versionRef.current, { projects, activityLogs })
        .then((result) => {
          versionRef.current = result.version;
          setServerVersion(result.version);
          setSyncState((prev) => (prev === 'konflik' ? prev : 'siap'));
          setSyncInfo({ updatedAt: new Date().toISOString(), updatedBy: null });
        })
        .catch((error) => {
          if (error instanceof ConflictError) {
            setSyncState('konflik');
          } else if (error instanceof ForbiddenError) {
            setSyncState('ditolak');
            setSyncMessage(error.message);
          } else {
            setSyncState('galat');
          }
        });
    }, 900);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // sengaja tanpa serverVersion: memakainya akan memicu simpan berulang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, activityLogs, hydrated]);

  const reloadWorkspace = useCallback(async () => {
    setSyncState('menghubungkan');
    await hydrateFromServer();
  }, [hydrateFromServer]);

  return {
    projects,
    activityLogs,
    recordLog,
    clearActivityLogs,
    exportActivityLogsCsv,
    toast,
    dismissToast,
    liveStreamActive,
    setLiveStreamActive,
    toggleLiveStream,
    lastSyncedAt,
    createProject,
    updateProject,
    rescheduleProject,
    moveProjectStatus,
    deleteProject,
    toggleMilestone,
    addMilestone,
    removeMilestone,
    addAsset,
    updateAsset,
    updateAssetStatus,
    removeAsset,
    reorderAssets,
    logPerformanceSnapshot,
    resetDemoWorkspace,
    exportWorkspaceJson,
    syncState,
    syncInfo,
    syncMessage,
    currentUser,
    reloadWorkspace,
  };
}
