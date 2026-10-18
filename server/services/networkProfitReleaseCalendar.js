// Mirrors the live commission release-day rule. Dates are Philippine local dates from todayDateOnly().
export const getNetworkProfitReleaseCalendar = (todayISO, settings = {}) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(todayISO || ''))) throw new Error('A Philippine local date is required.');
  const dayOfMonth = Number(todayISO.slice(8, 10));
  const releaseDays = [...new Set([Number(settings.release_day_one || 7), Number(settings.release_day_two || 22)]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31))].sort((a, b) => a - b);
  const days = releaseDays.length ? releaseDays : [7, 22];
  const isReleaseDate = days.includes(dayOfMonth);
  const today = new Date(`${todayISO}T00:00:00.000Z`);
  let next = today;
  for (let offset = 0; offset <= 370; offset += 1) {
    const candidate = new Date(today);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    if (days.includes(candidate.getUTCDate())) { next = candidate; break; }
  }
  return {
    todayDateISO: todayISO,
    releaseDays: days,
    isReleaseDate,
    nextReleaseDateISO: next.toISOString().slice(0, 10),
    nextReleaseDate: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }).format(next),
  };
};

