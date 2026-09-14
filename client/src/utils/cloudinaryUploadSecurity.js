const clean = (value) => String(value ?? '').trim();

export const MALWARE_QUOTA_CODE = 'MALWARE_SCAN_QUOTA_INSUFFICIENT';
export const MALWARE_CLOUDINARY_QUOTA_CODE = 'CLOUDINARY_MALWARE_SCAN_QUOTA';

export const appendCloudinarySecurityFields = (formData, signed = {}) => {
  if (signed.allowedFormats) formData.append('allowed_formats', signed.allowedFormats);
  if (signed.moderation) formData.append('moderation', signed.moderation);
  if (signed.notificationUrl) formData.append('notification_url', signed.notificationUrl);
};

export const getMalwareFallbackToken = (error) => clean(
  error?.data?.data?.fallbackToken ||
  error?.data?.fallbackToken ||
  error?.fallbackToken
);

export const isServerMalwareQuotaError = (error) => clean(error?.code) === MALWARE_QUOTA_CODE;

export const isCloudinaryMalwareQuotaError = ({ response, result, scanRequested = false } = {}) => {
  if (!scanRequested) return false;
  const message = clean(result?.error?.message || result?.message).toLowerCase();
  if (!message) return false;

  const quotaTerms = /(quota|limit|usage|allowance|exceed|maximum|monthly|scan)/i.test(message);
  const malwareTerms = /(perception|malware|virus|moderation|add[\s-]?on)/i.test(message);

  // The user-facing fallback still requires the server to confirm exhausted
  // Perception Point quota before it will issue an unscanned signature.
  return quotaTerms && (malwareTerms || Number(response?.status || 0) === 420);
};

export const createCloudinaryMalwareQuotaError = ({ result, fallbackToken = '' } = {}) => {
  const error = new Error(
    clean(result?.error?.message || result?.message) ||
    'The malware-scanning quota is currently unavailable.'
  );
  error.code = MALWARE_CLOUDINARY_QUOTA_CODE;
  error.fallbackToken = clean(fallbackToken);
  return error;
};

export const isMalwareQuotaFallbackError = (error) =>
  isServerMalwareQuotaError(error) || clean(error?.code) === MALWARE_CLOUDINARY_QUOTA_CODE;

export const getMalwareScanStatus = (file = {}) =>
  clean(file.malwareScanStatus || file.malware_scan_status || 'not_scanned').toLowerCase();

export const canOpenMalwareScannedFile = (file = {}) =>
  !['pending', 'rejected', 'error'].includes(getMalwareScanStatus(file));

export const malwareScanLabel = (file = {}) => {
  switch (getMalwareScanStatus(file)) {
    case 'approved': return 'Security scan passed';
    case 'pending': return 'Security scan in progress';
    case 'rejected': return 'Blocked: malware detected';
    case 'error': return 'Security scan error';
    default: return 'Not security scanned';
  }
};
