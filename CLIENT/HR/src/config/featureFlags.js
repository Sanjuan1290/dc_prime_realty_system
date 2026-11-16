export const HR_FEATURE_FLAGS = Object.freeze({
  writesEnabled: import.meta.env.VITE_HR_READ_ONLY !== 'true',
  kiosk: import.meta.env.VITE_HR_KIOSK_ENABLED !== 'false',
  payrollRelease: import.meta.env.VITE_HR_READ_ONLY !== 'true',
  signedReceipts: false, // Batch 9 secured storage required
})

