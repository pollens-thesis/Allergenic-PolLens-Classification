import Sidebar from "@/components/Sidebar";
import PollenMap from "@/components/PollenMap";

export default function PollenMapPage() {
  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-bg lg:grid-cols-[15rem_1fr]">
      <Sidebar />

      <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <div
          className="sticky top-0 z-10 -mx-4 mb-6 border-b border-border px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
          style={{
            background: "color-mix(in srgb, var(--bg) 85%, transparent)",
            backdropFilter: "blur(12px)",
          }}
        >
          <h1 className="text-3xl text-text" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
            Pollen map
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Where each pollen type is turning up. Provinces are shaded by how many grains have been
            counted in them — open one to see which of its towns the pollen came from.
          </p>
        </div>

        <PollenMap />
      </main>
    </div>
  );
}
