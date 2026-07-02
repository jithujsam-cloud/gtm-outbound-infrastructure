import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClientBySlug } from '@/lib/data/clients';
import CampaignSection from '@/components/CampaignSection';
import type { FullCampaign } from '@/lib/types';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AgencyClientDetail({ params }: Props) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const supabase = createAdminClient();

  const { data: campaignsData } = await supabase
    .from('campaigns')
    .select('id, name, emails_sent, open_rate, reply_rate, positive_reply_rate, leads_generated, week_1_leads, week_2_leads, week_3_leads, week_4_leads, last_synced, tool')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false });

  const campaigns = (campaignsData ?? []) as unknown as (FullCampaign & { tool: string | null })[];

  // Aggregate initial campaign data
  const initialCampaignData = campaigns.length > 0
    ? {
        campaign_name: 'All Campaigns',
        emails_sent: campaigns.reduce((s, c) => s + Number(c.emails_sent || 0), 0),
        open_rate: Number((campaigns.reduce((s, c) => s + Number(c.open_rate || 0), 0) / campaigns.length).toFixed(2)),
        reply_rate: Number((campaigns.reduce((s, c) => s + Number(c.reply_rate || 0), 0) / campaigns.length).toFixed(2)),
        leads_generated: campaigns.reduce((s, c) => s + Number(c.leads_generated || 0), 0),
        week_1_leads: campaigns.reduce((s, c) => s + Number(c.week_1_leads || 0), 0),
        week_2_leads: campaigns.reduce((s, c) => s + Number(c.week_2_leads || 0), 0),
        week_3_leads: campaigns.reduce((s, c) => s + Number(c.week_3_leads || 0), 0),
        week_4_leads: campaigns.reduce((s, c) => s + Number(c.week_4_leads || 0), 0),
      }
    : null;

  const initialInfraSignals = {
    sending_capacity: null,
    active_inboxes: null,
    domain_health_score: null,
    domain_health_status: null,
  };

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
              {client.name} Performance Dashboard
            </h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              client.status === 'active'
                ? 'bg-primary-fixed/30 text-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${client.status === 'active' ? 'bg-primary' : 'bg-on-surface-variant/40'}`} />
              {client.status === 'active' ? 'Live' : 'Offline'}
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            Track real-time progress across all campaigns.
          </p>
        </div>

        <CampaignSection
          clientId={client.id}
          initialCampaigns={campaigns.map((c) => ({ id: c.id, name: c.name, tool: c.tool }))}
          initialCampaignData={initialCampaignData}
          initialInfraSignals={initialInfraSignals}
        />
      </div>
    </div>
  );
}
