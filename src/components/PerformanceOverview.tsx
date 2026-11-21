import { useMemo } from 'react';
import { Download, Pause, Play } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CHANNEL_MAP,
  ContentProject,
  STATUS_META,
  getLatestMetrics,
} from '../types/content';

interface PerformanceOverviewProps {
  projects: ContentProject[];
  liveStreamActive: boolean;
  onToggleLiveStream: () => void;
  onOpenFolder: (projectId: string) => void;
}

export function PerformanceOverview({
  projects,
  liveStreamActive,
  onToggleLiveStream,
  onOpenFolder,
}: PerformanceOverviewProps) {
  const summary = useMemo(() => {
    let totalViews = 0;
    let totalEngagements = 0;
    let totalCta = 0;
    let completionSum = 0;
    let measuredCount = 0;

    let internalViews = 0;
    let internalCta = 0;
    let externalViews = 0;
    let externalCta = 0;

    let slideCompletionSum = 0;
    let slideCount = 0;
    let videoCompletionSum = 0;
    let videoCount = 0;

    const channelTotals = new Map<
      string,
      { name: string; views: number; ctaClicks: number }
    >();

    for (const p of projects) {
      const m = getLatestMetrics(p);
      totalViews += m.views;
      totalEngagements += m.engagements;
      totalCta += m.ctaClicks;

      if (m.views > 0) {
        completionSum += m.completionRate;
        measuredCount += 1;
        if (p.format === 'slide') {
          slideCompletionSum += m.completionRate;
          slideCount += 1;
        } else {
          videoCompletionSum += m.completionRate;
          videoCount += 1;
        }
      }

      if (p.strategy === 'internal') {
        internalViews += m.views;
        internalCta += m.ctaClicks;
      } else {
        externalViews += m.views;
        externalCta += m.ctaClicks;
      }

      const ch = CHANNEL_MAP[p.channel];
      const existing = channelTotals.get(p.channel) ?? {
        name: ch?.shortLabel ?? p.channel,
        views: 0,
        ctaClicks: 0,
      };
      existing.views += m.views;
      existing.ctaClicks += m.ctaClicks;
      channelTotals.set(p.channel, existing);
    }

    const avgCompletion =
      measuredCount > 0 ? Math.round(completionSum / measuredCount) : 0;
    const avgCtr = totalViews > 0 ? (totalCta / totalViews) * 100 : 0;

    return {
      totalViews,
      totalEngagements,
      totalCta,
      avgCtr,
      avgCompletion,
      internalViews,
      internalCtr: internalViews > 0 ? (internalCta / internalViews) * 100 : 0,
      externalViews,
      externalCtr: externalViews > 0 ? (externalCta / externalViews) * 100 : 0,
      slideAvgCompletion:
        slideCount > 0 ? Math.round(slideCompletionSum / slideCount) : 0,
      videoAvgCompletion:
        videoCount > 0 ? Math.round(videoCompletionSum / videoCount) : 0,
      channelData: Array.from(channelTotals.values()).sort(
        (a, b) => b.views - a.views
      ),
    };
  }, [projects]);

  const rankedProjects = useMemo(() => {
    return [...projects].sort(
      (a, b) => getLatestMetrics(b).views - getLatestMetrics(a).views
    );
  }, [projects]);

  const handleExportCsv = () => {
    const header = [
      'Folder',
      'Title',
      'Strategy',
      'Format',
      'Model',
      'CTA',
      'Channel',
      'Status',
      'Views',
      'Engagements',
      'CTA Clicks',
      'CTR %',
      'Completion %',
    ];
    const rows = rankedProjects.map((p) => {
      const m = getLatestMetrics(p);
      return [
        p.folderCode,
        `"${p.title.replace(/"/g, '""')}"`,
        p.strategy,
        p.format,
        `"${p.contentModel}"`,
        `"${p.ctaLabel}"`,
        CHANNEL_MAP[p.channel]?.label ?? p.channel,
        p.status,
        m.views,
        m.engagements,
        m.ctaClicks,
        m.ctr.toFixed(2),
        m.completionRate,
      ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cadence-performance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="apple-glass-bar border-b border-black/[0.07] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-semibold text-[#1D1D1F] tracking-[-0.022em]">
            Performance Matrix
          </h2>
          <p className="text-[12.5px] text-[#6E6E73] mt-0.5">
            Real-time cross-folder telemetry comparing Internal vs. External reach, Slide vs. Video retention, and CTA conversion.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleLiveStream}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium rounded-[9px] border transition-all duration-150 active:scale-[0.98] whitespace-nowrap ${
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

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium text-[#1D1D1F] bg-white hover:bg-black/[0.03] border border-black/[0.09] rounded-[9px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)] transition-all duration-150 active:scale-[0.98] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#F5F5F7] space-y-6">
        {/* Top KPI Row */}
        <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-black/[0.07]">
          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Aggregate Reach</div>
            <div className="mt-1.5 text-[26px] font-semibold font-mono tabular-nums tracking-[-0.025em] text-[#1D1D1F]">
              {summary.totalViews.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73] font-mono tabular-nums">
              {summary.internalViews.toLocaleString()} Internal ·{' '}
              {summary.externalViews.toLocaleString()} External
            </div>
          </div>
          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Total Engagements</div>
            <div className="mt-1.5 text-[26px] font-semibold font-mono tabular-nums tracking-[-0.025em] text-[#1D1D1F]">
              {summary.totalEngagements.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73]">
              Across all published folders
            </div>
          </div>
          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Total CTA Conversions</div>
            <div className="mt-1.5 text-[26px] font-semibold font-mono tabular-nums tracking-[-0.025em] text-[#0071E3]">
              {summary.totalCta.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73] font-mono tabular-nums">
              {summary.internalCtr.toFixed(1)}% Int CTR ·{' '}
              {summary.externalCtr.toFixed(1)}% Ext CTR
            </div>
          </div>
          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Avg Completion Rate</div>
            <div className="mt-1.5 text-[26px] font-semibold font-mono tabular-nums tracking-[-0.025em] text-[#1F8A4C]">
              {summary.avgCompletion}%
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73] font-mono tabular-nums">
              {summary.slideAvgCompletion}% Slide · {summary.videoAvgCompletion}% Video
            </div>
          </div>
        </div>

        {/* Channel Distribution Chart */}
        <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
                Reach by Publishing Funnel
              </h3>
              <p className="text-[12px] text-[#6E6E73] mt-0.5">
                Combined latest views across WhatsApp Channel, IG (Short, Reel, Post), TikTok, YouTube (Long, Short), Website, and Warta
              </p>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summary.channelData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#515154' }}
                  axisLine={{ stroke: '#E5E5EA' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6E6E73', fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
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
                <Bar
                  dataKey="views"
                  name="Views"
                  fill="#0071E3"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Folder Leaderboard Table */}
        <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-black/[0.07] flex items-center justify-between">
            <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
              Folder Performance Ledger
            </h3>
            <span className="text-[11.5px] text-[#6E6E73] font-mono tabular-nums">
              Sorted by live reach
            </span>
          </div>
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="border-b border-black/[0.07] bg-[#FAFAFC] text-[11px] font-semibold text-[#6E6E73]">
                <th className="py-3 px-4 font-semibold">Folder</th>
                <th className="py-3 px-4 font-semibold">Content Project</th>
                <th className="py-3 px-4 font-semibold">Strategy · Format</th>
                <th className="py-3 px-4 font-semibold">CTA</th>
                <th className="py-3 px-4 font-semibold text-right">Views</th>
                <th className="py-3 px-4 font-semibold text-right">Engagements</th>
                <th className="py-3 px-4 font-semibold text-right">CTA Clicks</th>
                <th className="py-3 px-4 font-semibold text-right">CTR</th>
                <th className="py-3 px-4 font-semibold text-right">Completion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] text-[12.5px]">
              {rankedProjects.map((project) => {
                const m = getLatestMetrics(project);
                const statusInfo = STATUS_META[project.status];
                return (
                  <tr
                    key={project.id}
                    onClick={() => onOpenFolder(project.id)}
                    className="hover:bg-[#F5F5F7]/70 cursor-pointer transition-colors duration-150"
                  >
                    <td className="py-3.5 px-4 font-mono text-[12px] tabular-nums text-[#6E6E73]">
                      {project.folderCode}
                    </td>
                    <td className="py-3.5 px-4 max-w-[260px]">
                      <div className="font-semibold text-[#1D1D1F] truncate">
                        {project.title}
                      </div>
                      <div className="text-[11px] text-[#6E6E73] mt-0.5">
                        {CHANNEL_MAP[project.channel]?.label} ·{' '}
                        <span className={`font-medium ${statusInfo.textClass}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-[#515154]">
                      <span
                        className={
                          project.strategy === 'internal'
                            ? 'text-[#0071E3] font-semibold'
                            : 'font-semibold text-[#1D1D1F]'
                        }
                      >
                        {project.strategy === 'internal' ? 'Internal' : 'External'}
                      </span>{' '}
                      · <span className="capitalize">{project.format}</span>
                      <div className="text-[11px] text-[#6E6E73]">
                        {project.contentModel}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-[180px] truncate text-[#515154]">
                      {project.ctaLabel}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1D1D1F] font-medium">
                      {m.views.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#515154]">
                      {m.engagements.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#0071E3] font-medium">
                      {m.ctaClicks.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1D1D1F]">
                      {m.views > 0 ? `${m.ctr.toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1F8A4C] font-medium">
                      {m.views > 0 ? `${m.completionRate}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
