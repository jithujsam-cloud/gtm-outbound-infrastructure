import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublicClientBySlug } from '@/lib/data/clients';
import PublicClientView from './client-view';

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PublicClientDashboard({ params }: Props) {
  const { slug } = await params;

  const client = await getPublicClientBySlug(slug);
  if (!client) notFound();

  if (client.status !== 'active') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-container-lowest p-6 text-center">
        <h2 className="text-xl font-semibold text-on-surface mb-2">Dashboard Inactive</h2>
        <p className="text-sm text-on-surface-variant max-w-md">
          This performance report dashboard is currently inactive.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: row } = await supabase
    .rpc('get_public_campaign_data', { p_client_id: client.id })
    .maybeSingle() as { data: Record<string, unknown> | null };

  const campaignData = row ? {
    campaign_name: (row.campaign_name as string) ?? null,
    emails_sent: (row.emails_sent as number) ?? 0,
    open_rate: (row.open_rate as number) ?? 0,
    reply_rate: (row.reply_rate as number) ?? 0,
    leads_generated: (row.leads_generated as number) ?? 0,
    week_1_leads: (row.week_1_leads as number) ?? 0,
    week_2_leads: (row.week_2_leads as number) ?? 0,
    week_3_leads: (row.week_3_leads as number) ?? 0,
    week_4_leads: (row.week_4_leads as number) ?? 0,
  } : null;

  return (
    <PublicClientView
      clientName={client.name}
      campaignData={campaignData}
      agencyName={client.agency_name ?? null}
      agencyLogoUrl={client.agency_logo_url ?? null}
    />
  );
}
