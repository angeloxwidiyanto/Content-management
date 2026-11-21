/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Download,
  FolderOpen,
  History,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  TrendingUp,
  X,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ActivityLogView } from './components/ActivityLogView';
import { CalendarWorkspace } from './components/CalendarWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FolderDirectory } from './components/FolderDirectory';
import { NewProjectModal } from './components/NewProjectModal';
import { PerformanceOverview } from './components/PerformanceOverview';
import { ProjectFolderView } from './components/ProjectFolderView';
import { StrategyInsightView } from './components/StrategyInsightView';
import { useWorkspaceStore } from './store/useWorkspaceStore';
import {
  CHANNEL_MAP,
  ChannelId,
  FilterState,
  WorkflowStatus,
  matchesProjectQuery,
} from './types/content';

type NavSection = 'calendar' | 'folders' | 'insights' | 'performance' | 'activity';

export default function App() {
  const store = useWorkspaceStore();
  const [activeNav, setActiveNav] = useState<NavSection>('calendar');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cadence_sidebar_collapsed_v1') === 'true';
    } catch {
      return false;
    }
  });
  const [newModalOpen, setNewModalOpen] = useState(false);

  const toggleSidebarCollapsed = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try {
      localStorage.setItem('cadence_sidebar_collapsed_v1', String(next));
    } catch {
      // Ignore storage restrictions
    }
    store.recordLog({
      category: 'workspace',
      action: next ? 'Sidebar Collapsed' : 'Sidebar Expanded',
      summary: next
        ? 'Collapsed navigation sidebar to compact icon rail'
        : 'Expanded navigation sidebar to full width',
    });
  };
  const [newModalInitialDate, setNewModalInitialDate] = useState<string | null>(
    null
  );
  const [newModalInitialStatus, setNewModalInitialStatus] =
    useState<WorkflowStatus | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    strategy: 'all',
    format: 'all',
    channel: 'all',
    status: 'all',
    tag: 'all',
    search: '',
  });
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebarCollapsed();
      } else if (!isEditable && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        !isEditable &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'n' &&
        !newModalOpen
      ) {
        e.preventDefault();
        setNewModalInitialDate(null);
        setNewModalInitialStatus(null);
        setNewModalOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [newModalOpen, sidebarCollapsed]);

  const globallySearchedProjects = useMemo(
    () =>
      store.projects.filter((p) => matchesProjectQuery(p, filters.search)),
    [store.projects, filters.search]
  );

  const handleGlobalSearchChange = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    if (selectedFolderId && value.trim().length > 0) {
      setSelectedFolderId(null);
    }
  };

  const selectedProject = useMemo(
    () =>
      selectedFolderId
        ? store.projects.find((p) => p.id === selectedFolderId) ?? null
        : null,
    [store.projects, selectedFolderId]
  );

  const workspaceTags = useMemo(() => {
    const countsMap = new Map<string, number>();
    for (const proj of store.projects) {
      for (const tag of proj.tags) {
        countsMap.set(tag, (countsMap.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(countsMap.entries())
      .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
      .map(([tag]) => tag);
  }, [store.projects]);

  const counts = useMemo(() => {
    const internal = store.projects.filter((p) => p.strategy === 'internal').length;
    const external = store.projects.filter((p) => p.strategy === 'external').length;
    const slides = store.projects.filter((p) => p.format === 'slide').length;
    const videos = store.projects.filter((p) => p.format === 'video').length;
    return {
      total: store.projects.length,
      internal,
      external,
      slides,
      videos,
    };
  }, [store.projects]);

  const handleOpenFolder = (projectId: string) => {
    const target = store.projects.find((p) => p.id === projectId);
    setSelectedFolderId(projectId);
    setMobileMenuOpen(false);
    if (target) {
      store.recordLog({
        category: 'project',
        action: 'Folder Opened',
        summary: `Opened project folder "${target.title}"`,
        projectId: target.id,
        folderCode: target.folderCode,
        projectTitle: target.title,
      });
    }
  };

  const handleNavigate = (section: NavSection) => {
    const changed = activeNav !== section || selectedFolderId !== null;
    setSelectedFolderId(null);
    setActiveNav(section);
    setMobileMenuOpen(false);
    if (changed && section !== 'activity') {
      const labels: Record<NavSection, string> = {
        calendar: 'Content Calendar',
        folders: 'Project Folders',
        insights: 'Strategy Insight',
        performance: 'Performance Matrix',
        activity: 'Activity Log',
      };
      store.recordLog({
        category: 'workspace',
        action: 'View Switched',
        summary: `Navigated to ${labels[section]}`,
      });
    }
  };

  const handleQuickStrategyFilter = (strategy: 'all' | 'internal' | 'external') => {
    if (filters.strategy !== strategy) {
      store.recordLog({
        category: 'workspace',
        action: 'Strategy Filter Changed',
        summary: `Filtered workspace to ${
          strategy === 'all'
            ? 'All Content'
            : strategy === 'internal'
            ? 'Internal Strategy'
            : 'External Strategy'
        }`,
      });
    }
    setFilters((prev) => ({ ...prev, strategy }));
    setSelectedFolderId(null);
    if (
      activeNav === 'performance' ||
      activeNav === 'insights' ||
      activeNav === 'activity'
    ) {
      setActiveNav('calendar');
    }
    setMobileMenuOpen(false);
  };

  const handleFilterChannelInFolders = (channelId: ChannelId) => {
    setFilters((prev) => ({ ...prev, channel: channelId }));
    setSelectedFolderId(null);
    setActiveNav('folders');
    store.recordLog({
      category: 'workspace',
      action: 'Channel Filter Applied',
      summary: `Filtered Project Folders to ${CHANNEL_MAP[channelId]?.label ?? channelId}`,
    });
  };

  const handleOpenNewProject = (
    initialDate: string | null = null,
    initialStatus: WorkflowStatus | null = null
  ) => {
    setNewModalInitialDate(initialDate);
    setNewModalInitialStatus(initialStatus);
    setNewModalOpen(true);
  };

  const handleCreateProject: typeof store.createProject = (draft) => {
    const created = store.createProject(draft);
    if (created && activeNav === 'folders') {
      setSelectedFolderId(created.id);
    }
    return created;
  };

  const handleDeleteProject = (projectId: string) => {
    store.deleteProject(projectId);
    if (selectedFolderId === projectId) {
      setSelectedFolderId(null);
    }
  };

  const breadcrumbTrail = useMemo(() => {
    if (selectedProject) {
      return [
        {
          label: activeNav === 'calendar' ? 'Calendar' : 'Project Folders',
          onClick: () => setSelectedFolderId(null),
        },
        { label: `${selectedProject.folderCode} · ${selectedProject.title}` },
      ];
    }
    if (activeNav === 'calendar') return [{ label: 'Content Calendar' }];
    if (activeNav === 'folders') return [{ label: 'Project Folders' }];
    if (activeNav === 'insights') return [{ label: 'Strategy Insight' }];
    if (activeNav === 'activity') return [{ label: 'Activity Log' }];
    return [{ label: 'Performance Matrix' }];
  }, [activeNav, selectedProject]);

  const renderSidebar = (collapsed: boolean) => (
    <div className="flex flex-col h-full apple-glass-sidebar border-r border-black/[0.08] overflow-hidden">
      {/* Brand Wordmark */}
      <div
        className={`h-[56px] flex items-center border-b border-black/[0.06] shrink-0 ${
          collapsed ? 'justify-center px-2' : 'justify-between px-5'
        }`}
      >
        <button
          type="button"
          onClick={() => handleNavigate('calendar')}
          title="Cadence"
          aria-label="Cadence home"
          className={`font-bold tracking-[-0.025em] text-[#1D1D1F] whitespace-nowrap shrink-0 font-[var(--font-display)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25 rounded-md ${
            collapsed
              ? 'w-9 h-9 flex items-center justify-center text-[15px] bg-white border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.05)] rounded-[9px]'
              : 'text-[16px]'
          }`}
        >
          {collapsed ? 'C' : 'Cadence'}
        </button>

        {!collapsed && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              title="Collapse sidebar (⌘\)"
              aria-label="Collapse sidebar"
              className="hidden lg:inline-flex p-1.5 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-lg transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close sidebar"
              className="lg:hidden p-1.5 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Primary Workspace Navigation (macOS Source List) */}
      <nav
        aria-label="Primary workspace navigation"
        className={`py-3.5 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`}
      >
        {(
          [
            {
              id: 'calendar' as const,
              label: 'Calendar',
              Icon: Calendar,
              isActive: activeNav === 'calendar' && !selectedProject,
              count: undefined as number | undefined,
            },
            {
              id: 'folders' as const,
              label: 'Project Folders',
              Icon: FolderOpen,
              isActive: activeNav === 'folders' || Boolean(selectedProject),
              count: counts.total,
            },
            {
              id: 'insights' as const,
              label: 'Strategy Insight',
              Icon: TrendingUp,
              isActive: activeNav === 'insights' && !selectedProject,
              count: undefined as number | undefined,
            },
            {
              id: 'performance' as const,
              label: 'Performance',
              Icon: BarChart3,
              isActive: activeNav === 'performance' && !selectedProject,
              count: undefined as number | undefined,
            },
            {
              id: 'activity' as const,
              label: 'Activity Log',
              Icon: History,
              isActive: activeNav === 'activity' && !selectedProject,
              count: store.activityLogs.length,
            },
          ] as const
        ).map(({ id, label, Icon, isActive, count }) => (
          <button
            key={id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            aria-label={collapsed ? label : undefined}
            title={collapsed ? label : undefined}
            onClick={() => handleNavigate(id)}
            className={`w-full flex items-center text-[13px] rounded-[9px] transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25 ${
              collapsed
                ? 'justify-center h-10 px-0'
                : 'justify-between px-3 py-2'
            } ${
              isActive
                ? 'bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]'
                : 'text-[#515154] font-medium hover:text-[#1D1D1F] hover:bg-black/[0.04]'
            }`}
          >
            <span className="flex items-center gap-2.5 whitespace-nowrap">
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-[#0071E3]' : 'text-[#6E6E73]'
                }`}
                strokeWidth={1.75}
              />
              {!collapsed && label}
            </span>
            {!collapsed && count !== undefined && (
              <span className="text-[11px] font-mono tabular-nums text-[#6E6E73]">
                {count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Strategy Tracks */}
      <div
        className={`py-3 border-t border-black/[0.06] ${
          collapsed ? 'px-2' : 'px-3'
        }`}
      >
        {!collapsed && (
          <div className="px-3 pb-1.5 text-[11px] font-semibold text-[#6E6E73] tracking-[-0.005em]">
            Strategy Tracks
          </div>
        )}
        <div className="space-y-1">
          {(
            [
              { key: 'all', label: 'All Content', short: 'All', count: counts.total },
              {
                key: 'internal',
                label: 'Internal Strategy',
                short: 'Int',
                count: counts.internal,
              },
              {
                key: 'external',
                label: 'External Strategy',
                short: 'Ext',
                count: counts.external,
              },
            ] as const
          ).map((item) => {
            const active = filters.strategy === item.key && !selectedProject;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active}
                title={collapsed ? `${item.label} (${item.count})` : undefined}
                onClick={() => handleQuickStrategyFilter(item.key)}
                className={`w-full flex items-center text-[12px] rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25 ${
                  collapsed
                    ? 'justify-center py-1.5 px-0 text-[11px] font-mono'
                    : 'justify-between px-3 py-1.5'
                } ${
                  active
                    ? 'text-[#0071E3] bg-[#0071E3]/[0.09] font-semibold'
                    : 'text-[#515154] font-medium hover:text-[#1D1D1F] hover:bg-black/[0.04]'
                }`}
              >
                <span>{collapsed ? item.short : item.label}</span>
                {!collapsed && (
                  <span className="font-mono text-[11px] tabular-nums opacity-80">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent / Matching Folders Quick Jump */}
      {!collapsed ? (
        <div className="px-3 py-3 border-t border-black/[0.06] flex-1 overflow-y-auto">
          <div className="px-3 pb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#6E6E73] tracking-[-0.005em]">
            <span>
              {filters.search.trim() ? 'Matching Folders' : 'Active Folders'}
            </span>
            {filters.search.trim() && (
              <span className="font-mono text-[11px] tabular-nums text-[#0071E3]">
                {globallySearchedProjects.length}
              </span>
            )}
          </div>
          <div className="space-y-0.5">
            {globallySearchedProjects.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#6E6E73]">
                No matching folders
              </div>
            ) : (
              globallySearchedProjects.slice(0, 7).map((proj) => {
                const isCurrent = selectedFolderId === proj.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleOpenFolder(proj.id)}
                    className={`w-full text-left px-3 py-1.5 rounded-[8px] transition-all duration-150 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/25 ${
                      isCurrent
                        ? 'bg-white text-[#1D1D1F] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.05)]'
                        : 'text-[#515154] hover:bg-black/[0.04] hover:text-[#1D1D1F]'
                    }`}
                  >
                    <span className="font-mono text-[11px] tabular-nums text-[#6E6E73] shrink-0">
                      {proj.folderCode}
                    </span>
                    <span className="text-[12px] truncate">{proj.title}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Workspace Data Utilities */}
      <div
        className={`border-t border-black/[0.06] ${
          collapsed ? 'p-2 space-y-1.5' : 'p-3 space-y-1.5'
        }`}
      >
        {!collapsed && (
          <div className="px-2.5 py-0.5 flex items-center justify-between text-[11px] text-[#6E6E73] font-mono tabular-nums">
            <span>
              {counts.slides} Slide · {counts.videos} Video
            </span>
          </div>
        )}
        <div
          className={
            collapsed
              ? 'flex flex-col items-center gap-1.5'
              : 'flex items-center gap-1.5'
          }
        >
          <button
            type="button"
            onClick={store.exportWorkspaceJson}
            title="Backup workspace JSON"
            aria-label="Backup workspace JSON"
            className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium text-[#515154] hover:text-[#1D1D1F] bg-white/80 hover:bg-white border border-black/[0.08] rounded-[8px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-all duration-150 active:scale-[0.98] whitespace-nowrap ${
              collapsed ? 'w-10 h-8 p-0' : 'flex-1 px-2.5 py-1.5'
            }`}
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            {!collapsed && 'Backup'}
          </button>
          <button
            type="button"
            onClick={store.resetDemoWorkspace}
            title="Restore starter project folders"
            aria-label="Restore starter project folders"
            className={`inline-flex items-center justify-center gap-1 text-xs font-medium text-[#515154] hover:text-[#1D1D1F] bg-white/80 hover:bg-white border border-black/[0.08] rounded-[8px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-all duration-150 active:scale-[0.98] whitespace-nowrap ${
              collapsed ? 'w-10 h-8 p-0' : 'px-2.5 py-1.5'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
            {!collapsed && 'Reset'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <div className="h-screen w-screen overflow-hidden flex bg-[#F5F5F7] text-[#1D1D1F]">
          {/* Desktop Collapsible Source-List Sidebar */}
          <aside
            className={`hidden lg:block shrink-0 h-full transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              sidebarCollapsed ? 'w-[68px]' : 'w-[252px]'
            }`}
          >
            {renderSidebar(sidebarCollapsed)}
          </aside>

          {/* Mobile Drawer Sidebar (always expanded) */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <div className="fixed inset-0 z-40 lg:hidden flex">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="fixed inset-0 bg-black/25 backdrop-blur-xs"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <motion.div
                  initial={{ x: -268 }}
                  animate={{ x: 0 }}
                  exit={{ x: -268 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  className="relative z-10 w-[268px] h-full shadow-2xl"
                >
                  {renderSidebar(false)}
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Main Viewport */}
          <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
            {/* Translucent Liquid Glass Top Bar */}
            <header className="h-[56px] apple-glass-bar border-b border-black/[0.07] px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-6 shrink-0 z-20">
              <div className="flex items-center gap-2.5 min-w-0 shrink">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation menu"
                  className="lg:hidden p-2 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-lg transition-colors"
                >
                  <Menu className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleSidebarCollapsed}
                  aria-expanded={!sidebarCollapsed}
                  aria-label={
                    sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                  }
                  title={
                    sidebarCollapsed
                      ? 'Expand sidebar (⌘\\)'
                      : 'Collapse sidebar (⌘\\)'
                  }
                  className="hidden lg:inline-flex p-1.5 text-[#515154] hover:text-[#1D1D1F] hover:bg-black/[0.05] rounded-[8px] transition-colors active:scale-95 shrink-0"
                >
                  {sidebarCollapsed ? (
                    <PanelLeftOpen className="w-4 h-4" strokeWidth={1.8} />
                  ) : (
                    <PanelLeftClose className="w-4 h-4" strokeWidth={1.8} />
                  )}
                </button>

                <nav
                  aria-label="Breadcrumb"
                  className="flex items-center gap-1.5 text-[13px] min-w-0"
                >
                  <span className="text-[#6E6E73] hidden xl:inline whitespace-nowrap">
                    Workspace
                  </span>
                  <ChevronRight
                    className="w-3.5 h-3.5 text-[#AEAEB2] hidden xl:inline shrink-0"
                    aria-hidden="true"
                  />
                  {breadcrumbTrail.map((item, idx) => (
                    <span
                      key={item.label}
                      className="flex items-center gap-1.5 min-w-0"
                    >
                      {idx > 0 && (
                        <ChevronRight
                          className="w-3.5 h-3.5 text-[#AEAEB2] shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      {item.onClick ? (
                        <button
                          type="button"
                          onClick={item.onClick}
                          className="text-[#6E6E73] hover:text-[#1D1D1F] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:underline"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <span className="font-semibold text-[#1D1D1F] tracking-[-0.01em] truncate">
                          {item.label}
                        </span>
                      )}
                    </span>
                  ))}
                </nav>
              </div>

              {/* Apple Spotlight-Inspired Global Project Search Bar */}
              <div className="flex-1 max-w-md min-w-[160px]">
                <div className="relative flex items-center">
                  <Search
                    className="w-3.5 h-3.5 text-[#6E6E73] absolute left-3 pointer-events-none"
                    strokeWidth={1.85}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    role="searchbox"
                    aria-label="Global project search by title, folder code, or tag"
                    value={filters.search}
                    onChange={(e) => handleGlobalSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        handleGlobalSearchChange('');
                        searchInputRef.current?.blur();
                      }
                    }}
                    placeholder="Search title, folder code, or #tag..."
                    className="w-full pl-8.5 pr-20 py-1.5 text-[13px] bg-black/[0.045] hover:bg-black/[0.065] focus:bg-white border border-transparent focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/18 rounded-[10px] text-[#1D1D1F] placeholder:text-[#6E6E73] transition-all duration-150 focus:outline-none"
                  />
                  {filters.search.trim() ? (
                    <div className="absolute right-2 flex items-center gap-1.5">
                      <span className="font-mono text-[11px] tabular-nums text-[#0071E3] font-medium">
                        {globallySearchedProjects.length}/{store.projects.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleGlobalSearchChange('')}
                        aria-label="Clear search"
                        className="p-0.5 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.06] rounded-md transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 absolute right-2 text-[10px] font-mono text-[#6E6E73] bg-white/80 border border-black/[0.08] rounded-[5px] pointer-events-none">
                      ⌘K
                    </kbd>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenNewProject(null)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062CC] active:scale-[0.98] rounded-[10px] shadow-[0_1px_2px_rgba(0,113,227,0.28)] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#0071E3]/30"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
                  New Project
                </button>
              </div>
            </header>

            {/* Main Active View */}
            <main className="flex-1 min-h-0 overflow-hidden">
              {selectedProject ? (
                <ProjectFolderView
                  project={selectedProject}
                  liveStreamActive={store.liveStreamActive}
                  onToggleLiveStream={store.toggleLiveStream}
                  onBack={() => setSelectedFolderId(null)}
                  onUpdateProject={store.updateProject}
                  onDeleteProject={handleDeleteProject}
                  onToggleMilestone={store.toggleMilestone}
                  onAddMilestone={store.addMilestone}
                  onRemoveMilestone={store.removeMilestone}
                  onAddAsset={store.addAsset}
                  onUpdateAsset={store.updateAsset}
                  onUpdateAssetStatus={store.updateAssetStatus}
                  onRemoveAsset={store.removeAsset}
                  onReorderAssets={store.reorderAssets}
                  onLogSnapshot={store.logPerformanceSnapshot}
                  activityLogs={store.activityLogs}
                  onLogActivity={store.recordLog}
                  onExportActivityCsv={store.exportActivityLogsCsv}
                  existingTags={workspaceTags}
                />
              ) : activeNav === 'calendar' ? (
                <CalendarWorkspace
                  projects={store.projects}
                  filters={filters}
                  onChangeFilters={setFilters}
                  onOpenFolder={handleOpenFolder}
                  onReschedule={store.rescheduleProject}
                  onOpenNewProject={handleOpenNewProject}
                />
              ) : activeNav === 'folders' ? (
                <FolderDirectory
                  projects={store.projects}
                  filters={filters}
                  onChangeFilters={setFilters}
                  onOpenFolder={handleOpenFolder}
                  onMoveStatus={store.moveProjectStatus}
                  onOpenNewProject={(stage) =>
                    handleOpenNewProject(null, stage ?? null)
                  }
                />
              ) : activeNav === 'insights' ? (
                <StrategyInsightView
                  projects={globallySearchedProjects}
                  liveStreamActive={store.liveStreamActive}
                  onToggleLiveStream={store.toggleLiveStream}
                  onOpenFolder={handleOpenFolder}
                  onFilterChannelInFolders={handleFilterChannelInFolders}
                />
              ) : activeNav === 'activity' ? (
                <ActivityLogView
                  logs={store.activityLogs}
                  projects={store.projects}
                  onOpenFolder={handleOpenFolder}
                  onExportCsv={store.exportActivityLogsCsv}
                  onClearLogs={store.clearActivityLogs}
                />
              ) : (
                <PerformanceOverview
                  projects={globallySearchedProjects}
                  liveStreamActive={store.liveStreamActive}
                  onToggleLiveStream={store.toggleLiveStream}
                  onOpenFolder={handleOpenFolder}
                />
              )}
            </main>
          </div>

          {/* New Project Folder Modal */}
          <NewProjectModal
            open={newModalOpen}
            initialDate={newModalInitialDate}
            initialStatus={newModalInitialStatus}
            existingTags={workspaceTags}
            onClose={() => setNewModalOpen(false)}
            onCreate={handleCreateProject}
          />

          {/* Floating Liquid-Glass Action Toast with Undo */}
          <AnimatePresence>
            {store.toast && (
              <motion.div
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="fixed bottom-5 right-5 z-50 apple-glass-toast text-white text-[12px] px-4 py-2.5 rounded-[12px] flex items-center gap-3 max-w-md"
              >
                <span className="truncate font-medium">{store.toast.message}</span>
                {store.toast.onUndo && store.toast.undoLabel && (
                  <button
                    type="button"
                    onClick={store.toast.onUndo}
                    className="font-semibold text-[#64B5F6] hover:text-white transition-colors whitespace-nowrap shrink-0"
                  >
                    {store.toast.undoLabel}
                  </button>
                )}
                <button
                  type="button"
                  onClick={store.dismissToast}
                  aria-label="Dismiss notification"
                  className="text-white/60 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ErrorBoundary>
    </MotionConfig>
  );
}
