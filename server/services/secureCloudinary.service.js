import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import {
  createReadableCloudinaryPublicId,
  createListingStorageCode,
  createProjectStorageCode,
  normalizeDocumentCode,
  sanitizeStorageCodePart,
} from './storageCodes.service.js';

const clean = (value) => String(value ?? '').trim();
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MALWARE_PROVIDER = 'perception_point';
const MALWARE_STATUS_VALUES = new Set(['pending', 'approved', 'rejected']);
const FALLBACK_TOKEN_TTL_SECONDS = 5 * 60;

let quotaUsageCache = {
  expiresAt: 0,
  value: null,
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getMalwareNotificationUrl = () => clean(process.env.CLOUDINARY_MALWARE_NOTIFICATION_URL);

const getQuotaCacheMs = () => {
  const configured = Number(process.env.CLOUDINARY_MALWARE_QUOTA_CACHE_MS || 30_000);
  if (!Number.isFinite(configured)) return 30_000;
  return Math.max(5_000, Math.min(configured, 5 * 60_000));
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(',').map(clean).filter(Boolean);
};

const normalizeModerations = (asset = {}) => {
  const value = asset.moderation || asset.moderations || [];
  if (Array.isArray(value)) return value;
  return value && typeof value === 'object' ? [value] : [];
};

const getModerationKind = (entry = {}) => clean(
  entry.kind ||
  entry.moderation_kind ||
  entry.type ||
  entry.provider ||
  entry.name
).toLowerCase();

const getModerationStatus = (entry = {}) => clean(
  entry.status ||
  entry.moderation_status ||
  entry.state
).toLowerCase();

const getQuotaPair = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const used = [
    value.usage,
    value.used,
    value.current,
    value.count,
    value.value,
  ].map(toFiniteNumber).find((number) => number !== null);

  const limit = [
    value.limit,
    value.quota,
    value.max,
    value.maximum,
    value.allowed,
  ].map(toFiniteNumber).find((number) => number !== null);

  if (used === undefined || used === null || limit === undefined || limit === null) return null;
  return { used, limit };
};

const valueMentionsPerceptionPoint = (value) => {
  if (typeof value !== 'string') return false;
  const text = value.toLowerCase();
  return text.includes('perception_point') || text.includes('perception point');
};

const findPerceptionPointQuota = (node, path = [], seen = new Set()) => {
  if (!node || typeof node !== 'object') return null;
  if (seen.has(node)) return null;
  seen.add(node);

  const pathText = path.join(' ').toLowerCase();
  const nodeLabel = [
    node.name,
    node.type,
    node.kind,
    node.addon,
    node.add_on,
    node.id,
    node.provider,
  ].filter(Boolean).join(' ').toLowerCase();

  if (
    pathText.includes('perception_point') ||
    pathText.includes('perception point') ||
    nodeLabel.includes('perception_point') ||
    nodeLabel.includes('perception point')
  ) {
    const pair = getQuotaPair(node);
    if (pair) return pair;
  }

  for (const [key, value] of Object.entries(node)) {
    const keyText = String(key).toLowerCase();
    const nextPath = [...path, key];

    if (keyText.includes('perception_point') || keyText.includes('perception point')) {
      const pair = getQuotaPair(value);
      if (pair) return pair;
      if (typeof value === 'number') {
        const siblingLimit = toFiniteNumber(node.limit ?? node.quota ?? node.max);
        if (siblingLimit !== null) return { used: Number(value), limit: siblingLimit };
      }
    }

    if (valueMentionsPerceptionPoint(value)) {
      const pair = getQuotaPair(node);
      if (pair) return pair;
    }

    if (value && typeof value === 'object') {
      const nested = findPerceptionPointQuota(value, nextPath, seen);
      if (nested) return nested;
    }
  }

  return null;
};

const base64UrlEncode = (value) => Buffer.from(value, 'utf8').toString('base64url');
const base64UrlDecode = (value) => Buffer.from(value, 'base64url').toString('utf8');

const timingSafeTextEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const createFallbackSignature = (encodedPayload, secret) =>
  crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');

const getFallbackSecret = () => {
  const { apiSecret } = configureSecureCloudinary();
  return apiSecret;
};

const appendSecurityContext = (context, scanRequested) =>
  scanRequested
    ? `${context}|malware_scan=${MALWARE_PROVIDER}`
    : `${context}|malware_scan=not_scanned|malware_reason=quota_exceeded`;

const buildUploadParams = ({
  timestamp,
  publicId,
  folder,
  tags,
  context,
  scanRequested = true,
}) => {
  const params = {
    timestamp,
    public_id: publicId,
    asset_folder: folder,
    type: 'authenticated',
    tags,
    context,
    allowed_formats: 'jpg,jpeg,png,pdf',
  };

  if (scanRequested) {
    const notificationUrl = getMalwareNotificationUrl();
    if (!notificationUrl) {
      const error = new Error('Malware scanning is not configured. Set CLOUDINARY_MALWARE_NOTIFICATION_URL before accepting uploads.');
      error.statusCode = 503;
      error.code = 'MALWARE_SCAN_NOT_CONFIGURED';
      throw error;
    }
    params.moderation = MALWARE_PROVIDER;
    params.notification_url = notificationUrl;
  }

  return params;
};

const buildSignatureResponse = ({
  cloudName,
  apiKey,
  timestamp,
  signature,
  publicId,
  folder,
  params,
  storedFileName,
  scanRequested,
  fallbackToken = '',
}) => ({
  cloudName,
  apiKey,
  timestamp,
  signature,
  publicId,
  folder,
  type: 'authenticated',
  tags: params.tags,
  context: params.context,
  allowedFormats: params.allowed_formats,
  moderation: scanRequested ? MALWARE_PROVIDER : '',
  notificationUrl: scanRequested ? params.notification_url : '',
  malwareScanRequested: Boolean(scanRequested),
  malwareScanProvider: scanRequested ? MALWARE_PROVIDER : null,
  malwareScanStatus: scanRequested ? 'pending' : 'not_scanned',
  malwareScanReason: scanRequested ? null : 'quota_exceeded',
  fallbackToken: clean(fallbackToken) || '',
  storedFileName,
  uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`,
});

export const sanitizeCloudinarySegment = (value, fallback = 'item') => {
  const normalized = clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

export const configureSecureCloudinary = () => {
  const cloudName = clean(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = clean(process.env.CLOUDINARY_API_KEY);
  const apiSecret = clean(process.env.CLOUDINARY_API_SECRET);

  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Cloudinary server credentials are incomplete. Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
    error.statusCode = 503;
    throw error;
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
};

export const validateDocumentUploadRequest = ({ fileName, fileType, fileSize }) => {
  const name = clean(fileName);
  const type = clean(fileType).toLowerCase();
  const size = Number(fileSize || 0);

  if (!name) throw Object.assign(new Error('File name is required.'), { statusCode: 400 });
  if (!ALLOWED_MIME_TYPES.has(type)) {
    throw Object.assign(new Error('Only PDF, JPG, and PNG files are allowed.'), { statusCode: 400 });
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw Object.assign(new Error('File size is required.'), { statusCode: 400 });
  }
  if (size > MAX_DOCUMENT_BYTES) {
    throw Object.assign(new Error('Each document file must be 15 MB or smaller.'), { statusCode: 400 });
  }

  return { fileName: name, fileType: type, fileSize: size };
};

export const getPerceptionPointQuotaState = async ({ requiredScans = 1, forceRefresh = false } = {}) => {
  configureSecureCloudinary();

  const required = Math.max(1, Number(requiredScans || 1));
  const notificationUrl = getMalwareNotificationUrl();
  if (!notificationUrl) {
    return {
      configured: false,
      known: true,
      used: null,
      limit: null,
      remaining: 0,
      required,
      insufficient: true,
    };
  }

  const now = Date.now();
  let pair = !forceRefresh && quotaUsageCache.value && quotaUsageCache.expiresAt > now
    ? quotaUsageCache.value
    : null;

  if (!pair) {
    try {
      const usage = await cloudinary.api.usage();
      pair = findPerceptionPointQuota(usage);
      quotaUsageCache = {
        value: pair,
        expiresAt: now + getQuotaCacheMs(),
      };
    } catch (error) {
      return {
        configured: true,
        known: false,
        used: null,
        limit: null,
        remaining: null,
        required,
        insufficient: false,
        error: clean(error?.message) || 'Cloudinary usage could not be checked.',
      };
    }
  }

  if (!pair) {
    return {
      configured: true,
      known: false,
      used: null,
      limit: null,
      remaining: null,
      required,
      insufficient: false,
    };
  }

  const used = Math.max(Number(pair.used || 0), 0);
  const limit = Math.max(Number(pair.limit || 0), 0);
  const remaining = Math.max(limit - used, 0);

  return {
    configured: true,
    known: true,
    used,
    limit,
    remaining,
    required,
    insufficient: remaining < required,
  };
};

export const invalidatePerceptionPointQuotaCache = () => {
  quotaUsageCache = { expiresAt: 0, value: null };
};

export const createMalwareQuotaFallbackToken = ({ scope, subjectId, uploadCount }) => {
  const payload = {
    scope: clean(scope),
    subjectId: clean(subjectId),
    uploadCount: Math.max(1, Number(uploadCount || 1)),
    exp: Math.floor(Date.now() / 1000) + FALLBACK_TOKEN_TTL_SECONDS,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = createFallbackSignature(encoded, getFallbackSecret());
  return `${encoded}.${signature}`;
};

export const verifyMalwareQuotaFallbackToken = (token, { scope, subjectId, uploadCount }) => {
  const [encoded, signature] = clean(token).split('.');
  if (!encoded || !signature) return false;

  const expectedSignature = createFallbackSignature(encoded, getFallbackSecret());
  if (!timingSafeTextEqual(signature, expectedSignature)) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded));
    if (Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) return false;
    if (clean(payload.scope) !== clean(scope)) return false;
    if (clean(payload.subjectId) !== clean(subjectId)) return false;
    if (Number(payload.uploadCount || 0) !== Math.max(1, Number(uploadCount || 1))) return false;
    return true;
  } catch {
    return false;
  }
};

export const authorizeMalwareQuotaFallback = async ({
  token = '',
  scope,
  subjectId,
  uploadCount,
}) => {
  if (verifyMalwareQuotaFallbackToken(token, { scope, subjectId, uploadCount })) {
    return {
      allowed: true,
      token,
      quota: null,
    };
  }

  const quota = await getPerceptionPointQuotaState({
    requiredScans: Math.max(1, Number(uploadCount || 1)),
    forceRefresh: true,
  });

  if (!quota.configured) {
    const error = new Error('Security scanning is not configured. Upload without scanning is not allowed.');
    error.statusCode = 503;
    error.code = 'MALWARE_SCAN_NOT_CONFIGURED';
    throw error;
  }

  if (!quota.known || !quota.insufficient) {
    const error = new Error(
      quota.known
        ? 'Security scanning is currently available. Retry the normal protected upload.'
        : 'The server could not verify that the malware-scanning quota is exhausted. Upload without scanning was blocked.'
    );
    error.statusCode = 409;
    error.code = 'MALWARE_SCAN_FALLBACK_NOT_ALLOWED';
    error.data = { quota };
    throw error;
  }

  return {
    allowed: true,
    token: createMalwareQuotaFallbackToken({ scope, subjectId, uploadCount }),
    quota,
  };
};

export const buildMalwareQuotaError = ({ quota, scope, subjectId, uploadCount }) => {
  const error = new Error('Security scanning is temporarily unavailable because the monthly malware-scanning quota is insufficient for this upload.');
  error.statusCode = 409;
  error.code = 'MALWARE_SCAN_QUOTA_INSUFFICIENT';
  error.data = {
    quota,
    fallbackToken: createMalwareQuotaFallbackToken({ scope, subjectId, uploadCount }),
  };
  return error;
};

export const getCloudinaryMalwareScanState = (asset = {}) => {
  const moderations = normalizeModerations(asset);
  const perception = moderations.find((entry) => getModerationKind(entry).includes('perception'));
  if (perception) {
    const status = getModerationStatus(perception);
    if (MALWARE_STATUS_VALUES.has(status)) {
      return {
        status,
        provider: MALWARE_PROVIDER,
        reason: status === 'rejected' ? 'malware_detected' : null,
      };
    }
  }

  const tags = normalizeTags(asset.tags);
  if (tags.includes('malware_unscanned')) {
    return {
      status: 'not_scanned',
      provider: null,
      reason: 'quota_exceeded',
    };
  }

  if (tags.includes('malware_scan_requested')) {
    return {
      status: 'pending',
      provider: MALWARE_PROVIDER,
      reason: null,
    };
  }

  return {
    status: 'not_scanned',
    provider: null,
    reason: 'legacy_or_unknown',
  };
};

export const buildBuyerDocumentFolder = ({
  projectStorageCode,
  projectId,
  projectLocationCode,
  listingStorageCode,
  listingId,
  accountReference,
  documentCode,
  documentId,
}) => {
  const root = sanitizeCloudinarySegment(process.env.CLOUDINARY_UPLOAD_FOLDER || 'dc_prime', 'dc_prime');
  const project = sanitizeStorageCodePart(
    projectStorageCode || createProjectStorageCode(projectId, projectLocationCode),
    'PRJ-PROJECT-000'
  );
  const listing = sanitizeStorageCodePart(
    listingStorageCode || createListingStorageCode(listingId),
    'LST-000000'
  );
  const account = sanitizeStorageCodePart(accountReference, 'ACC-UNKNOWN');
  const document = normalizeDocumentCode(documentCode) || `DOC-${String(Number(documentId || 0)).padStart(6, '0')}`;
  return `${root}/protected/${project}/${listing}/${account}/documents/${document}/files`;
};

export const buildPaymentProofFolder = ({
  projectStorageCode,
  projectId,
  projectLocationCode,
  listingStorageCode,
  listingId,
  accountReference,
  paymentStorageCode,
  paymentId,
}) => {
  const root = sanitizeCloudinarySegment(process.env.CLOUDINARY_UPLOAD_FOLDER || 'dc_prime', 'dc_prime');
  const project = sanitizeStorageCodePart(
    projectStorageCode || createProjectStorageCode(projectId, projectLocationCode),
    'PRJ-PROJECT-000'
  );
  const listing = sanitizeStorageCodePart(
    listingStorageCode || createListingStorageCode(listingId),
    'LST-000000'
  );
  const account = sanitizeStorageCodePart(accountReference, 'ACC-UNKNOWN');
  const payment = sanitizeStorageCodePart(paymentStorageCode || `PAY-${String(Number(paymentId || 0)).padStart(6, '0')}`, 'PAY-UNKNOWN');
  return `${root}/protected/${project}/${listing}/${account}/payments/${payment}/proofs`;
};

export const buildCommissionReceiptSignedCopyFolder = ({
  projectStorageCode,
  projectId,
  listingStorageCode,
  listingId,
  accountReference,
  receiptId,
}) => {
  const root = sanitizeCloudinarySegment(process.env.CLOUDINARY_UPLOAD_FOLDER || 'dc_prime', 'dc_prime');
  const project = sanitizeStorageCodePart(projectStorageCode || createProjectStorageCode(projectId), 'PRJ-0');
  const listing = sanitizeStorageCodePart(listingStorageCode || createListingStorageCode(listingId), 'LST-0');
  const account = sanitizeStorageCodePart(accountReference, 'ACC-UNKNOWN');
  const receipt = sanitizeStorageCodePart(`POI-${String(Number(receiptId || 0)).padStart(6, '0')}`, 'POI-UNKNOWN');
  return `${root}/protected/${project}/${listing}/${account}/commission-receipts/${receipt}/signed`;
};

export const buildPaymentAcknowledgementSignedCopyFolder = ({
  projectStorageCode,
  projectId,
  listingStorageCode,
  listingId,
  accountReference,
  paymentStorageCode,
  paymentId,
}) => {
  const root = sanitizeCloudinarySegment(process.env.CLOUDINARY_UPLOAD_FOLDER || 'dc_prime', 'dc_prime');
  const project = sanitizeStorageCodePart(projectStorageCode || createProjectStorageCode(projectId), 'PRJ-0');
  const listing = sanitizeStorageCodePart(listingStorageCode || createListingStorageCode(listingId), 'LST-0');
  const account = sanitizeStorageCodePart(accountReference, 'ACC-UNKNOWN');
  const payment = sanitizeStorageCodePart(paymentStorageCode || `PAY-${String(Number(paymentId || 0)).padStart(6, '0')}`, 'PAY-UNKNOWN');
  return `${root}/protected/${project}/${listing}/${account}/payments/${payment}/acknowledgement/signed`;
};

export const createAuthenticatedUploadSignature = ({
  folder,
  accountId,
  documentId,
  storedFileName,
  scanRequested = true,
  fallbackToken = '',
}) => {
  const { cloudName, apiKey, apiSecret } = configureSecureCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = createReadableCloudinaryPublicId(storedFileName);
  const baseContext = `account_id=${Number(accountId)}|document_id=${Number(documentId)}|stored_name=${encodeURIComponent(clean(storedFileName).slice(0, 180))}`;
  const tags = scanRequested
    ? 'dc_prime,buyer_document,authenticated,malware_scan_requested'
    : 'dc_prime,buyer_document,authenticated,malware_unscanned';
  const params = buildUploadParams({
    timestamp,
    publicId,
    folder,
    tags,
    context: appendSecurityContext(baseContext, scanRequested),
    scanRequested,
  });
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);

  return buildSignatureResponse({
    cloudName,
    apiKey,
    timestamp,
    signature,
    publicId,
    folder,
    params,
    storedFileName,
    scanRequested,
    fallbackToken,
  });
};

export const createAuthenticatedPaymentProofUploadSignature = ({
  folder,
  accountId,
  paymentId,
  storedFileName,
  scanRequested = true,
  fallbackToken = '',
}) => {
  const { cloudName, apiKey, apiSecret } = configureSecureCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = createReadableCloudinaryPublicId(storedFileName);
  const baseContext = `account_id=${Number(accountId || 0)}|payment_id=${Number(paymentId)}|stored_name=${encodeURIComponent(clean(storedFileName).slice(0, 180))}`;
  const tags = scanRequested
    ? 'dc_prime,payment_proof,authenticated,malware_scan_requested'
    : 'dc_prime,payment_proof,authenticated,malware_unscanned';
  const params = buildUploadParams({
    timestamp,
    publicId,
    folder,
    tags,
    context: appendSecurityContext(baseContext, scanRequested),
    scanRequested,
  });
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);

  return buildSignatureResponse({
    cloudName,
    apiKey,
    timestamp,
    signature,
    publicId,
    folder,
    params,
    storedFileName,
    scanRequested,
    fallbackToken,
  });
};

export const createAuthenticatedSignedCopyUploadSignature = ({
  folder,
  accountId,
  parentType,
  parentId,
  storedFileName,
  scanRequested = true,
  fallbackToken = '',
}) => {
  const { cloudName, apiKey, apiSecret } = configureSecureCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = createReadableCloudinaryPublicId(storedFileName);
  const cleanParentType = sanitizeCloudinarySegment(parentType, 'signed_copy');
  const baseContext = `account_id=${Number(accountId || 0)}|parent_type=${cleanParentType}|parent_id=${Number(parentId || 0)}|stored_name=${encodeURIComponent(clean(storedFileName).slice(0, 180))}`;
  const tags = scanRequested
    ? `dc_prime,signed_copy,${cleanParentType},authenticated,malware_scan_requested`
    : `dc_prime,signed_copy,${cleanParentType},authenticated,malware_unscanned`;
  const params = buildUploadParams({
    timestamp,
    publicId,
    folder,
    tags,
    context: appendSecurityContext(baseContext, scanRequested),
    scanRequested,
  });
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);

  return buildSignatureResponse({
    cloudName,
    apiKey,
    timestamp,
    signature,
    publicId,
    folder,
    params,
    storedFileName,
    scanRequested,
    fallbackToken,
  });
};

export const verifyAuthenticatedCloudinaryAsset = async ({ publicId, resourceType = 'image', expectedFolder = '' }) => {
  configureSecureCloudinary();
  const safeResourceType = ['image', 'raw', 'video'].includes(clean(resourceType)) ? clean(resourceType) : 'image';
  const asset = await cloudinary.api.resource(clean(publicId), {
    resource_type: safeResourceType,
    type: 'authenticated',
    tags: true,
    context: true,
    moderations: true,
  });

  const actualFolder = clean(asset.asset_folder || asset.folder);
  if (expectedFolder && actualFolder !== expectedFolder) {
    const error = new Error('Uploaded asset folder does not match the buyer account.');
    error.statusCode = 409;
    throw error;
  }

  if (asset.type !== 'authenticated') {
    const error = new Error('The uploaded file is not protected as an authenticated Cloudinary asset.');
    error.statusCode = 409;
    throw error;
  }

  return asset;
};

export const createAuthenticatedAccessUrl = ({ publicId, format, resourceType = 'image', expiresInSeconds = 600 }) => {
  configureSecureCloudinary();
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(Number(expiresInSeconds || 600), 3600));
  return cloudinary.utils.private_download_url(clean(publicId), clean(format) || undefined, {
    resource_type: ['image', 'raw', 'video'].includes(clean(resourceType)) ? clean(resourceType) : 'image',
    type: 'authenticated',
    expires_at: expiresAt,
    attachment: false,
  });
};

export const destroyCloudinaryAsset = async ({ publicId, resourceType = 'image', deliveryType = 'authenticated' }) => {
  configureSecureCloudinary();
  return cloudinary.uploader.destroy(clean(publicId), {
    resource_type: ['image', 'raw', 'video'].includes(clean(resourceType)) ? clean(resourceType) : 'image',
    type: clean(deliveryType) || 'authenticated',
    invalidate: true,
  });
};

export const destroyAuthenticatedCloudinaryAsset = (payload) => destroyCloudinaryAsset({ ...payload, deliveryType: 'authenticated' });

export const DOCUMENT_UPLOAD_LIMIT_BYTES = MAX_DOCUMENT_BYTES;
