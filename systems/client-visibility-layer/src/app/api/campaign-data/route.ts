import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const campaignName = searchParams.get('campaign_name');

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client_id' }, { status: 400 });
    }

    const admin = createAdminClient();

    if (!campaignName || campaignName === 'All') {
      const { data } = await admin
        .from('campaigns')
        .select('id, name, emails_sent, open_rate, reply_rate, positive_reply_rate, leads_generated, week_1_leads, week_2_leads, week_3_leads, week_4_leads, last_synced, tool')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (!data || data.length === 0) {
        return NextResponse.json({ campaign: null, campaigns: [] }, { status: 200 });
      }

      // Aggregate across all campaigns
      const agg = {
        campaign_name: 'All Campaigns',
        emails_sent: 0,
        open_rate: 0,
        reply_rate: 0,
        positive_reply_rate: 0,
        leads_generated: 0,
        week_1_leads: 0,
        week_2_leads: 0,
        week_3_leads: 0,
        week_4_leads: 0,
        last_synced: new Date().toISOString(),
      };
      data.forEach((c: Record<string, unknown>) => {
        agg.emails_sent += Number(c.emails_sent || 0);
        agg.open_rate += Number(c.open_rate || 0);
        agg.reply_rate += Number(c.reply_rate || 0);
        agg.positive_reply_rate += Number(c.positive_reply_rate || 0);
        agg.leads_generated += Number(c.leads_generated || 0);
        agg.week_1_leads += Number(c.week_1_leads || 0);
        agg.week_2_leads += Number(c.week_2_leads || 0);
        agg.week_3_leads += Number(c.week_3_leads || 0);
        agg.week_4_leads += Number(c.week_4_leads || 0);
      });
      const n = data.length;
      agg.open_rate = Number((agg.open_rate / n).toFixed(2));
      agg.reply_rate = Number((agg.reply_rate / n).toFixed(2));
      agg.positive_reply_rate = Number((agg.positive_reply_rate / n).toFixed(2));

      return NextResponse.json({
        campaign: agg,
        campaigns: data.map((c: Record<string, unknown>) => ({ id: c.id, name: c.name })),
        tool: null,
      }, { status: 200 });
    }

    // Single campaign
    const { data: single } = await admin
      .from('campaigns')
      .select('name, emails_sent, open_rate, reply_rate, positive_reply_rate, leads_generated, week_1_leads, week_2_leads, week_3_leads, week_4_leads, last_synced, tool')
      .eq('client_id', clientId)
      .eq('name', campaignName)
      .maybeSingle();

    if (!single) {
      return NextResponse.json({ campaign: null, campaigns: [] }, { status: 200 });
    }

    return NextResponse.json({
      campaign: {
        campaign_name: single.name,
        emails_sent: Number(single.emails_sent || 0),
        open_rate: Number(single.open_rate || 0),
        reply_rate: Number(single.reply_rate || 0),
        positive_reply_rate: Number(single.positive_reply_rate || 0),
        leads_generated: Number(single.leads_generated || 0),
        week_1_leads: Number(single.week_1_leads || 0),
        week_2_leads: Number(single.week_2_leads || 0),
        week_3_leads: Number(single.week_3_leads || 0),
        week_4_leads: Number(single.week_4_leads || 0),
        last_synced: single.last_synced,
      },
      tool: single.tool,
    }, { status: 200 });
  } catch (err) {
    console.error('campaign-data error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
