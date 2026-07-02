'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, UserPlus, CalendarCheck, TrendingUp, Target } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import EmailInfrastructureSignals, { type InfraSignals } from './EmailInfrastructureSignals';

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
  campaign_name: string;
  emails_sent: number;
  open_rate: number;
  reply_rate: number;
  leads_generated: number;
  week_1_leads: number;
  week_2_leads: number;
  week_3_leads: number;
  week_4_leads: number;
}

interface CampaignSectionProps {
  clientId: string;
  initialCampaigns: { id: string; name: string; tool: string | null }[];
  initialCampaignData: CampaignData | null;
  initialInfraSignals: InfraSignals;
}

export default function CampaignSection({
  clientId,
  initialCampaigns,
  initialCampaignData,
  initialInfraSignals,
}: CampaignSectionProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selectedCampaign, setSelectedCampaign] = useState('All');
  const [campaign, setCampaign] = useState<CampaignData | null>(initialCampaignData);
  const [tool, setTool] = useState<string | null>(null);
  const [infraSignals, setInfraSignals] = useState<InfraSignals>(initialInfraSignals);

  const loadCampaign = useCallback(async (name: string) => {
    const params = new URLSearchParams({ client_id: clientId });
    if (name !== 'All') params.set('campaign_name', name);

    const res = await fetch(`/api/campaign-data?${params.toString()}`);
    if (!res.ok) return;

    const data = await res.json();
    setCampaign(data.campaign);
    setTool(data.tool ?? null);
    if (data.campaigns) setCampaigns(data.campaigns);
  }, [clientId]);

  useEffect(() => {
    loadCampaign(selectedCampaign);
  }, [selectedCampaign, loadCampaign]);

  const saveInfraSignals = useCallback(async (updated: InfraSignals) => {
    const res = await fetch('/api/update-infra-signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, ...updated }),
    });
    if (res.ok) setInfraSignals(updated);
  }, [clientId]);

  const statCards = [
    { icon: UserPlus, label: 'Leads Generated', value: (campaign?.leads_generated ?? 0).toLocaleString(), iconBg: 'bg-primary-fixed text-on-primary-fixed' },
    { icon: CalendarCheck, label: 'Emails Sent', value: (campaign?.emails_sent ?? 0).toLocaleString(), iconBg: 'bg-secondary-container text-on-secondary-container' },
    { icon: TrendingUp, label: 'Open Rate', value: `${(campaign?.open_rate ?? 0).toFixed(1)}%`, iconBg: 'bg-primary-container text-on-primary-container' },
    { icon: Target, label: 'Reply Rate', value: `${(campaign?.reply_rate ?? 0).toFixed(1)}%`, iconBg: 'bg-tertiary-fixed text-on-tertiary-fixed' },
  ];

  const chartData = useMemo(() => {
    if (!campaign) return [];
    const weeks = [
      { name: 'Week 1', value: campaign.week_1_leads },
      { name: 'Week 2', value: campaign.week_2_leads },
      { name: 'Week 3', value: campaign.week_3_leads },
      { name: 'Week 4', value: campaign.week_4_leads },
    ];
    let cumulativeTotal = 0;
    return weeks.map((week) => { cumulativeTotal += week.value; return { ...week, value: cumulativeTotal }; });
  }, [campaign]);

  const yAxisScale = useMemo(() => {
    const values = chartData.map((item) => item.value);
    if (values.length === 0 || Math.max(...values) === 0) return { max: 10, ticks: [0, 2, 4, 6, 8, 10] };
    const maxValue = Math.max(...values);
    const maxWithHeadroom = maxValue * 1.15;
    const niceIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    const rawInterval = maxWithHeadroom / 5;
    let chosenInterval = niceIntervals[0];
    for (const interval of niceIntervals) { if (interval >= rawInterval) { chosenInterval = interval; break; } }
    const yAxisMax = Math.ceil(maxWithHeadroom / chosenInterval) * chosenInterval;
    const ticks: number[] = [];
    for (let i = 0; i <= yAxisMax; i += chosenInterval) ticks.push(i);
    return { max: yAxisMax, ticks };
  }, [chartData]);

  const hasCampaign = campaigns.length > 0;

  if (!hasCampaign) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-12 text-center">
        <Target size={24} className="text-primary mb-4" />
        <h3 className="text-base font-semibold text-on-surface mb-1">No campaigns yet</h3>
        <p className="text-sm text-on-surface-variant">Create a campaign to start tracking performance.</p>
      </div>
    );
  }

  const campaignOptions = [
    { id: 'all', name: 'All' },
    ...campaigns.map((c) => ({ id: c.id, name: c.name })),
  ];

  return (
    <>
      {/* Campaign selector + integration badge */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
            className="h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-primary"
          >
            {campaignOptions.map((opt) => (
              <option key={opt.id} value={opt.name}>{opt.name}</option>
            ))}
          </select>

          {tool && (
            <div className="flex items-center gap-2 rounded-full border border-primary/10 bg-primary-fixed/20 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Connected — {tool === 'demo' ? 'Demo Data' : 'Smartlead'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 mb-6">
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

      {/* Infra signals */}
      <EmailInfrastructureSignals signals={infraSignals} onSave={saveInfraSignals} hideHeading />

      {/* Chart */}
      <div className="mt-6 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 md:p-6">
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
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#404943', fontSize: 12 }} dy={8} />
                <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: '#707973', fontSize: 11 }} domain={[0, yAxisScale.max]} ticks={yAxisScale.ticks} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#BFC9C1', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="value" stroke="#0F573E" strokeWidth={2} fill="url(#campaignGradient)" dot={{ fill: '#0F573E', r: 4, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#0F573E', stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[180px] md:h-[300px] items-center justify-center rounded-lg bg-surface-container-low text-sm text-on-surface-variant">
            No data yet.
          </div>
        )}
      </div>
    </>
  );
}
