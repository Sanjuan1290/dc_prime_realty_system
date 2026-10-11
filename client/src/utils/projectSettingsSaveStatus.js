// Use a read-only GET to reconcile a save whose HTTP response was lost.
// Only claim success when all submitted settings match the server's current data.
const TEXT_FIELDS = [
  'reservationContactName', 'reservationContactEmail', 'reservationContactNumber',
  'companyName', 'companyEmail', 'companyContactNumber',
]
const text = (value) => String(value ?? '').trim()
const bool = (value) => value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1'
export const projectSettingsMatchPayload = (saved, submitted) => {
  if (!saved || !submitted) return false
  return TEXT_FIELDS.every((key) => text(saved[key]) === text(submitted[key]))
    && ['releaseDayOne', 'releaseDayTwo'].every((key) => Number(saved[key]) === Number(submitted[key]))
    && bool(saved.paymentEntryEmailNotificationEnabled) === bool(submitted.paymentEntryEmailNotificationEnabled)
}
