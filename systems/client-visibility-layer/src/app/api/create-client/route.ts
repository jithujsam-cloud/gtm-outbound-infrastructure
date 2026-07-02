import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSlug, isValidSlug } from '@/lib/slug-utils';

export async function POST(request: NextRequest) {
  try {
    const { name, slug: providedSlug } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid client name' }, { status: 400 });
    }

    let slug = providedSlug;
    if (!slug) {
      slug = generateSlug(name);
    } else if (typeof slug !== 'string' || !isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Check slug uniqueness
    const { data: conflict } = await admin
      .from('clients')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json({ error: 'This URL slug is already taken. Please choose a different one.' }, { status: 409 });
    }

    // Pick the first agency (there's only one in a no-auth setup)
    const { data: agency } = await admin
      .from('agency_details')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!agency) {
      return NextResponse.json({ error: 'No agency found. Run seed_demo_data() first.' }, { status: 500 });
    }

    const { data, error } = await admin
      .from('clients')
      .insert({
        name: name.trim(),
        slug,
        agency_id: agency.id,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      return NextResponse.json({ error: error.message || 'Failed to create client' }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
