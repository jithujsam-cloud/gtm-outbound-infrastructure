export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getClientBySlug } from '@/lib/data/clients';
import { getCampaignsForClient } from '@/lib/data/campaigns';
import ClientDashboard from '@/components/ClientDashboard';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function AgencyClientDetail({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const campaigns = await getCampaignsForClient(client.id);
  const latestCampaign = campaigns.length > 0 ? campaigns[0] : null;

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-on-surface tracking-tight">{client.name}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              client.status === 'active'
                ? 'bg-primary-fixed/30 text-primary'
                : 'bg-surface-container text-on-surface-variant'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                client.status === 'active' ? 'bg-primary' : 'bg-on-surface-variant/40'
              }`} />
              {client.status === 'active' ? 'Live' : 'Offline'}
            </span>
          </div>
          {latestCampaign && (
            <p className="mt-1 text-sm text-on-surface-variant">
              {latestCampaign.name} — {latestCampaign.tool ?? 'demo'}
            </p>
          )}
        </div>

        {latestCampaign && (
          <ClientDashboard campaignData={{
            campaign_name: latestCampaign.name,
            emails_sent: latestCampaign.emails_sent,
            open_rate: latestCampaign.open_rate,
            reply_rate: latestCampaign.reply_rate,
            leads_generated: latestCampaign.leads_generated,
            week_1_leads: latestCampaign.week_1_leads,
            week_2_leads: latestCampaign.week_2_leads,
            week_3_leads: latestCampaign.week_3_leads,
            week_4_leads: latestCampaign.week_4_leads,
            last_synced: latestCampaign.last_synced ?? new Date().toISOString(),
          }} />
        )}
      </div>
    </div>
  );
}
