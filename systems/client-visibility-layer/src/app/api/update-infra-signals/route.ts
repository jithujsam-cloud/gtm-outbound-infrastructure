import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { clientId, sending_capacity, active_inboxes, domain_health_score, domain_health_status } = await request.json();

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('clients')
      .update({
        sending_capacity: sending_capacity ?? null,
        active_inboxes: active_inboxes ?? null,
        domain_health_score: domain_health_score ?? null,
        domain_health_status: domain_health_status ?? null,
      })
      .eq('id', clientId);

    if (error) {
      console.error('update-infra-signals error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('update-infra-signals error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
