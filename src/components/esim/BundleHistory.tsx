import type { BundleHistoryEntry } from '@/lib/bundle-summary';

function formatData(mb: number | null) {
  if (mb === null) return '';
  return mb >= 1024 ? `${Number((mb / 1024).toFixed(2))} GB` : `${mb} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BundleHistory({ entries }: { entries: BundleHistoryEntry[] }) {
  if (!entries.length) return null;
  return (
    <div className="mt-5 border-t border-white/15 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-white/65">Bundles on this number</h3>
      <p className="mt-1 text-xs text-white/55">Your remaining data is shown above. Each bundle keeps its own expiry date.</p>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-xl bg-white/10 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-white">{entry.name}</p>
              <span className="shrink-0 text-xs font-bold text-white/80">{formatData(entry.data_mb)}</span>
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              {entry.source === 'admin_topup' ? 'Added by Travela' : entry.source === 'topup' ? 'Top-up' : 'Original purchase'} · {formatDate(entry.added_at)}
            </p>
            <p className={`mt-0.5 text-[11px] ${entry.expired ? 'text-white/45' : 'text-white/75'}`}>
              {entry.expired ? 'Expired' : 'Expires'} {formatDate(entry.expires_at)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
