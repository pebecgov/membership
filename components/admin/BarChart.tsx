"use client";

type BarItem = { name: string; count: number };

export function BarChart({
  title,
  items,
  emptyMessage = "No data yet",
}: {
  title: string;
  items: BarItem[];
  emptyMessage?: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-[#0A1121]">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">{emptyMessage}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.slice(0, 10).map((item) => (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate font-medium text-slate-700">{item.name}</span>
                <span className="ml-2 text-slate-500">{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-[#0A1121]"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
