import crypto from 'node:crypto';

const clean = (value) => String(value ?? '').trim();
const pad = (value, width) => String(Math.max(0, Number(value || 0))).padStart(width, '0');

export const sanitizeStorageCodePart = (value, fallback = 'ITEM') => {
  const normalized = clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalized || fallback;
};

export const normalizeDocumentCode = (value) => {
  const raw = sanitizeStorageCodePart(value, '');
  if (!raw) return '';
  return raw.startsWith('DOC-') ? raw : `DOC-${raw.replace(/^DOC-?/, '')}`;
};

export const validateDocumentCode = (value) => {
  const code = normalizeDocumentCode(value);
  if (!code) return { valid: false, code: '', message: 'Document code is required.' };
  if (code.length < 5 || code.length > 80) {
    return { valid: false, code, message: 'Document code must be between 5 and 80 characters.' };
  }
  if (!/^DOC-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(code)) {
    return { valid: false, code, message: 'Document code can contain only letters, numbers, and hyphens.' };
  }
  return { valid: true, code, message: '' };
};

export const createProjectStorageCode = (projectId, locationCode) =>
  `PRJ-${sanitizeStorageCodePart(locationCode, 'PROJECT')}-${pad(projectId, 3)}`;

export const createListingStorageCode = (listingId) => `LST-${pad(listingId, 6)}`;

export const createPaymentStorageCode = (paymentId, createdAt = new Date()) => {
  const date = new Date(createdAt || Date.now());
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `PAY-${year}-${pad(paymentId, 6)}`;
};

export const resolveProjectStorageCode = (project = {}) => clean(
  project.lot_project_storage_code || project.storageCode || project.storage_code
) || createProjectStorageCode(
  project.lot_project_id || project.id,
  project.lot_project_location_code || project.locationCode || project.location_code
);

export const resolveListingStorageCode = (listing = {}) => clean(
  listing.lot_project_listing_storage_code || listing.storageCode || listing.storage_code
) || createListingStorageCode(listing.lot_project_listing_id || listing.id);

export const resolvePaymentStorageCode = (payment = {}) => clean(
  payment.lot_project_payment_storage_code || payment.storageCode || payment.storage_code
) || createPaymentStorageCode(
  payment.lot_project_payment_id || payment.paymentId || payment.id,
  payment.lot_project_payment_created_at || payment.createdAt || new Date()
);

export const getFileExtension = ({ fileName = '', fileType = '' } = {}) => {
  const mime = clean(fileType).toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  const match = clean(fileName).match(/\.([a-zA-Z0-9]{1,8})$/);
  return match ? match[1].toLowerCase() : 'bin';
};

export const buildDocumentStoredFileName = ({
  documentCode,
  accountReference,
  version = 1,
  sequence = 1,
  totalFiles = 1,
  extension,
}) => {
  const code = normalizeDocumentCode(documentCode) || 'DOC-FILE';
  const account = sanitizeStorageCodePart(accountReference, 'ACC');
  const versionPart = `V${pad(version, 2)}`;
  const sequencePart = Number(totalFiles || 1) > 1 ? `-${pad(sequence, 2)}` : '';
  return `${code}__${account}__${versionPart}${sequencePart}.${clean(extension).replace(/^\./, '').toLowerCase() || 'bin'}`;
};

export const buildPaymentProofStoredFileName = ({ paymentStorageCode, sequence = 1, extension }) => {
  const payment = sanitizeStorageCodePart(paymentStorageCode, 'PAY');
  return `${payment}__PROOF-${pad(sequence, 2)}.${clean(extension).replace(/^\./, '').toLowerCase() || 'bin'}`;
};

export const createReadableCloudinaryPublicId = (storedFileName) => {
  const base = clean(storedFileName).replace(/\.[^.]+$/, '') || 'protected-file';
  return `${base}__${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

export const deriveStoredFileNameFromPublicId = (publicId, extension) => {
  const leaf = clean(publicId).split('/').filter(Boolean).at(-1) || '';
  const canonicalBase = leaf.replace(/__[A-F0-9]{8}$/i, '');
  if (!canonicalBase) return '';
  const ext = clean(extension).replace(/^\./, '').toLowerCase();
  return ext ? `${canonicalBase}.${ext}` : canonicalBase;
};

export const parseDocumentFileVersionFromName = (storedFileName) => {
  const match = clean(storedFileName).match(/__V(\d{1,6})(?:-\d+)?\./i);
  return match ? Number(match[1]) : 1;
};

export const parseDocumentFileSequenceFromName = (storedFileName) => {
  const match = clean(storedFileName).match(/__V\d{1,6}-(\d{1,6})\./i);
  return match ? Number(match[1]) : 1;
};

export const parsePaymentProofSequenceFromName = (storedFileName) => {
  const match = clean(storedFileName).match(/__PROOF-(\d{1,6})\./i);
  return match ? Number(match[1]) : 1;
};
