'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import type { Client } from '@/lib/types';

interface Props {
  clients: Client[];
}

export default function PortalSettingsClient({ clients }: Props) {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(clients.map((c) => [c.id, c.status]))
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleStatus = async (clientId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    setStatuses((prev) => ({ ...prev, [clientId]: newStatus }));

    try {
      const res = await fetch('/api/update-client-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, status: newStatus }),
      });
      if (!res.ok) {
        setStatuses((prev) => ({ ...prev, [clientId]: currentStatus }));
      }
    } catch {
      setStatuses((prev) => ({ ...prev, [clientId]: currentStatus }));
    }
  };

  const copyLink = async (slug: string, id: string) => {
    const url = `${window.location.origin}/c/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  if (clients.length === 0) {
    return (
      <p className="text-sm text-on-surface-variant">
        No clients to configure. Run the seed function to create demo data.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {clients.map((client) => (
        <div
          key={client.id}
          className="flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-4"
        >
          <div className="min-w-0">
            <h3 className="font-semibold text-on-surface">{client.name}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              /c/{client.slug}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Copy share link */}
            <button
              onClick={() => copyLink(client.slug, client.id)}
              className="btn btn-secondary text-xs gap-1.5"
              title="Copy portal link"
            >
              {copiedId === client.id ? <Check size={14} /> : <Copy size={14} />}
              {copiedId === client.id ? 'Copied' : 'Copy Link'}
            </button>

            {/* Status toggle */}
            <button
              onClick={() => toggleStatus(client.id, statuses[client.id])}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                statuses[client.id] === 'active'
                  ? 'bg-primary-fixed/30 text-primary'
                  : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                statuses[client.id] === 'active' ? 'bg-primary' : 'bg-on-surface-variant/40'
              }`} />
              {statuses[client.id] === 'active' ? 'Live' : 'Offline'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
