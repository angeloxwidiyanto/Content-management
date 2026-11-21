import React, { useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Inbox,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CHANNELS,
  CHANNEL_MAP,
  ChannelId,
  ContentFormat,
  ContentProject,
  FUNNEL_GROUPS,
  FilterState,
  STATUS_META,
  StrategyType,
  matchesProjectQuery,
} from '../types/content';
import { applyOnionDragGhost } from '../utils/onionSkinDrag';

interface CalendarWorkspaceProps {
  projects: ContentProject[];
  filters: FilterState;
  onChangeFilters: (next: FilterState) => void;
  onOpenFolder: (projectId: string) => void;
  onReschedule: (projectId: string, newDate: string | null) => void;
  onOpenNewProject: (initialDate: string | null) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildMonthCells(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = getMonday(firstOfMonth);
  const cells: Date[] = [];
  for (let i = 0; i < 35; i++) {
    const cell = new Date(gridStart);
    cell.setDate(gridStart.getDate() + i);
    cells.push(cell);
  }
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  if (cells[cells.length - 1] < lastOfMonth) {
    for (let i = 35; i < 42; i++) {
      const cell = new Date(gridStart);
      cell.setDate(gridStart.getDate() + i);
      cells.push(cell);
    }
  }
  return cells;
}

function buildWeekCells(anchor: Date): Date[] {
  const monday = getMonday(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const cell = new Date(monday);
    cell.setDate(monday.getDate() + i);
    return cell;
  });
}

export function CalendarWorkspace({
  projects,
  filters,
  onChangeFilters,
  onOpenFolder,
  onReschedule,
  onOpenNewProject,
}: CalendarWorkspaceProps) {
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [showBacklog, setShowBacklog] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const draggingProject = useMemo(
    () => (draggingId ? projects.find((p) => p.id === draggingId) ?? null : null),
    [projects, draggingId]
  );

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const availableTags = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      for (const t of p.tags) {
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filters.strategy !== 'all' && p.strategy !== filters.strategy) return false;
      if (filters.format !== 'all' && p.format !== filters.format) return false;
      if (filters.channel !== 'all' && p.channel !== filters.channel) return false;
      if (filters.status !== 'all' && p.status !== filters.status) return false;
      if (filters.tag !== 'all' && !p.tags.includes(filters.tag)) return false;
      if (!matchesProjectQuery(p, filters.search)) return false;
      return true;
    });
  }, [projects, filters]);

  const scheduledByDate = useMemo(() => {
    const map = new Map<string, ContentProject[]>();
    for (const p of filteredProjects) {
      if (!p.scheduledDate) continue;
      const existing = map.get(p.scheduledDate) ?? [];
      existing.push(p);
      map.set(p.scheduledDate, existing);
    }
    map.forEach((list) =>
      list.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    );
    return map;
  }, [filteredProjects]);

  const backlogProjects = useMemo(
    () => filteredProjects.filter((p) => !p.scheduledDate),
    [filteredProjects]
  );

  const cells = useMemo(
    () => (viewMode === 'month' ? buildMonthCells(anchorDate) : buildWeekCells(anchorDate)),
    [viewMode, anchorDate]
  );

  const periodHeading = useMemo(() => {
    if (viewMode === 'month') {
      return anchorDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
    }
    const start = cells[0];
    const end = cells[6];
    const startStr = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endStr = end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startStr} – ${endStr}`;
  }, [viewMode, anchorDate, cells]);

  const shiftPeriod = (direction: -1 | 1) => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(prev.getMonth() + direction);
      } else {
        next.setDate(prev.getDate() + direction * 7);
      }
      return next;
    });
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLElement>,
    projectId: string
  ) => {
    setDraggingId(projectId);
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
    applyOnionDragGhost(e, e.currentTarget);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverTarget(null);
  };

  const handleDropOnDate = (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverTarget(null);
    if (droppedId) {
      onReschedule(droppedId, dateKey);
    }
  };

  const handleDropOnBacklog = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverTarget(null);
    if (droppedId) {
      onReschedule(droppedId, null);
    }
  };

  const hasActiveFilters =
    filters.strategy !== 'all' ||
    filters.format !== 'all' ||
    filters.channel !== 'all' ||
    filters.status !== 'all' ||
    filters.tag !== 'all' ||
    filters.search.trim() !== '';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* macOS-Inspired Calendar Filter & Period Toolbar */}
      <div className="apple-glass-bar border-b border-black/[0.07] px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date navigation */}
          <div className="inline-flex items-center bg-white border border-black/[0.08] rounded-[9px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] p-0.5">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              aria-label="Previous period"
              className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.04] rounded-[7px] transition-colors active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.85} />
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(new Date())}
              className="px-2.5 py-1 text-[12px] font-medium text-[#1D1D1F] hover:bg-black/[0.04] rounded-[7px] transition-colors whitespace-nowrap shrink-0"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              aria-label="Next period"
              className="p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.04] rounded-[7px] transition-colors active:scale-95"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.85} />
            </button>
          </div>

          <h2 className="text-[17px] font-semibold text-[#1D1D1F] tracking-[-0.02em] min-w-[172px]">
            {periodHeading}
          </h2>

          {/* Strategy segmented control */}
          <div
            className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]"
            role="group"
            aria-label="Filter by strategy"
          >
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'internal', label: 'Internal' },
                { value: 'external', label: 'External' },
              ] as { value: 'all' | StrategyType; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={filters.strategy === opt.value}
                onClick={() =>
                  onChangeFilters({ ...filters, strategy: opt.value })
                }
                className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                  filters.strategy === opt.value
                    ? 'apple-segment-active'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Format segmented control */}
          <div
            className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]"
            role="group"
            aria-label="Filter by format"
          >
            {(
              [
                { value: 'all', label: 'All Formats' },
                { value: 'slide', label: 'Slide' },
                { value: 'video', label: 'Video' },
              ] as { value: 'all' | ContentFormat; label: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={filters.format === opt.value}
                onClick={() =>
                  onChangeFilters({ ...filters, format: opt.value })
                }
                className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                  filters.format === opt.value
                    ? 'apple-segment-active'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Funnel dropdown */}
          <select
            aria-label="Filter by funnel"
            value={filters.channel}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                channel: e.target.value as 'all' | ChannelId,
              })
            }
            className="px-3 py-1.5 text-[12px] font-medium text-[#1D1D1F] bg-white border border-black/[0.09] rounded-[9px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
          >
            <option value="all">All Funnels</option>
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

          {availableTags.length > 0 && (
            <select
              aria-label="Filter calendar by tag"
              value={filters.tag}
              onChange={(e) =>
                onChangeFilters({
                  ...filters,
                  tag: e.target.value,
                })
              }
              className="px-3 py-1.5 text-[12px] font-medium font-mono text-[#1D1D1F] bg-white border border-black/[0.09] rounded-[9px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 transition-all"
            >
              <option value="all">All Tags</option>
              {availableTags.map(([tag, count]) => (
                <option key={tag} value={tag}>
                  #{tag} ({count})
                </option>
              ))}
            </select>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() =>
                onChangeFilters({
                  strategy: 'all',
                  format: 'all',
                  channel: 'all',
                  status: 'all',
                  tag: 'all',
                  search: '',
                })
              }
              className="text-[12px] font-medium text-[#0071E3] hover:text-[#0062CC] transition-colors whitespace-nowrap shrink-0"
            >
              Reset
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Month / Week view switcher */}
          <div className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]">
            <button
              type="button"
              aria-pressed={viewMode === 'month'}
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                viewMode === 'month'
                  ? 'apple-segment-active'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'week'}
              onClick={() => setViewMode('week')}
              className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                viewMode === 'week'
                  ? 'apple-segment-active'
                  : 'text-[#6E6E73] hover:text-[#1D1D1F]'
              }`}
            >
              Week
            </button>
          </div>

          <button
            type="button"
            aria-pressed={showBacklog}
            onClick={() => setShowBacklog((s) => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border rounded-[9px] transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 ${
              showBacklog
                ? 'bg-[#1D1D1F] text-white border-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.12)]'
                : 'bg-white text-[#1D1D1F] border-black/[0.09] hover:bg-black/[0.03] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" strokeWidth={1.8} />
            <span>Backlog</span>
            <span className="font-mono tabular-nums opacity-75">
              {backlogProjects.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Calendar + Collapsible Backlog Rail */}
      <div className="flex-1 min-h-0 flex flex-col xl:flex-row overflow-hidden">
        {/* Calendar Grid Area */}
        <div className="flex-1 min-w-0 flex flex-col overflow-auto bg-[#F5F5F7] p-4 sm:p-6">
          <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden flex-1 flex flex-col min-w-[720px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b border-black/[0.07] bg-[#FAFAFC]">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="px-3.5 py-2.5 text-[11px] font-semibold text-[#6E6E73] border-r last:border-r-0 border-black/[0.06]"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div
              className={`grid grid-cols-7 flex-1 ${
                viewMode === 'month' ? 'auto-rows-fr' : ''
              }`}
            >
              {cells.map((cellDate, idx) => {
                const dateKey = toDateKey(cellDate);
                const isToday = dateKey === todayKey;
                const isCurrentMonth =
                  viewMode === 'week' ||
                  cellDate.getMonth() === anchorDate.getMonth();
                const dayItems = scheduledByDate.get(dateKey) ?? [];
                const isDropTarget = dragOverTarget === dateKey;

                return (
                  <div
                    key={dateKey}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverTarget !== dateKey) {
                        setDragOverTarget(dateKey);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (
                        e.currentTarget.contains(e.relatedTarget as Node | null)
                      ) {
                        return;
                      }
                      if (dragOverTarget === dateKey) {
                        setDragOverTarget(null);
                      }
                    }}
                    onDrop={(e) => handleDropOnDate(e, dateKey)}
                    className={`group border-r border-b border-black/[0.06] p-2.5 flex flex-col transition-colors duration-150 ${
                      (idx + 1) % 7 === 0 ? 'border-r-0' : ''
                    } ${
                      viewMode === 'week' ? 'min-h-[420px]' : 'min-h-[130px]'
                    } ${
                      isDropTarget
                        ? 'bg-[#0071E3]/[0.05] ring-[1.5px] ring-inset ring-[#0071E3]/70'
                        : isCurrentMonth
                        ? 'bg-white'
                        : 'bg-[#FAFAFC]'
                    }`}
                  >
                    {/* Date header row */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[12px] font-mono tabular-nums inline-flex items-center justify-center ${
                          isToday
                            ? viewMode === 'week'
                              ? 'px-2 py-0.5 bg-[#0071E3] text-white rounded-full font-semibold'
                              : 'w-6 h-6 bg-[#0071E3] text-white rounded-full font-semibold'
                            : isCurrentMonth
                            ? 'text-[#1D1D1F] font-medium px-1'
                            : 'text-[#86868B] px-1'
                        }`}
                      >
                        {cellDate.getDate()}
                        {viewMode === 'week' && (
                          <span className="ml-1 font-sans text-[11px] font-normal opacity-85">
                            {cellDate.toLocaleDateString('en-US', {
                              month: 'short',
                            })}
                          </span>
                        )}
                      </span>

                      <button
                        type="button"
                        onClick={() => onOpenNewProject(dateKey)}
                        title={`Schedule project on ${dateKey}`}
                        aria-label={`Schedule project on ${dateKey}`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-[#6E6E73] hover:text-[#0071E3] hover:bg-black/[0.05] rounded-[7px] transition-all duration-150"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>

                    {/* Content project cards */}
                    <div className="space-y-1.5 flex-1">
                      {dayItems.map((project) => {
                        const channel = CHANNEL_MAP[project.channel];
                        const statusMeta = STATUS_META[project.status];
                        const isDragging = draggingId === project.id;

                        return (
                          <div
                            key={project.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, project.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => onOpenFolder(project.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onOpenFolder(project.id);
                              }
                            }}
                            className={`w-full text-left bg-[#F5F5F7]/75 hover:bg-white border border-black/[0.07] hover:border-black/[0.14] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] rounded-[10px] p-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25 ${
                              isDragging ? 'onion-skin-origin' : ''
                            }`}
                          >
                            {/* Clean unboxed metadata line */}
                            <div className="flex items-center justify-between gap-1 text-[11px] leading-none mb-1.5">
                              <div className="flex items-center gap-1 min-w-0 truncate">
                                <span
                                  className={`font-semibold ${
                                    project.strategy === 'internal'
                                      ? 'text-[#0071E3]'
                                      : 'text-[#1D1D1F]'
                                  }`}
                                >
                                  {project.strategy === 'internal'
                                    ? 'Internal'
                                    : 'External'}
                                </span>
                                <span className="text-[#AEAEB2]" aria-hidden="true">
                                  ·
                                </span>
                                <span className="text-[#515154] capitalize">
                                  {project.format}
                                </span>
                                <span className="text-[#AEAEB2]" aria-hidden="true">
                                  ·
                                </span>
                                <span className="text-[#6E6E73] truncate">
                                  {channel?.shortLabel}
                                </span>
                              </div>
                              <GripVertical
                                className="w-3 h-3 text-[#AEAEB2] shrink-0"
                                aria-hidden="true"
                              />
                            </div>

                            {/* Project title */}
                            <div className="text-[12px] font-medium text-[#1D1D1F] leading-snug line-clamp-2">
                              {project.title}
                            </div>

                            {/* Extended details in Week View */}
                            {viewMode === 'week' ? (
                              <div className="mt-2 pt-1.5 border-t border-black/[0.06] space-y-1 text-[11px] text-[#6E6E73]">
                                <div className="truncate">
                                  Model:{' '}
                                  <span className="text-[#1D1D1F]">
                                    {project.contentModel}
                                  </span>
                                </div>
                                <div className="truncate">
                                  CTA:{' '}
                                  <span className="text-[#1D1D1F]">
                                    {project.ctaLabel}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between pt-0.5 font-mono tabular-nums">
                                  <span>{project.folderCode}</span>
                                  <span className={`font-medium ${statusMeta.textClass}`}>
                                    {statusMeta.label}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1.5 flex items-center justify-between gap-1 text-[10px] text-[#6E6E73]">
                                <span className="truncate">
                                  {project.contentModel}
                                </span>
                                <span
                                  className={`shrink-0 font-medium ${statusMeta.textClass}`}
                                >
                                  {statusMeta.label}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Onion-Skin Destination Preview inside Calendar Cell */}
                      {isDropTarget &&
                        draggingProject &&
                        draggingProject.scheduledDate !== dateKey && (
                          <div
                            aria-hidden="true"
                            className="onion-skin-target rounded-[10px] p-2.5 select-none"
                          >
                            <div className="flex items-center justify-between gap-1 text-[10.5px] leading-none mb-1.5 opacity-85">
                              <span className="font-semibold text-[#0071E3] truncate">
                                {draggingProject.strategy === 'internal'
                                  ? 'Internal'
                                  : 'External'}{' '}
                                · {draggingProject.format}
                              </span>
                              <span className="font-mono text-[10px] text-[#0071E3] shrink-0">
                                → {dateKey.slice(5)}
                              </span>
                            </div>
                            <div className="text-[12px] font-medium text-[#1D1D1F]/75 leading-snug line-clamp-2">
                              {draggingProject.title}
                            </div>
                            <div className="mt-1 text-[10px] text-[#515154]/80 truncate">
                              {CHANNEL_MAP[draggingProject.channel]?.shortLabel}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-3 px-1 text-[12px] text-[#6E6E73] flex items-center justify-between">
            <span>
              Drag any content card across dates or from the backlog to reschedule. Click a card to open its project folder.
            </span>
            <span className="font-mono tabular-nums text-[11px]">
              {filteredProjects.length} projects visible
            </span>
          </p>
        </div>

        {/* Unscheduled Backlog Rail */}
        {showBacklog && (
          <aside
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverTarget !== 'backlog') {
                setDragOverTarget('backlog');
              }
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
                return;
              }
              if (dragOverTarget === 'backlog') {
                setDragOverTarget(null);
              }
            }}
            onDrop={handleDropOnBacklog}
            className={`w-full xl:w-[300px] shrink-0 border-t xl:border-t-0 xl:border-l border-black/[0.07] bg-white/90 flex flex-col transition-colors duration-150 ${
              dragOverTarget === 'backlog'
                ? 'bg-[#0071E3]/[0.05] ring-[1.5px] ring-inset ring-[#0071E3]/70'
                : ''
            }`}
          >
            <div className="px-4 py-3.5 border-b border-black/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-[#1D1D1F]">
                  Unscheduled Backlog
                </h3>
                <p className="text-[11px] text-[#6E6E73] mt-0.5">
                  Drag onto calendar dates to schedule
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenNewProject(null)}
                aria-label="Add unscheduled project"
                className="p-1.5 text-[#515154] hover:text-[#0071E3] hover:bg-black/[0.05] rounded-[8px] transition-colors active:scale-95"
              >
                <Plus className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
              {/* Onion-Skin Destination Preview inside Backlog Rail */}
              {dragOverTarget === 'backlog' &&
                draggingProject &&
                draggingProject.scheduledDate !== null && (
                  <div
                    aria-hidden="true"
                    className="onion-skin-target rounded-xl p-3 select-none"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5 opacity-85">
                      <span className="font-mono text-[#0071E3] font-semibold">
                        {draggingProject.folderCode}
                      </span>
                      <span className="text-[10.5px] font-semibold text-[#0071E3]">
                        → Unscheduled Backlog
                      </span>
                    </div>
                    <div className="text-[12.5px] font-medium text-[#1D1D1F]/75 leading-snug line-clamp-2">
                      {draggingProject.title}
                    </div>
                  </div>
                )}

              {backlogProjects.length === 0 &&
              !(
                dragOverTarget === 'backlog' &&
                draggingProject &&
                draggingProject.scheduledDate !== null
              ) ? (
                <div className="border border-dashed border-black/[0.14] rounded-xl p-6 text-center bg-[#FAFAFC]">
                  <SlidersHorizontal className="w-4 h-4 text-[#86868B] mx-auto mb-2" />
                  <p className="text-[12px] font-semibold text-[#1D1D1F]">
                    Backlog is clear
                  </p>
                  <p className="text-[11px] text-[#6E6E73] mt-1 leading-relaxed">
                    Drop a scheduled card here to unassign its date, or create a new draft folder.
                  </p>
                </div>
              ) : (
                backlogProjects.map((project) => {
                  const channel = CHANNEL_MAP[project.channel];
                  return (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, project.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onOpenFolder(project.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onOpenFolder(project.id);
                        }
                      }}
                      className={`bg-[#F5F5F7]/75 hover:bg-white border border-black/[0.07] hover:border-black/[0.14] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25 ${
                        draggingId === project.id ? 'onion-skin-origin' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-[#6E6E73] tabular-nums">
                            {project.folderCode}
                          </span>
                          <span className="text-[#AEAEB2]">·</span>
                          <span
                            className={`font-semibold ${
                              project.strategy === 'internal'
                                ? 'text-[#0071E3]'
                                : 'text-[#1D1D1F]'
                            }`}
                          >
                            {project.strategy === 'internal'
                              ? 'Internal'
                              : 'External'}
                          </span>
                          <span className="text-[#AEAEB2]">·</span>
                          <span className="text-[#515154] capitalize">
                            {project.format}
                          </span>
                        </div>
                        <GripVertical className="w-3.5 h-3.5 text-[#AEAEB2] shrink-0" />
                      </div>

                      <div className="text-[12.5px] font-medium text-[#1D1D1F] leading-snug">
                        {project.title}
                      </div>

                      <div className="mt-2 pt-2 border-t border-black/[0.06] text-[11px] text-[#6E6E73] space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">{project.contentModel}</span>
                          <span className="shrink-0 text-[#1D1D1F] font-medium">
                            {channel?.shortLabel}
                          </span>
                        </div>
                        <div className="truncate">
                          CTA:{' '}
                          <span className="text-[#1D1D1F]">{project.ctaLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
