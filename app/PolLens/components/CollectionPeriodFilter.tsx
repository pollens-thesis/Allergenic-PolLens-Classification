import type { DashboardHalf, DashboardRange } from "@/lib/dashboard";

export default function CollectionPeriodFilter({
  year,
  years,
  range,
  half,
  disabled,
  onYearChange,
  onRangeChange,
  onHalfChange,
}: {
  year: number;
  years: number[];
  range: DashboardRange;
  half: DashboardHalf;
  disabled: boolean;
  onYearChange: (year: number) => void;
  onRangeChange: (range: DashboardRange) => void;
  onHalfChange: (half: DashboardHalf) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-start gap-3 sm:gap-4">
      <label className="flex min-w-0 flex-col gap-1 text-[12px] text-text-muted">
        Year
        <select
          value={year}
          onChange={(event) => onYearChange(Number(event.target.value))}
          disabled={disabled}
          className="focus-ring min-h-11 min-w-28 rounded-sm border border-border bg-surface px-3 text-[13px] text-text disabled:cursor-not-allowed disabled:opacity-50 sm:w-40"
        >
          {years.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <fieldset className="min-w-0">
        <legend className="mb-1 text-[12px] text-text-muted">Period</legend>
        <div className="flex h-11 items-stretch rounded-sm border border-border bg-surface" role="group" aria-label="Collection period length">
          <button
            type="button"
            aria-pressed={range === 12}
            aria-label={`Show the full calendar year ${year}`}
            onClick={() => onRangeChange(12)}
            disabled={disabled}
            className={`focus-ring h-full min-h-0 whitespace-nowrap rounded-sm px-3 py-0 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${range === 12 ? "control-selection bg-selected text-selected-fg" : "text-text-muted hover:bg-surface-sunken hover:text-text"}`}
          >
            Full Year
          </button>
          <button
            type="button"
            aria-pressed={range === 6}
            aria-label={`Show six months in ${year}`}
            onClick={() => onRangeChange(6)}
            disabled={disabled}
            className={`focus-ring h-full min-h-0 whitespace-nowrap rounded-sm px-3 py-0 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${range === 6 ? "control-selection bg-selected text-selected-fg" : "text-text-muted hover:bg-surface-sunken hover:text-text"}`}
          >
            6 Months
          </button>
        </div>
      </fieldset>

      {range === 6 && (
        <fieldset className="min-w-0">
          <legend className="mb-1 text-[12px] text-text-muted">Half-year</legend>
          <div className="flex h-11 items-stretch rounded-sm border border-border bg-surface" role="group" aria-label={`Six-month period in ${year}`}>
            <button
              type="button"
              aria-pressed={half === 1}
              aria-label={`Show January through June ${year}`}
              onClick={() => onHalfChange(1)}
              disabled={disabled}
              className={`focus-ring h-full min-h-0 whitespace-nowrap rounded-sm px-3 py-0 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${half === 1 ? "control-selection bg-selected text-selected-fg" : "text-text-muted hover:bg-surface-sunken hover:text-text"}`}
            >
              Jan–Jun
            </button>
            <button
              type="button"
              aria-pressed={half === 2}
              aria-label={`Show July through December ${year}`}
              onClick={() => onHalfChange(2)}
              disabled={disabled}
              className={`focus-ring h-full min-h-0 whitespace-nowrap rounded-sm px-3 py-0 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${half === 2 ? "control-selection bg-selected text-selected-fg" : "text-text-muted hover:bg-surface-sunken hover:text-text"}`}
            >
              Jul–Dec
            </button>
          </div>
        </fieldset>
      )}
    </div>
  );
}
