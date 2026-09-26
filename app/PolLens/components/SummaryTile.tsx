/** One figure in a sunken summary well (grains, types, confidence, slides). */
export default function SummaryTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <div className="text-lg text-text" style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
      <div className="text-[12px] text-text-muted">{label}</div>
    </div>
  );
}
