import Link from 'next/link';
import { getClients } from '@/lib/data/clients';
import { Eye } from 'lucide-react';

export default async function AgencyDashboard() {
  const clients = await getClients();

  if (clients.length === 0) {
    return (
      <div className="px-8 py-16">
        <div className="mx-auto max-w-[1440px]">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            No clients yet. Run the seed function to create demo data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            View campaign status for each client.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={`/agency/clients/${client.slug}`}
              className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-5 transition-all hover:border-outline hover:shadow-sm active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-on-surface truncate">{client.name}</h3>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {client.slug}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  client.status === 'active'
                    ? 'bg-primary-fixed/30 text-primary'
                    : 'bg-surface-container text-on-surface-variant'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    client.status === 'active' ? 'bg-primary' : 'bg-on-surface-variant/40'
                  }`} />
                  {client.status === 'active' ? 'Live' : 'Offline'}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-on-surface-variant">
                <Eye size={14} />
                <span>View dashboard</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
