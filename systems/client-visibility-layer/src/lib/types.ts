export type ClientStatus = 'active' | 'paused' | 'ended';

export interface Client {
  id: string;
  name: string;
  slug: string;
  status: ClientStatus;
  created_at: string;
}

export interface CampaignData {
  campaign_name: string;
  emails_sent: number;
  open_rate: number;
  reply_rate: number;
  positive_reply_rate: number;
  leads_generated: number;
  week_1_leads: number;
  week_2_leads: number;
  week_3_leads: number;
  week_4_leads: number;
  last_synced: string;
}

export interface FullCampaign {
  id: string;
  name: string;
  emails_sent: number;
  open_rate: number;
  reply_rate: number;
  positive_reply_rate: number;
  leads_generated: number;
  week_1_leads: number;
  week_2_leads: number;
  week_3_leads: number;
  week_4_leads: number;
  last_synced: string | null;
  tool: string | null;
}
