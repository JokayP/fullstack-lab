import { LoaderCircle } from 'lucide-react';

export function SearchLoading() {
  return (
    <div aria-busy="true" aria-label="Searching characters">
      <div
        role="status"
        className="mb-6 flex items-center gap-3 rounded-lg border border-portal/20 bg-portal/5 px-4 py-3 text-sm text-portal"
      >
        <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" />
        <span>Opening the portal…</span>
      </div>
      <div
        className="grid grid-cols-1 gap-5 min-[440px]:grid-cols-2 lg:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="aspect-[1.2] animate-pulse bg-white/5 motion-reduce:animate-none" />
            <div className="space-y-3 p-5">
              <div className="h-2 w-20 rounded bg-white/10" />
              <div className="h-4 w-3/4 rounded bg-white/10" />
              <div className="h-2 w-1/2 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
