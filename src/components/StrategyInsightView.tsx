import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  ArrowUpRight,
  Pause,
  Play,
  TrendingUp,
} from 'lucide-react';
import {
  ChannelId,
  ContentFormat,
  ContentProject,
  StrategyType,
  getLatestMetrics,
} from '../types/content';

export type InsightChannelKey =
  | 'whatsapp'
  | 'ig'
  | 'tiktok'
  | 'youtube'
  | 'website';

type GrowthMetricKey = 'engagements' | 'views' | 'ctaClicks' | 'engagementRate';

interface InsightChannelDef {
  key: InsightChannelKey;
  label: string;
  sublabel: string;
  color: string;
  channelIds: ChannelId[];
}

const INSIGHT_CHANNELS: InsightChannelDef[] = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    sublabel: 'WhatsApp Channel',
    color: '#1F8A4C',
    channelIds: ['whatsapp_channel'],
  },
  {
    key: 'ig',
    label: 'IG',
    sublabel: 'Short · Reel · Post',
    color: '#0071E3',
    channelIds: ['ig_short', 'ig_reel', 'ig_post'],
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    sublabel: 'Short-Form Video',
    color: '#1D1D1F',
    channelIds: ['tiktok'],
  },
  {
    key: 'youtube',
    label: 'YouTube',
    sublabel: 'Long · Short',
    color: '#D70015',
    channelIds: ['youtube_long', 'youtube_short'],
  },
  {
    key: 'website',
    label: 'Website',
    sublabel: 'Web Landing & Hub',
    color: '#B25E09',
    channelIds: ['website'],
  },
];

const CHANNEL_TO_INSIGHT_KEY: Partial<Record<ChannelId, InsightChannelKey>> = {
  whatsapp_channel: 'whatsapp',
  ig_short: 'ig',
  ig_reel: 'ig',
  ig_post: 'ig',
  tiktok: 'tiktok',
  youtube_long: 'youtube',
  youtube_short: 'youtube',
  website: 'website',
};

interface StagePoint {
  stageIndex: number;
  stageLabel: string;
  values: Record<
    InsightChannelKey,
    {
      views: number;
      engagements: number;
      ctaClicks: number;
      engagementRate: number;
    }
  >;
}

interface ChannelAggregate {
  def: InsightChannelDef;
  projectCount: number;
  publishedCount: number;
  internalCount: number;
  externalCount: number;
  slideCount: number;
  videoCount: number;
  views: number;
  engagements: number;
  ctaClicks: number;
  engagementRate: number;
  ctaRate: number;
  avgCompletion: number;
  growthPct: number;
  topProject: ContentProject | null;
}

interface StrategyInsightViewProps {
  projects: ContentProject[];
  liveStreamActive: boolean;
  onToggleLiveStream: () => void;
  onOpenFolder: (projectId: string) => void;
  onFilterChannelInFolders: (channelId: ChannelId) => void;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return String(Math.round(val));
}

export function StrategyInsightView({
  projects,
  liveStreamActive,
  onToggleLiveStream,
  onOpenFolder,
  onFilterChannelInFolders,
}: StrategyInsightViewProps) {
  const [strategyFilter, setStrategyFilter] = useState<'all' | StrategyType>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | ContentFormat>('all');
  const [metricKey, setMetricKey] = useState<GrowthMetricKey>('engagements');
  const [visibleChannels, setVisibleChannels] = useState<Record<InsightChannelKey, boolean>>({
    whatsapp: true,
    ig: true,
    tiktok: true,
    youtube: true,
    website: true,
  });
  const [hoveredStageIdx, setHoveredStageIdx] = useState<number | null>(null);
  const [highlightedChannel, setHighlightedChannel] = useState<InsightChannelKey | null>(null);

  const growthContainerRef = useRef<HTMLDivElement | null>(null);
  const growthSvgRef = useRef<SVGSVGElement | null>(null);
  const growthWidth = useContainerWidth(growthContainerRef);

  const efficiencyContainerRef = useRef<HTMLDivElement | null>(null);
  const efficiencySvgRef = useRef<SVGSVGElement | null>(null);
  const efficiencyWidth = useContainerWidth(efficiencyContainerRef);

  const digitalProjects = useMemo(() => {
    return projects.filter((p) => {
      if (!CHANNEL_TO_INSIGHT_KEY[p.channel]) return false;
      if (strategyFilter !== 'all' && p.strategy !== strategyFilter) return false;
      if (formatFilter !== 'all' && p.format !== formatFilter) return false;
      return true;
    });
  }, [projects, strategyFilter, formatFilter]);

  const channelAggregates: ChannelAggregate[] = useMemo(() => {
    return INSIGHT_CHANNELS.map((def) => {
      const matched = digitalProjects.filter((p) =>
        def.channelIds.includes(p.channel)
      );
      let views = 0;
      let engagements = 0;
      let ctaClicks = 0;
      let completionSum = 0;
      let measuredCount = 0;
      let firstEngagements = 0;
      let latestEngagements = 0;
      let topProject: ContentProject | null = null;
      let topEng = -1;

      for (const p of matched) {
        const latest = getLatestMetrics(p);
        views += latest.views;
        engagements += latest.engagements;
        ctaClicks += latest.ctaClicks;

        if (latest.views > 0) {
          completionSum += latest.completionRate;
          measuredCount += 1;
        }
        if (p.metrics.length > 0) {
          firstEngagements += p.metrics[0].engagements;
          latestEngagements += p.metrics[p.metrics.length - 1].engagements;
        }
        if (latest.engagements > topEng) {
          topEng = latest.engagements;
          topProject = p;
        }
      }

      const engagementRate = views > 0 ? (engagements / views) * 100 : 0;
      const ctaRate = views > 0 ? (ctaClicks / views) * 100 : 0;
      const avgCompletion =
        measuredCount > 0 ? Math.round(completionSum / measuredCount) : 0;
      const growthPct =
        firstEngagements > 0
          ? Math.round(((latestEngagements - firstEngagements) / firstEngagements) * 100)
          : 0;

      return {
        def,
        projectCount: matched.length,
        publishedCount: matched.filter((p) => p.status === 'published').length,
        internalCount: matched.filter((p) => p.strategy === 'internal').length,
        externalCount: matched.filter((p) => p.strategy === 'external').length,
        slideCount: matched.filter((p) => p.format === 'slide').length,
        videoCount: matched.filter((p) => p.format === 'video').length,
        views,
        engagements,
        ctaClicks,
        engagementRate,
        ctaRate,
        avgCompletion,
        growthPct,
        topProject,
      };
    });
  }, [digitalProjects]);

  const growthSeries: StagePoint[] = useMemo(() => {
    let maxSteps = 0;
    for (const p of digitalProjects) {
      if (p.metrics.length > maxSteps) maxSteps = p.metrics.length;
    }
    const stepCount = Math.max(maxSteps, 4);

    const points: StagePoint[] = [];
    for (let i = 0; i < stepCount; i++) {
      const stageValues = {} as StagePoint['values'];
      let chosenLabel = `T+${i + 1}`;

      for (const def of INSIGHT_CHANNELS) {
        const matched = digitalProjects.filter((p) =>
          def.channelIds.includes(p.channel)
        );
        let views = 0;
        let engagements = 0;
        let ctaClicks = 0;

        for (const p of matched) {
          if (p.metrics.length === 0) continue;
          const idx =
            p.metrics.length === 1
              ? 0
              : Math.min(
                  p.metrics.length - 1,
                  Math.round((i / Math.max(1, stepCount - 1)) * (p.metrics.length - 1))
                );
          const snap = p.metrics[idx];
          if (snap) {
            views += snap.views;
            engagements += snap.engagements;
            ctaClicks += snap.ctaClicks;
            if (def.key === 'ig' || chosenLabel.startsWith('T+')) {
              chosenLabel = snap.label;
            }
          }
        }

        stageValues[def.key] = {
          views,
          engagements,
          ctaClicks,
          engagementRate: views > 0 ? Number(((engagements / views) * 100).toFixed(2)) : 0,
        };
      }

      points.push({
        stageIndex: i,
        stageLabel:
          i === 0
            ? 'Launch'
            : i === stepCount - 1
            ? 'Latest'
            : chosenLabel || `Stage ${i + 1}`,
        values: stageValues,
      });
    }

    return points;
  }, [digitalProjects]);

  const activeChannels = useMemo(
    () => INSIGHT_CHANNELS.filter((c) => visibleChannels[c.key]),
    [visibleChannels]
  );

  const totals = useMemo(() => {
    const views = channelAggregates.reduce((s, c) => s + c.views, 0);
    const engagements = channelAggregates.reduce((s, c) => s + c.engagements, 0);
    const ctaClicks = channelAggregates.reduce((s, c) => s + c.ctaClicks, 0);
    const engRate = views > 0 ? (engagements / views) * 100 : 0;
    const ctaRate = views > 0 ? (ctaClicks / views) * 100 : 0;

    const firstEng = growthSeries[0]
      ? INSIGHT_CHANNELS.reduce((s, c) => s + growthSeries[0].values[c.key].engagements, 0)
      : 0;
    const latestEng = growthSeries[growthSeries.length - 1]
      ? INSIGHT_CHANNELS.reduce(
          (s, c) => s + growthSeries[growthSeries.length - 1].values[c.key].engagements,
          0
        )
      : 0;
    const netGrowthPct =
      firstEng > 0 ? Math.round(((latestEng - firstEng) / firstEng) * 100) : 0;

    const leader = [...channelAggregates].sort(
      (a, b) => b.engagements - a.engagements
    )[0];

    return {
      views,
      engagements,
      ctaClicks,
      engRate,
      ctaRate,
      netGrowthPct,
      leader,
    };
  }, [channelAggregates, growthSeries]);

  const toggleChannel = (key: InsightChannelKey) => {
    setVisibleChannels((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount === 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  // D3 Chart 1: Multi-Series Audience Engagement Growth Area/Line Chart
  useEffect(() => {
    const svgEl = growthSvgRef.current;
    if (!svgEl || growthWidth <= 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const height = 292;
    const margin = { top: 18, right: 20, bottom: 32, left: 54 };
    const innerW = Math.max(120, growthWidth - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('width', growthWidth).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scalePoint<number>()
      .domain(growthSeries.map((d) => d.stageIndex))
      .range([0, innerW])
      .padding(0.08);

    const maxYVal =
      d3.max(growthSeries, (pt) =>
        d3.max(activeChannels, (ch) => pt.values[ch.key][metricKey]) ?? 0
      ) ?? 0;

    const y = d3
      .scaleLinear()
      .domain([0, maxYVal > 0 ? maxYVal * 1.15 : 100])
      .nice(5)
      .range([innerH, 0]);

    const yTicks = y.ticks(5);
    g.append('g')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', '#E5E5EA')
      .attr('stroke-dasharray', '3 3');

    const yAxis = d3
      .axisLeft(y)
      .ticks(5)
      .tickSize(0)
      .tickPadding(10)
      .tickFormat((d) => {
        const num = Number(d);
        return metricKey === 'engagementRate' ? `${num}%` : formatCompact(num);
      });

    g.append('g')
      .call(yAxis)
      .call((axis) => axis.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#6E6E73')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace');

    const xAxis = d3
      .axisBottom(x)
      .tickSize(0)
      .tickPadding(12)
      .tickFormat((idx) => growthSeries[Number(idx)]?.stageLabel ?? '');

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((axis) => axis.select('.domain').attr('stroke', '#E5E5EA'))
      .selectAll('text')
      .attr('fill', '#6E6E73')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace');

    const defs = svg.append('defs');
    activeChannels.forEach((ch) => {
      const grad = defs
        .append('linearGradient')
        .attr('id', `grad-${ch.key}`)
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '0%')
        .attr('y2', '100%');
      grad
        .append('stop')
        .attr('offset', '0%')
        .attr('stop-color', ch.color)
        .attr('stop-opacity', highlightedChannel === ch.key ? 0.16 : 0.08);
      grad
        .append('stop')
        .attr('offset', '100%')
        .attr('stop-color', ch.color)
        .attr('stop-opacity', 0);
    });

    activeChannels.forEach((ch) => {
      const isDimmed =
        highlightedChannel !== null && highlightedChannel !== ch.key;

      const areaGen = d3
        .area<StagePoint>()
        .x((d) => x(d.stageIndex) ?? 0)
        .y0(innerH)
        .y1((d) => y(d.values[ch.key][metricKey]))
        .curve(d3.curveMonotoneX);

      const lineGen = d3
        .line<StagePoint>()
        .x((d) => x(d.stageIndex) ?? 0)
        .y((d) => y(d.values[ch.key][metricKey]))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(growthSeries)
        .attr('fill', `url(#grad-${ch.key})`)
        .attr('opacity', isDimmed ? 0.16 : 1)
        .attr('d', areaGen);

      g.append('path')
        .datum(growthSeries)
        .attr('fill', 'none')
        .attr('stroke', ch.color)
        .attr('stroke-width', highlightedChannel === ch.key ? 2.5 : 1.9)
        .attr('opacity', isDimmed ? 0.2 : 1)
        .attr('d', lineGen);

      g.selectAll(`circle.pt-${ch.key}`)
        .data(growthSeries)
        .join('circle')
        .attr('class', `pt-${ch.key}`)
        .attr('cx', (d) => x(d.stageIndex) ?? 0)
        .attr('cy', (d) => y(d.values[ch.key][metricKey]))
        .attr('r', (d) => (hoveredStageIdx === d.stageIndex ? 4.5 : 2.75))
        .attr('fill', '#FFFFFF')
        .attr('stroke', ch.color)
        .attr('stroke-width', 1.8)
        .attr('opacity', isDimmed ? 0.2 : 1);
    });

    if (hoveredStageIdx !== null) {
      const xPos = x(hoveredStageIdx) ?? 0;
      g.append('line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#86868B')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2 2');
    }

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        let closestIdx = 0;
        let closestDist = Infinity;
        for (const pt of growthSeries) {
          const px = x(pt.stageIndex) ?? 0;
          const dist = Math.abs(mx - px);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = pt.stageIndex;
          }
        }
        setHoveredStageIdx(closestIdx);
      })
      .on('mouseleave', () => {
        setHoveredStageIdx(null);
      });
  }, [
    growthSeries,
    activeChannels,
    metricKey,
    growthWidth,
    hoveredStageIdx,
    highlightedChannel,
  ]);

  // D3 Chart 2: Channel Engagement Rate & CTA Conversion Horizontal Comparison
  useEffect(() => {
    const svgEl = efficiencySvgRef.current;
    if (!svgEl || efficiencyWidth <= 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const height = 250;
    const margin = { top: 14, right: 56, bottom: 26, left: 82 };
    const innerW = Math.max(120, efficiencyWidth - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    svg.attr('width', efficiencyWidth).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const yBand = d3
      .scaleBand<string>()
      .domain(channelAggregates.map((d) => d.def.label))
      .range([0, innerH])
      .padding(0.32);

    const maxRate = Math.max(
      25,
      d3.max(channelAggregates, (d) =>
        Math.max(d.engagementRate, d.ctaRate)
      ) ?? 25
    );

    const xScale = d3
      .scaleLinear()
      .domain([0, Math.ceil(maxRate / 5) * 5])
      .range([0, innerW]);

    g.append('g')
      .selectAll('line')
      .data(xScale.ticks(4))
      .join('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#E5E5EA')
      .attr('stroke-dasharray', '3 3');

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .ticks(4)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((d) => `${d}%`)
      )
      .call((axis) => axis.select('.domain').attr('stroke', '#E5E5EA'))
      .selectAll('text')
      .attr('fill', '#6E6E73')
      .attr('font-size', '11px')
      .attr('font-family', 'JetBrains Mono, monospace');

    g.append('g')
      .call(d3.axisLeft(yBand).tickSize(0).tickPadding(10))
      .call((axis) => axis.select('.domain').remove())
      .selectAll('text')
      .attr('fill', '#1D1D1F')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('font-family', 'DM Sans, sans-serif');

    const barH = Math.max(7, yBand.bandwidth() / 2 - 2);

    channelAggregates.forEach((agg) => {
      const yTop = yBand(agg.def.label) ?? 0;
      const isDimmed =
        highlightedChannel !== null && highlightedChannel !== agg.def.key;

      const rowGroup = g
        .append('g')
        .attr('opacity', isDimmed ? 0.25 : 1)
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHighlightedChannel(agg.def.key))
        .on('mouseleave', () => setHighlightedChannel(null));

      rowGroup
        .append('rect')
        .attr('x', 0)
        .attr('y', yTop)
        .attr('width', innerW)
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', '#F0F0F3');

      rowGroup
        .append('rect')
        .attr('x', 0)
        .attr('y', yTop)
        .attr('width', Math.max(agg.engagementRate > 0 ? 3 : 0, xScale(agg.engagementRate)))
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', agg.def.color);

      rowGroup
        .append('text')
        .attr('x', innerW + 8)
        .attr('y', yTop + barH - 1)
        .attr('fill', '#1D1D1F')
        .attr('font-size', '11px')
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(`${agg.engagementRate.toFixed(1)}%`);

      rowGroup
        .append('rect')
        .attr('x', 0)
        .attr('y', yTop + barH + 3)
        .attr('width', Math.max(agg.ctaRate > 0 ? 3 : 0, xScale(agg.ctaRate)))
        .attr('height', Math.max(4, barH - 2))
        .attr('rx', 2)
        .attr('fill', '#8E8E93');
    });
  }, [channelAggregates, efficiencyWidth, highlightedChannel]);

  const hoveredPoint =
    hoveredStageIdx !== null ? growthSeries[hoveredStageIdx] : null;

  const metricLabelMap: Record<GrowthMetricKey, string> = {
    engagements: 'Audience Engagements',
    views: 'Reach / Views',
    ctaClicks: 'CTA Conversions',
    engagementRate: 'Engagement Rate (%)',
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header & Controls Bar */}
      <div className="apple-glass-bar border-b border-black/[0.07] px-6 py-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold text-[#1D1D1F] tracking-[-0.022em]">
              Strategy Insight
            </h2>
            <p className="text-[12.5px] text-[#6E6E73] mt-0.5">
              Aggregated D3 audience engagement growth across WhatsApp, IG, TikTok, YouTube, and Website funnels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Strategy Filter */}
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
                  aria-pressed={strategyFilter === opt.value}
                  onClick={() => setStrategyFilter(opt.value)}
                  className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                    strategyFilter === opt.value
                      ? 'apple-segment-active'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Format Filter */}
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
                  aria-pressed={formatFilter === opt.value}
                  onClick={() => setFormatFilter(opt.value)}
                  className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                    formatFilter === opt.value
                      ? 'apple-segment-active'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onToggleLiveStream}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-medium rounded-[9px] border transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 ${
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
        </div>
      </div>

      {/* Scrollable Insight Body */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#F5F5F7] space-y-6">
        {/* Top 4-Column Flat KPI Strip */}
        <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-black/[0.07]">
          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Digital Audience Engagements</div>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="text-[26px] font-semibold font-mono tabular-nums tracking-[-0.025em] text-[#1D1D1F]">
                {totals.engagements.toLocaleString()}
              </span>
              {totals.netGrowthPct > 0 && (
                <span className="text-[12px] font-mono tabular-nums font-semibold text-[#1F8A4C]">
                  +{totals.netGrowthPct}% vs launch
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73]">
              Across WhatsApp, IG, TikTok, YouTube & Website
            </div>
          </div>

          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Blended Engagement Rate</div>
            <div className="mt-1.5 text-[26px] font-semibold font-mono tabular-nums tracking-[-0.025em] text-[#0071E3]">
              {totals.engRate.toFixed(1)}%
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73] font-mono tabular-nums">
              {totals.views.toLocaleString()} total digital reach
            </div>
          </div>

          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Digital CTA Conversions</div>
            <div className="mt-1.5 text-[26px] font-semibold font-mono tabular-nums tracking-[-0.025em] text-[#1D1D1F]">
              {totals.ctaClicks.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73] font-mono tabular-nums">
              {totals.ctaRate.toFixed(1)}% click-to-reach conversion
            </div>
          </div>

          <div className="p-5">
            <div className="text-[12px] text-[#6E6E73]">Leading Engagement Channel</div>
            <div className="mt-1.5 text-[24px] font-semibold text-[#1D1D1F] tracking-[-0.02em]">
              {totals.leader && totals.leader.engagements > 0
                ? totals.leader.def.label
                : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#6E6E73] font-mono tabular-nums">
              {totals.leader && totals.leader.engagements > 0
                ? `${totals.leader.engagements.toLocaleString()} engagements · ${totals.leader.engagementRate.toFixed(1)}% rate`
                : 'No published metrics yet'}
            </div>
          </div>
        </div>

        {/* Primary Focal Anchor: D3 Audience Engagement Growth + Efficiency Split */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
          {/* Left 8 cols: D3 Multi-Series Audience Engagement Growth */}
          <div className="xl:col-span-8 bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
                  Audience Engagement Growth
                </h3>
                <p className="text-[12px] text-[#6E6E73] mt-0.5">
                  Interactive D3 multi-channel progression from initial launch to latest recorded telemetry
                </p>
              </div>

              {/* Metric Selector */}
              <div className="flex items-center gap-0.5 p-[3px] bg-black/[0.05] rounded-[9px]">
                {(
                  [
                    { key: 'engagements', label: 'Engagements' },
                    { key: 'views', label: 'Views' },
                    { key: 'ctaClicks', label: 'CTA Clicks' },
                    { key: 'engagementRate', label: 'Eng. Rate' },
                  ] as { key: GrowthMetricKey; label: string }[]
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={metricKey === m.key}
                    onClick={() => setMetricKey(m.key)}
                    className={`px-2.5 py-1 text-[12px] font-medium rounded-[6.5px] transition-all duration-150 whitespace-nowrap shrink-0 ${
                      metricKey === m.key
                        ? 'apple-segment-active'
                        : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Channel Toggles */}
            <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-black/[0.06]">
              {INSIGHT_CHANNELS.map((ch) => {
                const active = visibleChannels[ch.key];
                return (
                  <button
                    key={ch.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleChannel(ch.key)}
                    onMouseEnter={() => setHighlightedChannel(ch.key)}
                    onMouseLeave={() => setHighlightedChannel(null)}
                    className={`inline-flex items-center gap-2 px-2.5 py-1 text-[12px] font-medium border rounded-[8px] transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white border-black/[0.12] text-[#1D1D1F] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'
                        : 'bg-[#F5F5F7] border-transparent text-[#86868B]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                      style={{
                        backgroundColor: active ? ch.color : '#C7C7CC',
                      }}
                    />
                    <span>{ch.label}</span>
                  </button>
                );
              })}
            </div>

            {/* D3 Chart Canvas + Inline Inspection Readout */}
            <div className="relative flex-1 pt-4" ref={growthContainerRef}>
              {totals.views === 0 ? (
                <div className="h-[292px] flex flex-col items-center justify-center border border-dashed border-black/[0.14] rounded-xl text-center px-4 bg-[#FAFAFC]">
                  <TrendingUp className="w-5 h-5 text-[#86868B] mb-2" />
                  <p className="text-[13px] font-semibold text-[#1D1D1F]">
                    No engagement metrics match the current filter
                  </p>
                  <p className="text-[12px] text-[#6E6E73] mt-1">
                    Adjust your strategy or format filter, or log a performance snapshot inside a project folder.
                  </p>
                </div>
              ) : (
                <>
                  <svg
                    ref={growthSvgRef}
                    className="w-full overflow-visible block"
                    role="img"
                    aria-label={`D3 ${metricLabelMap[metricKey]} growth chart across WhatsApp, IG, TikTok, YouTube, and Website`}
                  />

                  {/* Crisp Hover Readout Bar */}
                  <div className="mt-2 pt-3 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-3 text-[12px] min-h-[34px]">
                    {hoveredPoint ? (
                      <>
                        <span className="font-mono text-[#6E6E73] tabular-nums">
                          Stage: <strong className="text-[#1D1D1F]">{hoveredPoint.stageLabel}</strong>
                        </span>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
                          {activeChannels.map((ch) => {
                            const val = hoveredPoint.values[ch.key][metricKey];
                            return (
                              <span key={ch.key} className="inline-flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-[2px]"
                                  style={{ backgroundColor: ch.color }}
                                />
                                <span className="text-[#6E6E73] font-sans">{ch.label}</span>
                                <span className="text-[#1D1D1F] font-semibold">
                                  {metricKey === 'engagementRate'
                                    ? `${val.toFixed(1)}%`
                                    : val.toLocaleString()}
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <span className="text-[#6E6E73]">
                        Hover across the chart to inspect exact {metricLabelMap[metricKey].toLowerCase()} by channel stage.
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right 4 cols: D3 Channel Engagement Rate vs CTA Efficiency */}
          <div className="xl:col-span-4 bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 flex flex-col">
            <div className="mb-4">
              <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
                Engagement vs. CTA Efficiency
              </h3>
              <p className="text-[12px] text-[#6E6E73] mt-0.5">
                D3 horizontal ratio comparing Engagement Rate (top bar) against CTA Conversion Rate (bottom bar)
              </p>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-[#6E6E73] pb-3 border-b border-black/[0.06]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-[2px] bg-[#0071E3]" />
                Engagement Rate %
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-[2px] bg-[#8E8E93]" />
                CTA Conversion %
              </span>
            </div>

            <div className="flex-1 pt-3" ref={efficiencyContainerRef}>
              <svg
                ref={efficiencySvgRef}
                className="w-full overflow-visible block"
                role="img"
                aria-label="D3 channel engagement rate and CTA conversion rate comparison"
              />
            </div>

            <div className="mt-3 pt-3 border-t border-black/[0.06] text-[11px] text-[#6E6E73] leading-relaxed">
              Hover any channel bar to isolate its curve in the Audience Engagement Growth chart.
            </div>
          </div>
        </div>

        {/* Channel Aggregation Ledger Table */}
        <div className="bg-white border border-black/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-x-auto">
          <div className="px-5 py-3.5 border-b border-black/[0.07] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[14.5px] font-semibold text-[#1D1D1F]">
                Defined Channel Performance Ledger
              </h3>
              <p className="text-[12px] text-[#6E6E73] mt-0.5">
                WhatsApp, IG (Short/Reel/Post), TikTok, YouTube (Long/Short), and Website rollup
              </p>
            </div>
            <span className="text-[11.5px] font-mono tabular-nums text-[#6E6E73]">
              {digitalProjects.length} active digital folders
            </span>
          </div>

          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-black/[0.07] bg-[#FAFAFC] text-[11px] font-semibold text-[#6E6E73]">
                <th className="py-3 px-4 font-semibold">Channel</th>
                <th className="py-3 px-4 font-semibold">Mix (Strategy · Format)</th>
                <th className="py-3 px-4 font-semibold text-right">Folders</th>
                <th className="py-3 px-4 font-semibold text-right">Reach / Views</th>
                <th className="py-3 px-4 font-semibold text-right">Engagements</th>
                <th className="py-3 px-4 font-semibold text-right">Eng. Rate</th>
                <th className="py-3 px-4 font-semibold text-right">CTA Clicks</th>
                <th className="py-3 px-4 font-semibold text-right">Completion</th>
                <th className="py-3 px-4 font-semibold text-right">Top Folder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] text-[12.5px]">
              {channelAggregates.map((row) => {
                const isHighlighted = highlightedChannel === row.def.key;
                return (
                  <tr
                    key={row.def.key}
                    onMouseEnter={() => setHighlightedChannel(row.def.key)}
                    onMouseLeave={() => setHighlightedChannel(null)}
                    className={`transition-colors duration-150 ${
                      isHighlighted ? 'bg-[#F5F5F7]' : 'hover:bg-[#F5F5F7]/70'
                    }`}
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-[3px] shrink-0"
                          style={{ backgroundColor: row.def.color }}
                        />
                        <div>
                          <div className="font-semibold text-[#1D1D1F]">
                            {row.def.label}
                          </div>
                          <div className="text-[11px] text-[#6E6E73]">
                            {row.def.sublabel}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-[#515154] font-mono text-[11px] tabular-nums">
                      {row.internalCount} Int / {row.externalCount} Ext ·{' '}
                      {row.slideCount} Slide / {row.videoCount} Video
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#515154]">
                      <button
                        type="button"
                        onClick={() =>
                          onFilterChannelInFolders(row.def.channelIds[0])
                        }
                        className="hover:text-[#0071E3] hover:underline font-medium"
                        title={`View ${row.def.label} folders`}
                      >
                        {row.projectCount}
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1D1D1F]">
                      {row.views.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1D1D1F] font-semibold">
                      {row.engagements.toLocaleString()}
                      {row.growthPct > 0 && (
                        <span className="ml-1.5 text-[11px] text-[#1F8A4C] font-medium">
                          +{row.growthPct}%
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#0071E3] font-medium">
                      {row.views > 0 ? `${row.engagementRate.toFixed(1)}%` : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#515154]">
                      {row.ctaClicks.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#1F8A4C] font-medium">
                      {row.views > 0 ? `${row.avgCompletion}%` : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right max-w-[200px]">
                      {row.topProject ? (
                        <button
                          type="button"
                          onClick={() => onOpenFolder(row.topProject!.id)}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0071E3] hover:text-[#0062CC] max-w-[190px]"
                        >
                          <span className="truncate">{row.topProject.folderCode}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                        </button>
                      ) : (
                        <span className="text-[#86868B]">—</span>
                      )}
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
