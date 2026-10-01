const SPIKES = Array.from({ length: 28 }, (_, index) => index * (360 / 28));
const PORES = [
  { x: -44, y: -34, r: 12 },
  { x: 42, y: -48, r: 10 },
  { x: 57, y: 24, r: 12 },
  { x: 3, y: 57, r: 9 },
  { x: -59, y: 39, r: 11 },
  { x: -13, y: -6, r: 13 },
  { x: 32, y: 16, r: 8 },
  { x: -38, y: 83, r: 7 },
  { x: 77, y: -6, r: 7 },
  { x: 0, y: -89, r: 8 },
];

/** A quiet, illustrative pollen grain for the sign-in frontispiece. */
export default function PollenField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden xl:block">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_79%_43%,rgba(140,47,27,0.07),transparent_43%)]" />

      <svg
        viewBox="0 0 520 560"
        className="absolute right-[-8%] top-[48%] h-[min(72vh,640px)] min-h-[360px] w-[52%] min-w-[340px] -translate-y-1/2 opacity-[0.62]"
        fill="none"
      >
        <circle cx="296" cy="279" r="205" stroke="var(--hero-bg-deep)" strokeWidth="1" />
        <circle cx="296" cy="279" r="187" stroke="var(--hero-bg-deep)" strokeWidth="1" strokeDasharray="2 7" />

        <g transform="translate(296 279)">
          <circle r="166" fill="var(--hero-bg-deep)" fillOpacity="0.46" />

          {SPIKES.map((angle) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <path
                d="M0 -161 C8 -170 7 -181 0 -190 C-7 -181 -8 -170 0 -161Z"
                fill="var(--hero-grain-soft)"
                fillOpacity="0.75"
              />
            </g>
          ))}

          <circle r="151" stroke="var(--hero-grain)" strokeOpacity="0.62" strokeWidth="1.2" />
          <circle r="137" stroke="var(--hero-grain-soft)" strokeOpacity="0.65" strokeWidth="1" />
          <circle r="123" stroke="var(--hero-grain)" strokeOpacity="0.34" strokeWidth="1" />

          {Array.from({ length: 18 }, (_, index) => {
            const angle = (index / 18) * Math.PI * 2;
            return (
              <ellipse
                key={index}
                cx={Math.cos(angle) * 108}
                cy={Math.sin(angle) * 108}
                rx="5"
                ry="10"
                transform={`rotate(${index * 20} ${Math.cos(angle) * 108} ${Math.sin(angle) * 108})`}
                fill="var(--hero-grain-soft)"
                fillOpacity="0.42"
              />
            );
          })}

          <circle r="91" fill="var(--hero-bg)" fillOpacity="0.56" stroke="var(--hero-grain-soft)" strokeOpacity="0.58" />
          <circle r="75" stroke="var(--hero-grain)" strokeOpacity="0.28" />

          {PORES.map((pore, index) => (
            <g key={index}>
              <circle cx={pore.x} cy={pore.y} r={pore.r + 4} fill="var(--hero-grain-soft)" fillOpacity="0.12" />
              <circle cx={pore.x} cy={pore.y} r={pore.r} fill="var(--hero-bg-deep)" fillOpacity="0.76" stroke="var(--hero-grain)" strokeOpacity="0.56" />
              <circle cx={pore.x - pore.r * 0.22} cy={pore.y - pore.r * 0.24} r="2" fill="var(--hero-grain)" fillOpacity="0.55" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
