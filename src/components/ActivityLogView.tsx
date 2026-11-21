import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Download,
  History,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  ACTIVITY_CATEGORY_META,
  ActivityCategory,
  ActivityLogEntry,
  ContentProject,
} from '../types/content';

interface ActivityLogViewProps {
  logs: ActivityLogEntry[];
  projects: ContentProject[];
  scopedProjectId?: string;
  onOpenFolder?: (projectId: string) => void;
  onExportCsv: (entries: ActivityLogEntry[]) => void;
  onClearLogs?: () => void;
}

const ALL_CATEGORIES: ActivityCategory[] = [
  'project',
  'workflow',
  'schedule',
  'asset',
  'storage',
  'milestone',
  'comment',
  'performance',
  'workspace',
];

function formatTimeStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function getDateGroupKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function formatDateGroupHeading(dateKey: string): string {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(
    yesterday.getMonth() + 1
  ).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';

  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ActivityLogView({
  logs,
  projects,
  scopedProjectId,
  onOpenFolder,
  onExportCsv,
  onClearLogs,
}: ActivityLogViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<'all' | ActivityCategory>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const projectIdsSet = useMemo(
    () => new Set(projects.map((p) => p.id)),
    [projects]
  );

  const baseLogs = useMemo(() => {
    if (!scopedProjectId) return logs;
    return logs.filter((entry) => entry.projectId === scopedProjectId);
  }, [logs, scopedProjectId]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: baseLogs.length };
    for (const cat of ALL_CATEGORIES) counts[cat] = 0;
    for (const entry of baseLogs) {
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    }
    return counts;
  }, [baseLogs]);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return baseLogs.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
        return false;
      }
      if (!scopedProjectId && projectFilter !== 'all') {
        if (projectFilter === 'workspace_only') {
          if (entry.projectId) return false;
        } else if (entry.projectId !== projectFilter) {
          return false;
        }
      }
      if (!q) return true;
      const haystack = [
        entry.action,
        entry.summary,
        entry.detail ?? '',
        entry.folderCode ?? '',
        entry.projectTitle ?? '',
        ACTIVITY_CATEGORY_META[entry.category]?.label ?? entry.category,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [baseLogs, categoryFilter, projectFilter, query, scopedProjectId]);

  const groupedLogs = useMemo(() => {
    const map = new Map<string, ActivityLogEntry[]>();
    for (const entry of filteredLogs) {
      const key = getDateGroupKey(entry.timestamp);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filteredLogs]);

  const todayCount = useMemo(() => {
    const todayKey = getDateGroupKey(new Date().toISOString());
    return baseLogs.filter((e) => getDateGroupKey(e.timestamp) === todayKey).length;
  }, [baseLogs]);

  const uniqueProjectsTouched = useMemo(() => {
    const codes = new Set<string>();
    for (const entry of baseLogs) {
      if (entry.folderCode) codes.add(entry.folderCode);
    }
    return codes.size;
  }, [baseLogs]);

  const hasActiveFilters =
    categoryFilter !== 'all' ||
    (!scopedProjectId && projectFilter !== 'all') ||
    query.trim().length > 0;

  const resetFilters = () => {
    setCategoryFilter('all');
    setProjectFilter('all');
    setQuery('');
  };

  return (
    <div
      className={
        scopedProjectId
          ? 'max-w-5xl space-y-4'
          : 'h-full overflow-y-auto bg-[#F5F5F7] px-6 py-6'
      }
    >
      <div className={scopedProjectId ? 'space-y-4' : 'max-w-6xl mx-auto space-y-5'}>
        {/* Header Bar */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1
              className={
                scopedProjectId
                  ? 'text-[16px] font-semibold text-[#1D1D1F] tracking-[-0.015em]'
                  : 'text-[22px] font-semibold text-[#1D1D1F] tracking-[-0.025em]'
              }
            >
              {scopedProjectId ? 'Folder Activity Log' : 'Activity Log'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] text-[#6E6E73]">
              <span className="font-mono tabular-nums text-[#1D1D1F] font-medium">
                {baseLogs.length} {baseLogs.length === 1 ? 'event' : 'events'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {todayCount} today
              </span>
              {!scopedProjectId && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {uniqueProjectsTouched}{' '}
                    {uniqueProjectsTouched === 1 ? 'folder' : 'folders'} touched
                  </span>
                </>
              )}
              {hasActiveFilters && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[#0071E3] font-medium">
                    Showing {filteredLogs.length}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onExportCsv(filteredLogs)}
              disabled={filteredLogs.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] bg-white hover:bg-[#F5F5F7] disabled:opacity-45 border border-black/[0.09] rounded-[9px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-[#6E6E73]" strokeWidth={1.8} />
              Export CSV
            </button>

            {!scopedProjectId && onClearLogs && (
              confirmClear ? (
                <div className="flex items-center gap-2 border border-[#D70015]/25 bg-[#D70015]/[0.06] px-3 py-1.5 rounded-[9px]">
                  <span className="text-[12px] font-medium text-[#D70015] whitespace-nowrap">
                    Clear all entries?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearLogs();
                      setConfirmClear(false);
                    }}
                    className="text-[12px] font-semibold text-[#D70015] hover:underline whitespace-nowrap"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="text-[12px] text-[#515154] hover:text-[#1D1D1F] whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  disabled={baseLogs.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#515154] hover:text-[#D70015] hover:bg-[#D70015]/[0.06] disabled:opacity-45 bg-white border border-black/[0.09] rounded-[9px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-colors whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Clear Log
                </button>
              )
            )}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                className="w-3.5 h-3.5 text-[#6E6E73] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.85}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter activity log entries"
                placeholder="Search action, folder code, asset name, or change detail..."
                className="w-full pl-8.5 pr-8 py-1.5 text-[12.5px] bg-[#F5F5F7]/80 hover:bg-[#F5F5F7] focus:bg-white border border-black/[0.08] focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 rounded-[9px] text-[#1D1D1F] placeholder:text-[#86868B] focus:outline-none transition-all"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear log search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6E6E73] hover:text-[#1D1D1F]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!scopedProjectId && (
              <select
                aria-label="Filter by project folder"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-3 py-1.5 text-[12.5px] bg-[#F5F5F7]/80 hover:bg-[#F5F5F7] focus:bg-white border border-black/[0.08] focus:border-[#0071E3] rounded-[9px] text-[#1D1D1F] focus:outline-none max-w-[240px]"
              >
                <option value="all">All Project Folders</option>
                <option value="workspace_only">Workspace-level Only</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.folderCode} · {p.title}
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[12px] font-medium text-[#0071E3] hover:text-[#0062CC] whitespace-nowrap shrink-0"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div
            role="group"
            aria-label="Filter activity log by category"
            className="flex items-center gap-1 overflow-x-auto pb-0.5"
          >
            <button
              type="button"
              aria-pressed={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-[7px] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                categoryFilter === 'all'
                  ? 'bg-[#1D1D1F] text-white'
                  : 'text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05]'
              }`}
            >
              <span>All</span>
              <span
                className={`font-mono text-[11px] tabular-nums ${
                  categoryFilter === 'all' ? 'text-white/75' : 'text-[#86868B]'
                }`}
              >
                {categoryCounts.all ?? 0}
              </span>
            </button>

            {ALL_CATEGORIES.filter((cat) =>
              scopedProjectId ? cat !== 'workspace' : true
            ).map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              const active = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 text-[12px] font-medium rounded-[7px] transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#0071E3] text-white'
                      : 'text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05]'
                  }`}
                >
                  <span>{ACTIVITY_CATEGORY_META[cat].label}</span>
                  {count > 0 && (
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        active ? 'text-white/80' : 'text-[#86868B]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity Stream Table */}
        {groupedLogs.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] px-6 py-14 text-center">
            <History
              className="w-7 h-7 text-[#AEAEB2] mx-auto mb-2.5"
              strokeWidth={1.6}
            />
            <p className="text-[14px] font-semibold text-[#1D1D1F]">
              {hasActiveFilters
                ? 'No matching activity entries'
                : 'No activity recorded yet'}
            </p>
            <p className="text-[12.5px] text-[#6E6E73] mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? 'Try broadening your search keywords or switching back to all categories.'
                : 'Actions across folders, schedule drag-and-drop, Kanban moves, media assets, milestones, and S3 storage will appear here automatically.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 px-4 py-1.5 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] rounded-[9px] transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden divide-y divide-black/[0.07]">
            {groupedLogs.map(([dateKey, entries]) => (
              <section key={dateKey} aria-label={formatDateGroupHeading(dateKey)}>
                <div className="px-4 py-2 bg-[#F5F5F7]/70 border-b border-black/[0.05] flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#1D1D1F]">
                    {formatDateGroupHeading(dateKey)}
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-[#6E6E73]">
                    {dateKey} · {entries.length}{' '}
                    {entries.length === 1 ? 'action' : 'actions'}
                  </span>
                </div>

                <div className="divide-y divide-black/[0.05]">
                  {entries.map((entry) => {
                    const catMeta = ACTIVITY_CATEGORY_META[entry.category];
                    const canOpenProject =
                      !scopedProjectId &&
                      Boolean(entry.projectId) &&
                      Boolean(onOpenFolder) &&
                      projectIdsSet.has(entry.projectId!);

                    return (
                      <div
                        key={entry.id}
                        className="px-4 py-2.5 hover:bg-[#F5F5F7]/55 transition-colors grid grid-cols-1 sm:grid-cols-12 gap-x-4 gap-y-1 items-baseline"
                      >
                        {/* Timestamp column */}
                        <div className="sm:col-span-2 flex items-baseline gap-2 shrink-0">
                          <span className="font-mono text-[12px] tabular-nums text-[#1D1D1F]">
                            {formatTimeStamp(entry.timestamp)}
                          </span>
                          <span className="text-[11px] text-[#86868B] whitespace-nowrap">
                            {formatRelativeTime(entry.timestamp)}
                          </span>
                        </div>

                        {/* Category & Action */}
                        <div className="sm:col-span-3 flex flex-wrap items-baseline gap-x-1.5 min-w-0">
                          <span
                            className={`text-[11.5px] font-semibold whitespace-nowrap ${catMeta.textClass}`}
                          >
                            {catMeta.label}
                          </span>
                          <span className="text-[#C7C7CC]" aria-hidden="true">
                            ·
                          </span>
                          <span className="text-[12.5px] font-semibold text-[#1D1D1F] truncate">
                            {entry.action}
                          </span>
                        </div>

                        {/* Summary & Detail */}
                        <div className="sm:col-span-5 min-w-0">
                          <p className="text-[12.5px] text-[#1D1D1F] leading-snug">
                            {entry.summary}
                          </p>
                          {entry.detail && (
                            <p className="mt-0.5 text-[11.5px] font-mono tabular-nums text-[#6E6E73] break-words">
                              {entry.detail}
                            </p>
                          )}
                        </div>

                        {/* Folder Reference */}
                        <div className="sm:col-span-2 sm:text-right shrink-0">
                          {entry.folderCode ? (
                            canOpenProject ? (
                              <button
                                type="button"
                                onClick={() => onOpenFolder?.(entry.projectId!)}
                                title={`Open ${entry.folderCode} — ${entry.projectTitle ?? ''}`}
                                className="inline-flex items-center gap-1 font-mono text-[11.5px] tabular-nums font-medium text-[#0071E3] hover:text-[#0062CC] hover:underline whitespace-nowrap"
                              >
                                {entry.folderCode}
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            ) : (
                              <span className="font-mono text-[11.5px] tabular-nums text-[#6E6E73]">
                                {entry.folderCode}
                              </span>
                            )
                          ) : (
                            <span className="text-[11.5px] text-[#86868B]">
                              Workspace
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
