type Grain = {
  x: number; // percentage
  y: number; // percentage
  scale: number;
  rotate: number;
  kind: "spiny" | "ribbed" | "porate";
  tag?: string;
  dur: number;
  gdur: number;
  dx: number;
  dy: number;
  dr: number;
};

const GRAINS: Grain[] = [
  { x: 12, y: 20, scale: 1.15, rotate: 8, kind: "spiny", tag: "AMBR·03", dur: 16, gdur: 7, dx: 8, dy: -10, dr: 5 },
  { x: 70, y: 14, scale: 0.85, rotate: -12, kind: "porate", tag: "BETU·11", dur: 13, gdur: 5.5, dx: -6, dy: 8, dr: -6 },
  { x: 85, y: 46, scale: 1.3, rotate: 20, kind: "ribbed", tag: "POAC·02", dur: 18, gdur: 8, dx: 10, dy: 6, dr: 4 },
  { x: 34, y: 62, scale: 0.7, rotate: -4, kind: "porate", dur: 11, gdur: 4.5, dx: -5, dy: -6, dr: 8 },
  { x: 58, y: 74, scale: 1, rotate: 30, kind: "spiny", tag: "AMBR·07", dur: 15, gdur: 6.5, dx: 7, dy: 9, dr: -5 },
  { x: 8, y: 78, scale: 0.6, rotate: 10, kind: "ribbed", dur: 12, gdur: 5, dx: -4, dy: -8, dr: 6 },
  { x: 92, y: 82, scale: 0.55, rotate: -20, kind: "spiny", dur: 10, gdur: 4, dx: 5, dy: 5, dr: -8 },
  { x: 46, y: 12, scale: 0.5, rotate: 5, kind: "ribbed", dur: 9, gdur: 4.2, dx: -6, dy: 4, dr: 5 },
  { x: 20, y: 45, scale: 0.4, rotate: -8, kind: "porate", dur: 8.5, gdur: 3.8, dx: 4, dy: -4, dr: -4 },
];

function GrainShape({ kind }: { kind: Grain["kind"] }) {
  if (kind === "spiny") {
    return (
      <g>
        <circle r="14" fill="var(--hero-grain)" opacity="0.9" />
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const x1 = Math.cos(a) * 14;
          const y1 = Math.sin(a) * 14;
          const x2 = Math.cos(a) * 19;
          const y2 = Math.sin(a) * 19;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--hero-grain-soft)" strokeWidth="1.4" strokeLinecap="round" />
          );
        })}
      </g>
    );
  }
  if (kind === "ribbed") {
    return (
      <g>
        <ellipse rx="18" ry="11" fill="var(--hero-grain-soft)" opacity="0.85" />
        {[-10, -5, 0, 5, 10].map((o, i) => (
          <line key={i} x1={o} y1={-10} x2={o} y2={10} stroke="var(--hero-bg)" strokeWidth="1" opacity="0.5" />
        ))}
      </g>
    );
  }
  return (
    <g>
      <path
        d="M0,-16 C10,-14 16,-4 14,6 C12,14 4,17 -4,15 C-13,13 -17,3 -14,-6 C-11,-14 -6,-17 0,-16 Z"
        fill="var(--hero-grain)"
        opacity="0.75"
      />
      {[0, 120, 240].map((deg, i) => (
        <circle
          key={i}
          cx={Math.cos((deg * Math.PI) / 180) * 9}
          cy={Math.sin((deg * Math.PI) / 180) * 9}
          r="2.1"
          fill="var(--hero-bg)"
          opacity="0.6"
        />
      ))}
    </g>
  );
}

export default function PollenField() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* darkfield vignette, in the frontispiece's oxide */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(201,138,111,0.08), transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(231,195,179,0.05), transparent 50%), var(--hero-bg)",
        }}
      />
      {GRAINS.map((g, i) => (
        <div
          key={i}
          className="drift absolute"
          style={{
            left: `${g.x}%`,
            top: `${g.y}%`,
            // @ts-expect-error custom css vars
            "--dur": `${g.dur}s`,
            "--gdur": `${g.gdur}s`,
            "--dx": `${g.dx}px`,
            "--dy": `${g.dy}px`,
            "--dr": `${g.dr}deg`,
          }}
        >
          <svg
            width={44 * g.scale}
            height={44 * g.scale}
            viewBox="-22 -22 44 44"
            style={{ transform: `rotate(${g.rotate}deg)`, filter: "drop-shadow(0 0 6px rgba(201,138,111,0.22))" }}
          >
            <GrainShape kind={g.kind} />
          </svg>
          {g.tag && (
            <span
              className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[11px] tracking-widest text-hero-fg-muted"
              style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
            >
              {g.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
