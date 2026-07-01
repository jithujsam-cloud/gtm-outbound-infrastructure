import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const { clientId, status } = await request.json();

    if (!clientId || !status || !['active', 'paused', 'ended'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from('clients')
      .update({ status })
      .eq('id', clientId);

    if (error) {
      console.error('update-client-status error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('update-client-status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
