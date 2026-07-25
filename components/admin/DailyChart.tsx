"use client";

type DailyPoint = { label: string; count: number };

export function DailyChart({ data }: { data: DailyPoint[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-[#0A1121]">Registrations (last 14 days)</h3>
      <div className="mt-6 overflow-x-auto">
        <div className="flex h-36 min-w-[320px] items-end gap-1 sm:h-40 sm:gap-2">
        {data.map((point) => (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t bg-[#0A1121]/80 transition-all"
                style={{
                  height: `${Math.max((point.count / max) * 100, point.count > 0 ? 8 : 2)}%`,
                  minHeight: point.count > 0 ? "0.5rem" : "2px",
                }}
                title={`${point.count} registrations`}
              />
            </div>
            <span className="max-w-full truncate text-[9px] text-slate-400 sm:text-[10px]">
              {point.label}
            </span>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
