'use client';

import { useState } from 'react';
import { RefreshCw, Mail, ShieldCheck, Pencil, X } from 'lucide-react';

export interface InfraSignals {
  sending_capacity: number | null;
  active_inboxes: number | null;
  domain_health_score: number | null;
  domain_health_status: string | null;
}

interface Props {
  signals: InfraSignals;
  onSave: (updated: InfraSignals) => Promise<void>;
  hideHeading?: boolean;
  readOnly?: boolean;
}

interface FieldConfig {
  key: keyof InfraSignals;
  label: string;
  type: 'number' | 'text';
  placeholder: string;
}

const cards = [
  {
    icon: RefreshCw,
    label: 'Total Sending Capacity',
    fields: [{ key: 'sending_capacity' as keyof InfraSignals, label: 'Sending Capacity', type: 'number' as const, placeholder: '12500' }],
    renderShortValue: (s: InfraSignals) => s.sending_capacity != null ? s.sending_capacity.toLocaleString() : '—',
    shortLabel: 'CAPACITY',
    renderShortSub: (_: InfraSignals) => 'BASED ON MAILBOXES',
  },
  {
    icon: Mail,
    label: 'Active Inboxes',
    fields: [{ key: 'active_inboxes' as keyof InfraSignals, label: 'Active Inboxes', type: 'number' as const, placeholder: '48' }],
    renderShortValue: (s: InfraSignals) => s.active_inboxes != null ? String(s.active_inboxes) : '—',
    shortLabel: 'INBOXES',
    renderShortSub: (_: InfraSignals) => 'CURRENTLY SENDING',
  },
  {
    icon: ShieldCheck,
    label: 'Domain Health',
    fields: [
      { key: 'domain_health_score' as keyof InfraSignals, label: 'Health Score (%)', type: 'number' as const, placeholder: '98' },
      { key: 'domain_health_status' as keyof InfraSignals, label: 'Status Label', type: 'text' as const, placeholder: 'Healthy' },
    ],
    renderShortValue: (s: InfraSignals) => s.domain_health_score != null ? `${s.domain_health_score}%` : '—',
    shortLabel: 'HEALTH',
    renderShortSub: (_: InfraSignals) => 'DMARC/SPF/DKIM',
  },
];

export default function EmailInfrastructureSignals({ signals, onSave, hideHeading, readOnly }: Props) {
  const [editing, setEditing] = useState<typeof cards[0] | null>(null);
  const [draft, setDraft] = useState<InfraSignals>(signals);
  const [saving, setSaving] = useState(false);

  function openModal(card: typeof cards[0]) {
    setDraft(signals);
    setEditing(card);
  }

  function handleChange(key: keyof InfraSignals, raw: string, type: 'number' | 'text') {
    setDraft((prev) => ({
      ...prev,
      [key]: type === 'number' ? (raw === '' ? null : Number(raw)) : raw || null,
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex w-full flex-col sm:flex-row items-center divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/40 rounded-3xl sm:rounded-full border border-outline-variant/50 bg-surface-container-lowest overflow-hidden">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="group relative flex flex-1 items-center justify-center py-3 px-4 sm:px-6 w-full sm:w-auto">
              {!readOnly && (
                <button
                  onClick={() => openModal(card)}
                  className="absolute right-3 rounded-md p-1.5 text-on-surface-variant/70 transition-colors hover:text-on-surface hover:bg-surface-container"
                  aria-label={`Edit ${card.label}`}
                >
                  <Pencil size={12} />
                </button>
              )}
              <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-x-2 gap-y-1 text-center sm:text-left">
                <Icon size={18} className="text-primary flex-shrink-0" />
                <span className="text-base font-medium text-primary ml-1">
                  {card.renderShortValue(signals)}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-on-surface">
                  {card.shortLabel}
                </span>
                <span className="text-[10px] sm:text-xs font-medium text-on-surface-variant/70 tracking-wide uppercase sm:ml-1">
                  {card.renderShortSub(signals)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface p-6 shadow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Edit {editing.label}</h3>
              <button onClick={() => setEditing(null)} className="rounded-md p-1 text-on-surface-variant hover:bg-surface-container">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {editing.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-sm font-medium text-on-surface-variant mb-1.5 block">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={draft[field.key] != null ? String(draft[field.key]) : ''}
                    onChange={(e) => handleChange(field.key, e.target.value, field.type)}
                    className="input"
                  />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
