'use client';

import ClientDashboard from '@/components/ClientDashboard';

interface CampaignData {
  campaign_name?: string | null;
  emails_sent?: number | null;
  open_rate?: number | null;
  reply_rate?: number | null;
  leads_generated?: number | null;
  week_1_leads?: number | null;
  week_2_leads?: number | null;
  week_3_leads?: number | null;
  week_4_leads?: number | null;
}

interface PublicClientViewProps {
  clientName: string;
  campaignData: CampaignData | null;
  agencyName: string | null;
  agencyLogoUrl: string | null;
}

export default function PublicClientView({
  clientName,
  campaignData,
  agencyName,
}: PublicClientViewProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex h-14 items-center border-b border-outline-variant/10 bg-[#F8F9FF] px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-medium tracking-wide">
          {agencyName && (
            <>
              <span className="text-on-surface-variant">{agencyName}</span>
              <span className="text-on-surface-variant/30 select-none">/</span>
            </>
          )}
          <span className="text-primary font-semibold">{clientName}</span>
        </div>
      </header>

      {/* Body */}
      <main className="px-4 py-4 md:px-6 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-on-surface tracking-tight">
              {clientName} — Performance Dashboard
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Track real-time campaign progress.
            </p>
          </div>

          <ClientDashboard campaignData={campaignData} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/40 bg-surface-container-low mt-8">
        <div className="mx-auto max-w-[1440px] px-4 py-6 text-sm text-on-surface-variant md:px-6 lg:px-8">
          <p>&copy; {new Date().getFullYear()} {agencyName ?? clientName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
