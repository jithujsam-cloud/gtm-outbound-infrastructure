import { createClient } from '@/lib/supabase/server';
import type { Client } from '@/lib/types';

export type { Client };

export async function getClients(): Promise<Client[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, slug, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getClients error:', error.message);
      return [];
    }

    return data as Client[];
  } catch (err) {
    console.warn('getClients failed:', err);
    return [];
  }
}

export async function getClientBySlug(slug: string): Promise<Client | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, slug, status, created_at')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn('getClientBySlug error:', error.message);
      return null;
    }

    return data as Client;
  } catch (err) {
    console.warn('getClientBySlug failed:', err);
    return null;
  }
}

export async function getPublicClientBySlug(slug: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc('get_public_client_by_slug', { p_slug: slug })
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn('getPublicClientBySlug error:', error.message);
      return null;
    }
    return data as Client & { agency_name: string | null; agency_logo_url: string | null };
  } catch (err) {
    console.warn('getPublicClientBySlug failed:', err);
    return null;
  }
}
