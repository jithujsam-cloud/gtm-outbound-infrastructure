'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { generateSlug, isValidSlug } from '@/lib/slug-utils';
import type { Client } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onClientCreated: (client: Client) => void;
}

export default function CreateClientModal({ open, onClose, onClientCreated }: Props) {
  const [clientName, setClientName] = useState('');
  const [clientSlug, setClientSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setClientName(newName);
    if (!isSlugManuallyEdited) {
      setClientSlug(newName.trim() ? generateSlug(newName) : '');
      setSlugError('');
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSlug = e.target.value.toLowerCase();
    setClientSlug(newSlug);
    setIsSlugManuallyEdited(true);
    setSlugError(newSlug && !isValidSlug(newSlug) ? 'Use lowercase letters, numbers, and hyphens only.' : '');
  };

  const resetForm = () => {
    setClientName('');
    setClientSlug('');
    setSlugError('');
    setIsSlugManuallyEdited(false);
    setError('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!clientName.trim()) { setError('Please enter a client name'); return; }
    if (!isValidSlug(clientSlug)) { setError('Please enter a valid URL slug'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: clientName, slug: clientSlug }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create client');
      }

      const client = await res.json();
      onClientCreated(client);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={handleClose} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-modal">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-base font-semibold text-on-surface">Create New Client</h2>
          <button onClick={handleClose} aria-label="Close" className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="clientName" className="block text-sm font-medium text-on-surface-variant mb-1.5">Client Name</label>
            <input id="clientName" type="text" value={clientName} onChange={handleNameChange} placeholder="Enter client name..." disabled={loading} className="input" autoFocus />
          </div>

          <div>
            <label htmlFor="clientSlug" className="block text-sm font-medium text-on-surface-variant mb-1.5">URL Slug</label>
            <input id="clientSlug" type="text" value={clientSlug} onChange={handleSlugChange} placeholder="client-slug" disabled={loading} className={`input ${slugError ? 'border-error' : ''}`} />
            {slugError && <p className="text-xs text-error mt-1">{slugError}</p>}
            <p className="text-xs text-on-surface-variant mt-1">Lowercase letters, numbers, and hyphens only.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-error/50 bg-error/10 px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={handleClose} disabled={loading} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={loading || !clientName.trim() || !isValidSlug(clientSlug)} className="btn btn-primary">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Creating...' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
