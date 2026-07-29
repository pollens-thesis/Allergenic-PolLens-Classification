import { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-panel-line bg-white/60 p-5">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] tracking-widest text-ink/50 uppercase"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {label}
        </span>
        <Icon size={16} strokeWidth={1.75} className="text-anther" />
      </div>
      <div className="mt-3 text-3xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
        {value}
      </div>
      {sublabel && <div className="mt-1 text-[12px] text-ink/50">{sublabel}</div>}
    </div>
  );
}
