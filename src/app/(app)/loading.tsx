export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-5 pt-8 lg:px-10" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-9 w-2/3 rounded-full bg-surface-2" />
      <div className="mt-10 h-4 w-32 rounded-full bg-surface-2" />
      <div className="mt-4 h-20 w-3/4 rounded-3xl bg-surface-2" />
      <div className="mt-10 flex h-28 items-end gap-[3px]">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="flex-1 rounded-[2px] bg-surface-2" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
        ))}
      </div>
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 rounded-2xl bg-surface-2" />
        ))}
      </div>
    </div>
  );
}
