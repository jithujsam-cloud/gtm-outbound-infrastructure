import { createClient } from '@/lib/supabase/server';
import type { FullCampaign } from '@/lib/types';

const CAMPAIGN_COLUMNS =
  'id, name, emails_sent, open_rate, reply_rate, positive_reply_rate, ' +
  'leads_generated, week_1_leads, week_2_leads, week_3_leads, week_4_leads, last_synced, tool';

export async function getCampaignsForClient(clientId: string): Promise<FullCampaign[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('campaigns')
      .select(CAMPAIGN_COLUMNS)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (error) console.warn('getCampaignsForClient error:', error.message);
      return [];
    }
    return data as unknown as FullCampaign[];
  } catch (err) {
    console.warn('getCampaignsForClient failed:', err);
    return [];
  }
}

export async function getPublicCampaigns(clientId: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc('get_public_campaigns', { p_client_id: clientId });

    if (error || !data) {
      if (error) console.warn('getPublicCampaigns error:', error.message);
      return [];
    }
    return data as { id: string; name: string }[];
  } catch (err) {
    console.warn('getPublicCampaigns failed:', err);
    return [];
  }
}
