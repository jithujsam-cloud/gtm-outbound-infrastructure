import { getClients } from '@/lib/data/clients';
import PortalSettingsClient from './portal-settings-client';

export default async function PortalSettingsPage() {
  const clients = await getClients();

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Portal Settings</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Toggle client portal visibility and copy share links.
          </p>
        </div>

        <PortalSettingsClient clients={clients} />
      </div>
    </div>
  );
}
