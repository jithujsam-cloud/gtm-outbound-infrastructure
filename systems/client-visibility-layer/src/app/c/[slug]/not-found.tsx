import Link from 'next/link';

export default function PortalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-container-lowest p-6 text-center">
      <h2 className="text-xl font-semibold text-on-surface mb-2">Not Found</h2>
      <p className="text-sm text-on-surface-variant max-w-md">
        This client dashboard does not exist. Check the link or contact your agency.
      </p>
    </div>
  );
}
