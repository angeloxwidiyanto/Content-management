import { useMemo, useState } from 'react';
import { Columns3, Folder, LayoutGrid, List, Plus } from 'lucide-react';
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
  WorkflowStatus,
  getLatestMetrics,
  matchesProjectQuery,
} from '../types/content';
import { FolderKanbanBoard } from './FolderKanbanBoard';
import { MediaThumbnail } from './MediaThumbnail';

interface FolderDirectoryProps {
  projects: ContentProject[];
  filters: FilterState;
  onChangeFilters: (next: FilterState) => void;
  onOpenFolder: (projectId: string) => void;
  onMoveStatus: (
    projectId: string,
    nextStatus: WorkflowStatus,
    stageLabel?: string
  ) => void;
  onOpenNewProject: (initialStatus?: WorkflowStatus) => void;
}

export function FolderDirectory({
  projects,
  filters,
  onChangeFilters,
  onOpenFolder,
  onMoveStatus,
  onOpenNewProject,
}: FolderDirectoryProps) {
  const [layout, setLayout] = useState<'table' | 'board' | 'grid'>('board');

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

  const filtered = useMemo(() => {
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

  const counts = useMemo(() => {
    const internalCount = projects.filter((p) => p.strategy === 'internal').length;
    const externalCount = projects.filter((p) => p.strategy === 'external').length;
    const slideCount = projects.filter((p) => p.format === 'slide').length;
    const videoCount = projects.filter((p) => p.format === 'video').length;
    return { internalCount, externalCount, slideCount, videoCount };
  }, [projects]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Directory Header & Filter Bar */}
      <div className="apple-glass-bar border-b border-black/[0.07] px-6 py-4 space-y-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold text-[#1D1D1F] tracking-[-0.022em]">
              Project Folders
            </h2>
            <p className="text-[12.5px] text-[#6E6E73] mt-0.5">
              Every content piece maintains its own folder with metadata, production timeline, media assets, and live performance metrics.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-[#515154] font-mono tabular-nums">
            <span>{counts.internalCount} Internal</span>
            <span className="text-[#C7C7CC]" aria-hidden="true">
              /
            </span>
            <span>{counts.externalCount} External</span>
            <span className="text-[#C7C7CC]" aria-hidden="true">
              ·
            </span>
            <span>{counts.slideCount} Slide</span>
            <span className="text-[#C7C7CC]" aria-hidden="true">
              /
            </span>
            <span>{counts.videoCount} Video</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Strategy Segmented Control */}
            <div className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]">
              {(
                [
                  { value: 'all', label: 'All Strategies' },
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

            {/* Format Segmented Control */}
            <div className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]">
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

            <select
              aria-label="Filter folders by funnel"
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
                aria-label="Filter folders by tag"
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
          </div>

          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]"
              role="group"
              aria-label="Folder directory layout"
            >
              <button
                type="button"
                aria-pressed={layout === 'board'}
                onClick={() => setLayout('board')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                  layout === 'board'
                    ? 'apple-segment-active'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                <Columns3 className="w-3.5 h-3.5" />
                Board
              </button>
              <button
                type="button"
                aria-pressed={layout === 'table'}
                onClick={() => setLayout('table')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                  layout === 'table'
                    ? 'apple-segment-active'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                type="button"
                aria-pressed={layout === 'grid'}
                onClick={() => setLayout('grid')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                  layout === 'grid'
                    ? 'apple-segment-active'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Grid
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`flex-1 min-h-0 p-6 bg-[#F5F5F7] ${
          layout === 'board' ? 'flex flex-col overflow-hidden' : 'overflow-auto'
        }`}
      >
        {filtered.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] py-16 px-6 text-center max-w-lg mx-auto mt-6">
            <Folder className="w-6 h-6 text-[#86868B] mx-auto mb-3" strokeWidth={1.6} />
            <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
              No matching project folders
            </h3>
            <p className="text-[12.5px] text-[#6E6E73] mt-1 leading-relaxed">
              Adjust your strategy, format, or search query, or create a new project folder for your next content piece.
            </p>
            <button
              type="button"
              onClick={() => onOpenNewProject()}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.98] rounded-[10px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
              New Project Folder
            </button>
          </div>
        ) : layout === 'board' ? (
          <FolderKanbanBoard
            projects={filtered}
            onOpenFolder={onOpenFolder}
            onMoveStatus={onMoveStatus}
            onCreateInStage={(stage) => onOpenNewProject(stage)}
          />
        ) : layout === 'table' ? (
          <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="border-b border-black/[0.07] bg-[#FAFAFC] text-[11px] font-semibold text-[#6E6E73]">
                  <th className="py-3 px-4 font-semibold">Folder</th>
                  <th className="py-3 px-4 font-semibold">Project & Strategy</th>
                  <th className="py-3 px-4 font-semibold">Format & Model</th>
                  <th className="py-3 px-4 font-semibold">Primary CTA</th>
                  <th className="py-3 px-4 font-semibold">Channel & Date</th>
                  <th className="py-3 px-4 font-semibold text-right">Timeline</th>
                  <th className="py-3 px-4 font-semibold text-right">Assets</th>
                  <th className="py-3 px-4 font-semibold text-right">Live Views</th>
                  <th className="py-3 px-4 font-semibold text-right">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-[12.5px]">
                {filtered.map((project) => {
                  const channel = CHANNEL_MAP[project.channel];
                  const statusMeta = STATUS_META[project.status];
                  const doneCount = project.milestones.filter((m) => m.completed).length;
                  const totalMs = project.milestones.length;
                  const latest = getLatestMetrics(project);

                  return (
                    <tr
                      key={project.id}
                      onClick={() => onOpenFolder(project.id)}
                      className="hover:bg-[#F5F5F7]/70 cursor-pointer transition-colors duration-150"
                    >
                      <td className="py-3.5 px-4 font-mono text-[12px] text-[#515154] tabular-nums whitespace-nowrap">
                        {project.folderCode}
                      </td>
                      <td className="py-3.5 px-4 max-w-[280px]">
                        <div className="font-semibold text-[#1D1D1F] truncate">
                          {project.title}
                        </div>
                        <div className="text-[11px] text-[#6E6E73] mt-0.5 flex items-center gap-1.5">
                          <span
                            className={
                              project.strategy === 'internal'
                                ? 'text-[#0071E3] font-semibold'
                                : 'text-[#1D1D1F] font-medium'
                            }
                          >
                            {project.strategy === 'internal' ? 'Internal' : 'External'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-medium ${statusMeta.textClass}`}>
                            {statusMeta.label}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{project.assigneeName}</span>
                        </div>
                        {project.tags && project.tags.length > 0 && (
                          <div className="text-[11px] font-mono text-[#6E6E73] mt-0.5 truncate">
                            {project.tags.map((t) => `#${t}`).join('  ')}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-[#1D1D1F] font-medium capitalize">
                          {project.format === 'slide' ? 'Slide / Deck' : 'Video'}
                        </div>
                        <div className="text-[11px] text-[#6E6E73] mt-0.5">
                          {project.contentModel}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-[190px]">
                        <div className="text-[#1D1D1F] truncate">
                          {project.ctaLabel}
                        </div>
                        {project.ctaDestination && (
                          <div className="text-[11px] text-[#6E6E73] truncate mt-0.5">
                            {project.ctaDestination}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-[#1D1D1F]">{channel?.label}</div>
                        <div className="text-[11px] font-mono tabular-nums text-[#6E6E73] mt-0.5">
                          {project.scheduledDate
                            ? `${project.scheduledDate} · ${project.scheduledTime}`
                            : 'Unscheduled'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#515154] whitespace-nowrap">
                        {doneCount}/{totalMs}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#515154] whitespace-nowrap">
                        {project.assets.length}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1D1D1F] font-medium whitespace-nowrap">
                        {latest.views > 0 ? latest.views.toLocaleString() : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#515154] whitespace-nowrap">
                        {latest.views > 0 ? `${latest.ctr.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((project) => {
              const channel = CHANNEL_MAP[project.channel];
              const statusMeta = STATUS_META[project.status];
              const doneCount = project.milestones.filter((m) => m.completed).length;
              const latest = getLatestMetrics(project);
              const coverAsset = project.assets.find((a) => a.previewUrl) ?? project.assets[0];

              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onOpenFolder(project.id)}
                  className="group text-left bg-white border border-black/[0.08] hover:border-black/[0.14] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.08)] rounded-2xl overflow-hidden flex flex-col transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25"
                >
                  <MediaThumbnail
                    src={coverAsset?.previewUrl}
                    alt={project.title}
                    assetType={
                      coverAsset?.assetType ??
                      (project.format === 'video' ? 'video_cut' : 'slide_deck')
                    }
                    className="w-full h-44"
                  />
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
                      <span className="font-mono tabular-nums text-[#6E6E73]">
                        {project.folderCode} ·{' '}
                        <span
                          className={
                            project.strategy === 'internal'
                              ? 'text-[#0071E3] font-semibold'
                              : 'text-[#1D1D1F] font-semibold'
                          }
                        >
                          {project.strategy === 'internal' ? 'Internal' : 'External'}
                        </span>{' '}
                        · {project.format === 'slide' ? 'Slide' : 'Video'}
                      </span>
                      <span className={`font-medium ${statusMeta.textClass}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <h3 className="text-[14.5px] font-semibold text-[#1D1D1F] leading-snug tracking-[-0.01em]">
                      {project.title}
                    </h3>

                    <p className="text-[12.5px] text-[#515154] mt-1.5 line-clamp-2 leading-relaxed">
                      {project.summary}
                    </p>

                    {project.tags.length > 0 && (
                      <div className="mt-2 font-mono text-[11px] text-[#6E6E73] truncate">
                        {project.tags.map((t) => `#${t}`).join('  ')}
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-black/[0.06] grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px] text-[#6E6E73]">
                      <div className="truncate">
                        Model: <span className="text-[#1D1D1F] font-medium">{project.contentModel}</span>
                      </div>
                      <div className="truncate text-right text-[#1D1D1F] font-medium">
                        {channel?.shortLabel}
                      </div>
                      <div className="truncate col-span-2">
                        CTA: <span className="text-[#1D1D1F]">{project.ctaLabel}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-black/[0.06] flex items-center justify-between text-[11px] font-mono tabular-nums text-[#6E6E73]">
                      <span>
                        {doneCount}/{project.milestones.length} tasks · {project.assets.length} files
                      </span>
                      <span className="text-[#1D1D1F] font-medium">
                        {latest.views > 0 ? `${latest.views.toLocaleString()} views` : 'Pre-launch'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
