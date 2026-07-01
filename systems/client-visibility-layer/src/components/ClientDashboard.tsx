'use client';

import { useMemo } from 'react';
import {
  UserPlus, CalendarCheck, TrendingUp, Target, ChevronDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface TooltipPayload {
  payload: { name: string; value: number };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">{point.name}</p>
      <p className="text-lg font-semibold text-on-surface">{point.value.toLocaleString()}</p>
    </div>
  );
}

interface CampaignData {
  emails_sent?: number | null;
  open_rate?: number | null;
  reply_rate?: number | null;
  leads_generated?: number | null;
  week_1_leads?: number | null;
  week_2_leads?: number | null;
  week_3_leads?: number | null;
  week_4_leads?: number | null;
  campaign_name?: string | null;
}

export default function ClientDashboard({ campaignData }: { campaignData: CampaignData | null }) {
  const statCards = [
    {
      icon: UserPlus,
      label: 'Leads Generated',
      value: (campaignData?.leads_generated ?? 0).toLocaleString(),
      iconBg: 'bg-primary-fixed text-on-primary-fixed',
    },
    {
      icon: CalendarCheck,
      label: 'Emails Sent',
      value: (campaignData?.emails_sent ?? 0).toLocaleString(),
      iconBg: 'bg-secondary-container text-on-secondary-container',
    },
    {
      icon: TrendingUp,
      label: 'Open Rate',
      value: `${(campaignData?.open_rate ?? 0).toFixed(1)}%`,
      iconBg: 'bg-primary-container text-on-primary-container',
    },
    {
      icon: Target,
      label: 'Reply Rate',
      value: `${(campaignData?.reply_rate ?? 0).toFixed(1)}%`,
      iconBg: 'bg-tertiary-fixed text-on-tertiary-fixed',
    },
  ];

  const chartData = useMemo(() => {
    if (!campaignData) return [];
    const weeks = [
      { name: 'Week 1', value: campaignData.week_1_leads ?? 0 },
      { name: 'Week 2', value: campaignData.week_2_leads ?? 0 },
      { name: 'Week 3', value: campaignData.week_3_leads ?? 0 },
      { name: 'Week 4', value: campaignData.week_4_leads ?? 0 },
    ];
    let cumulativeTotal = 0;
    return weeks.map((week) => {
      cumulativeTotal += week.value;
      return { ...week, value: cumulativeTotal };
    });
  }, [campaignData]);

  const yAxisScale = useMemo(() => {
    const values = chartData.map((item) => item.value);
    if (values.length === 0 || Math.max(...values) === 0) {
      return { max: 10, ticks: [0, 2, 4, 6, 8, 10] };
    }

    const maxValue = Math.max(...values);
    const maxWithHeadroom = maxValue * 1.15;
    const niceIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    const rawInterval = maxWithHeadroom / 5;
    let chosenInterval = niceIntervals[0];
    for (const interval of niceIntervals) {
      if (interval >= rawInterval) { chosenInterval = interval; break; }
    }
    const yAxisMax = Math.ceil(maxWithHeadroom / chosenInterval) * chosenInterval;
    const ticks: number[] = [];
    for (let i = 0; i <= yAxisMax; i += chosenInterval) ticks.push(i);
    return { max: yAxisMax, ticks };
  }, [chartData]);

  const hasCampaign = campaignData !== null && (campaignData.emails_sent ?? 0) > 0;

  if (!hasCampaign) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-12 text-center">
        <Target size={24} className="text-primary mb-4" />
        <h3 className="text-base font-semibold text-on-surface mb-1">No active campaigns</h3>
        <p className="text-sm text-on-surface-variant">There are no campaigns running for this client.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4">
              <div className={`mb-2 inline-flex rounded-md p-1.5 ${card.iconBg}`}>
                <Icon size={16} />
              </div>
              <p className="mb-1 text-xs text-on-surface-variant">{card.label}</p>
              <h3 className="text-3xl font-semibold text-on-surface">{card.value}</h3>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 md:p-6">
        <div className="mb-6 md:mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h4 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Campaign Performance</h4>
            <p className="text-xs md:text-sm text-on-surface-variant">Cumulative leads generated</p>
          </div>
          <button className="btn btn-secondary text-xs">
            Current Month
            <ChevronDown size={16} />
          </button>
        </div>

        {chartData.length > 0 ? (
          <div className="h-[180px] md:h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="campaignGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0F573E" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#0F573E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E5EEFF" strokeWidth={1} vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#404943', fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tick={{ fill: '#707973', fontSize: 11 }}
                  domain={[0, yAxisScale.max]}
                  ticks={yAxisScale.ticks}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#BFC9C1', strokeDasharray: '4 4' }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0F573E"
                  strokeWidth={2}
                  fill="url(#campaignGradient)"
                  dot={{ fill: '#0F573E', r: 4, stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#0F573E', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[180px] md:h-[300px] items-center justify-center rounded-lg bg-surface-container-low text-sm text-on-surface-variant">
            No data yet.
          </div>
        )}
      </div>
    </div>
  );
}
