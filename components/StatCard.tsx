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
          className="text-[11.5px] tracking-widest text-ink/70 uppercase"
          style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
        >
          {label}
        </span>
        <Icon size={16} strokeWidth={1.75} className="text-anther-ink" />
      </div>
      <div className="mt-3 text-3xl text-ink" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
        {value}
      </div>
      {sublabel && <div className="mt-1 text-[13px] text-ink/70">{sublabel}</div>}
    </div>
  );
}
