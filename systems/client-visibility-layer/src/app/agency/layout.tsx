import AgencySidebar from '@/components/AgencySidebar';

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen">
      <AgencySidebar />
      <main className="overflow-y-auto lg:ml-[240px] min-h-screen pb-20 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
