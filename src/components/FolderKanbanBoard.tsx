import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
} from 'lucide-react';
import {
  CHANNEL_MAP,
  ContentProject,
  STATUS_META,
  WorkflowStatus,
  getLatestMetrics,
} from '../types/content';
import { applyOnionDragGhost } from '../utils/onionSkinDrag';

export interface KanbanColumnDef {
  id: string;
  label: string;
  description: string;
  statuses: WorkflowStatus[];
  defaultDropStatus: WorkflowStatus;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'planning',
    label: 'Planning',
    description: 'Backlog & Scripting',
    statuses: ['backlog', 'scripting'],
    defaultDropStatus: 'scripting',
  },
  {
    id: 'production',
    label: 'Production',
    description: 'Design & Video Cut',
    statuses: ['production'],
    defaultDropStatus: 'production',
  },
  {
    id: 'review',
    label: 'Review',
    description: 'Stakeholder Sign-Off',
    statuses: ['review'],
    defaultDropStatus: 'review',
  },
  {
    id: 'scheduled',
    label: 'Scheduled',
    description: 'Queued on Calendar',
    statuses: ['scheduled'],
    defaultDropStatus: 'scheduled',
  },
  {
    id: 'published',
    label: 'Published',
    description: 'Live Telemetry',
    statuses: ['published'],
    defaultDropStatus: 'published',
  },
];

interface FolderKanbanBoardProps {
  projects: ContentProject[];
  onOpenFolder: (projectId: string) => void;
  onMoveStatus: (
    projectId: string,
    nextStatus: WorkflowStatus,
    stageLabel?: string
  ) => void;
  onCreateInStage: (initialStatus: WorkflowStatus) => void;
}

export function FolderKanbanBoard({
  projects,
  onOpenFolder,
  onMoveStatus,
  onCreateInStage,
}: FolderKanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const resolveDropStatus = (
    column: KanbanColumnDef,
    project: ContentProject | undefined
  ): WorkflowStatus => {
    if (column.id === 'planning') {
      if (project && !project.scheduledDate) return 'backlog';
      return 'scripting';
    }
    return column.defaultDropStatus;
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
    setDragOverColumnId(null);
  };

  const handleDropOnColumn = (e: React.DragEvent, column: KanbanColumnDef) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingId;
    setDraggingId(null);
    setDragOverColumnId(null);

    if (!droppedId) return;
    const project = projects.find((p) => p.id === droppedId);
    if (!project) return;
    if (column.statuses.includes(project.status)) return;

    const targetStatus = resolveDropStatus(column, project);
    onMoveStatus(droppedId, targetStatus, column.label);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-x-auto pb-2">
        <div className="flex gap-4 h-full min-h-[500px] min-w-[1260px]">
          {KANBAN_COLUMNS.map((column, colIdx) => {
            const columnProjects = projects.filter((p) =>
              column.statuses.includes(p.status)
            );
            const draggingProject = draggingId
              ? projects.find((p) => p.id === draggingId)
              : undefined;
            const isDifferentColumn =
              draggingProject !== undefined &&
              !column.statuses.includes(draggingProject.status);
            const isDropTarget =
              dragOverColumnId === column.id && isDifferentColumn;

            return (
              <section
                key={column.id}
                aria-label={`${column.label} column`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverColumnId !== column.id) {
                    setDragOverColumnId(column.id);
                  }
                }}
                onDragLeave={(e) => {
                  // Only clear when actually leaving the column element
                  if (
                    e.currentTarget.contains(e.relatedTarget as Node | null)
                  ) {
                    return;
                  }
                  if (dragOverColumnId === column.id) {
                    setDragOverColumnId(null);
                  }
                }}
                onDrop={(e) => handleDropOnColumn(e, column)}
                className={`flex-1 min-w-[244px] flex flex-col rounded-2xl border transition-all duration-150 ${
                  isDropTarget
                    ? 'bg-[#0071E3]/[0.05] border-[#0071E3]/45 ring-[1.5px] ring-inset ring-[#0071E3]/40'
                    : 'bg-black/[0.025] border-black/[0.06]'
                }`}
              >
                {/* Column Header */}
                <div className="px-3.5 py-3 border-b border-black/[0.06] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-[#1D1D1F] tracking-[-0.01em] truncate">
                        {column.label}
                      </h3>
                      <span className="font-mono text-[11px] tabular-nums text-[#6E6E73]">
                        {columnProjects.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6E6E73] truncate mt-0.5">
                      {column.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onCreateInStage(column.defaultDropStatus)}
                    title={`Create project in ${column.label}`}
                    aria-label={`Create project in ${column.label}`}
                    className="p-1.5 text-[#6E6E73] hover:text-[#0071E3] hover:bg-white rounded-[8px] transition-all active:scale-95 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>

                {/* Column Cards Body */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {columnProjects.length === 0 && !isDropTarget ? (
                    <div className="border border-dashed border-black/[0.1] bg-white/40 rounded-xl py-8 px-3 text-center transition-colors">
                      <p className="text-[12px] font-medium text-[#515154]">
                        No folders in {column.label}
                      </p>
                      <p className="text-[11px] text-[#6E6E73] mt-0.5">
                        Drag a project card here to update its stage.
                      </p>
                    </div>
                  ) : (
                    columnProjects.map((project) => {
                      const channel = CHANNEL_MAP[project.channel];
                      const statusMeta = STATUS_META[project.status];
                      const doneCount = project.milestones.filter(
                        (m) => m.completed
                      ).length;
                      const totalMs = project.milestones.length;
                      const latest = getLatestMetrics(project);
                      const isDragging = draggingId === project.id;

                      const prevCol = colIdx > 0 ? KANBAN_COLUMNS[colIdx - 1] : null;
                      const nextCol =
                        colIdx < KANBAN_COLUMNS.length - 1
                          ? KANBAN_COLUMNS[colIdx + 1]
                          : null;

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
                          className={`group bg-white border border-black/[0.08] hover:border-black/[0.15] hover:shadow-[0_6px_18px_-6px_rgba(0,0,0,0.09)] rounded-xl p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-grab active:cursor-grabbing transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25 ${
                            isDragging ? 'onion-skin-origin' : ''
                          }`}
                        >
                          {/* Top unboxed metadata row */}
                          <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <span className="font-mono tabular-nums text-[#6E6E73] shrink-0">
                                {project.folderCode}
                              </span>
                              <span className="text-[#C7C7CC]" aria-hidden="true">
                                ·
                              </span>
                              <span
                                className={`font-semibold shrink-0 ${
                                  project.strategy === 'internal'
                                    ? 'text-[#0071E3]'
                                    : 'text-[#1D1D1F]'
                                }`}
                              >
                                {project.strategy === 'internal'
                                  ? 'Internal'
                                  : 'External'}
                              </span>
                              <span className="text-[#C7C7CC]" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-[#515154] capitalize truncate">
                                {project.format}
                              </span>
                            </div>
                            <GripVertical
                              className="w-3.5 h-3.5 text-[#AEAEB2] shrink-0"
                              aria-hidden="true"
                            />
                          </div>

                          {/* Project title */}
                          <div className="text-[13px] font-semibold text-[#1D1D1F] leading-snug line-clamp-2">
                            {project.title}
                          </div>

                          {/* Channel, model & CTA summary */}
                          <div className="mt-2 space-y-1 text-[11.5px] text-[#6E6E73]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate">{project.contentModel}</span>
                              <span className="text-[#1D1D1F] font-medium shrink-0">
                                {channel?.shortLabel}
                              </span>
                            </div>
                            <div className="truncate">
                              CTA:{' '}
                              <span className="text-[#1D1D1F]">
                                {project.ctaLabel}
                              </span>
                            </div>
                            {project.tags && project.tags.length > 0 && (
                              <div className="font-mono text-[10.5px] text-[#6E6E73] truncate pt-0.5">
                                {project.tags
                                  .slice(0, 3)
                                  .map((t) => `#${t}`)
                                  .join('  ')}
                              </div>
                            )}
                          </div>

                          {/* Footer: timeline progress, date/views & keyboard stage arrows */}
                          <div className="mt-3 pt-2.5 border-t border-black/[0.06] flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 font-mono tabular-nums text-[#6E6E73] min-w-0 truncate">
                              {column.id === 'planning' && (
                                <>
                                  <span
                                    className={`font-sans font-medium ${statusMeta.textClass}`}
                                  >
                                    {statusMeta.label}
                                  </span>
                                  <span className="text-[#C7C7CC]" aria-hidden="true">
                                    ·
                                  </span>
                                </>
                              )}
                              <span>
                                {doneCount}/{totalMs} tasks
                              </span>
                              <span className="text-[#C7C7CC]" aria-hidden="true">
                                ·
                              </span>
                              <span className="truncate">
                                {latest.views > 0
                                  ? `${latest.views.toLocaleString()} views`
                                  : project.scheduledDate
                                  ? project.scheduledDate.slice(5)
                                  : 'No date'}
                              </span>
                            </div>

                            {/* Accessible stage quick-move arrows */}
                            <div
                              className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {prevCol && (
                                <button
                                  type="button"
                                  title={`Move to ${prevCol.label}`}
                                  aria-label={`Move "${project.title}" to ${prevCol.label}`}
                                  onClick={() =>
                                    onMoveStatus(
                                      project.id,
                                      resolveDropStatus(prevCol, project),
                                      prevCol.label
                                    )
                                  }
                                  className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-[6px] transition-colors"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {nextCol && (
                                <button
                                  type="button"
                                  title={`Move to ${nextCol.label}`}
                                  aria-label={`Move "${project.title}" to ${nextCol.label}`}
                                  onClick={() =>
                                    onMoveStatus(
                                      project.id,
                                      resolveDropStatus(nextCol, project),
                                      nextCol.label
                                    )
                                  }
                                  className="p-1 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-[6px] transition-colors"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {isDropTarget && draggingProject && (
                    <div
                      aria-hidden="true"
                      className="onion-skin-target rounded-xl p-3.5 select-none"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] mb-1.5 opacity-80">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="font-mono tabular-nums text-[#0071E3] font-semibold shrink-0">
                            {draggingProject.folderCode}
                          </span>
                          <span className="text-[#0071E3]/40">·</span>
                          <span className="text-[#1D1D1F] font-medium shrink-0">
                            {draggingProject.strategy === 'internal'
                              ? 'Internal'
                              : 'External'}
                          </span>
                          <span className="text-[#0071E3]/40">·</span>
                          <span className="text-[#515154] capitalize truncate">
                            {draggingProject.format}
                          </span>
                        </div>
                        <span className="text-[10.5px] font-semibold text-[#0071E3] shrink-0">
                          → {column.label}
                        </span>
                      </div>

                      <div className="text-[13px] font-semibold text-[#1D1D1F]/75 leading-snug line-clamp-2">
                        {draggingProject.title}
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#515154]/80">
                        <span className="truncate">
                          {draggingProject.contentModel}
                        </span>
                        <span className="font-medium shrink-0">
                          {CHANNEL_MAP[draggingProject.channel]?.shortLabel}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <p className="mt-2.5 px-1 text-[12px] text-[#6E6E73] flex items-center justify-between shrink-0">
        <span>
          Drag any project folder card between status columns to update its production stage. Click a card to open its folder.
        </span>
        <span className="font-mono tabular-nums text-[11px]">
          {projects.length} folders on board
        </span>
      </p>
    </div>
  );
}
