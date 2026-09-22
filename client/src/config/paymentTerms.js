export const DEFAULT_DAILY_PENALTY_RATE = 0.05

// Percentage points per overdue day: 0.01% through 0.10%.
export const DAILY_PENALTY_RATE_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => Number(((index + 1) / 100).toFixed(2))
)

export const formatDailyPenaltyRateOption = (rate) => {
  const numeric = Number(rate || 0)
  const label = `${numeric.toFixed(2)}% per day`
  return Math.abs(numeric - DEFAULT_DAILY_PENALTY_RATE) < 0.000001
    ? `${label} — Default`
    : label
}
