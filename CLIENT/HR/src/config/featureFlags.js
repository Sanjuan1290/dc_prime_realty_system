export const HR_FEATURE_FLAGS = Object.freeze({
  stagingWrites: import.meta.env.VITE_HR_STAGING_WRITES === 'true',
  kiosk: import.meta.env.DEV && import.meta.env.VITE_HR_KIOSK_ENABLED === 'true',
  payrollRelease: false, // Batch 8 integration required
  signedReceipts: false, // Batch 9 secured storage required
})

