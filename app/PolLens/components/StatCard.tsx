"use client";

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
}

export default function StatCard({ label, value, sublabel }: StatCardProps) {
  return (
    <div className="bg-surface px-4 py-3">
      <span className="text-[12px] text-text-muted">{label}</span>
      <div className="mt-1 text-[1.75rem] leading-none text-text lining-nums tabular-nums" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        {value}
      </div>
      {sublabel && <div className="mt-1 text-[12px] text-text-muted">{sublabel}</div>}
    </div>
  );
}
