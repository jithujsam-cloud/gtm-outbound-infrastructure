'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Eye, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/agency/dashboard', label: 'Clients', icon: LayoutGrid },
  { href: '/agency/portal-settings', label: 'Portal Settings', icon: Eye },
];

export default function AgencySidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/agency/dashboard') return pathname === '/agency/dashboard' || pathname.startsWith('/agency/clients/');
    return pathname === href;
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] flex-col bg-primary lg:flex">
      <div className="px-6 py-6">
        <h1 className="text-xl font-bold tracking-tight text-on-primary">
          CVL
        </h1>
        <p className="text-xs uppercase tracking-widest text-on-primary/60 mt-1">
          Client Visibility
        </p>
      </div>

      <nav className="flex flex-1 flex-col px-3 mt-4">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all active:scale-[0.98] ${
                  active
                    ? 'text-on-primary bg-on-primary/15'
                    : 'text-on-primary/70 hover:text-on-primary'
                }`}
              >
                <Icon size={20} className="flex-shrink-0" />
                <span className="text-[15px]">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        <div className="my-2 h-px bg-on-primary/20" />

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-on-primary/70 hover:text-on-primary transition-all active:scale-[0.98] mb-4"
        >
          <LogOut size={20} />
          <span className="text-[15px]">Logout</span>
        </button>
      </nav>
    </aside>
  );
}
