import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

const clean = (value) => String(value ?? '').trim();
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

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

export const buildBuyerDocumentFolder = ({ projectSlug, listingId, unitId, accountReference, buyerName, documentName }) => {
  const root = sanitizeCloudinarySegment(process.env.CLOUDINARY_UPLOAD_FOLDER || 'dc_prime', 'dc_prime');
  const project = sanitizeCloudinarySegment(projectSlug, 'project');
  const listing = `listing_${Number(listingId)}_${sanitizeCloudinarySegment(unitId, 'unit')}`;
  const account = `${sanitizeCloudinarySegment(accountReference, 'account')}_${sanitizeCloudinarySegment(buyerName, 'buyer')}`;
  const document = sanitizeCloudinarySegment(documentName, 'document');
  return `${root}/${project}/${listing}/${account}/${document}`;
};

export const createAuthenticatedUploadSignature = ({ folder, accountId, documentId, fileName }) => {
  const { cloudName, apiKey, apiSecret } = configureSecureCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = crypto.randomUUID();
  const context = `account_id=${Number(accountId)}|document_id=${Number(documentId)}|original_name=${encodeURIComponent(clean(fileName).slice(0, 180))}`;
  const params = {
    timestamp,
    public_id: publicId,
    asset_folder: folder,
    type: 'authenticated',
    tags: 'dc_prime,buyer_document,authenticated',
    context,
  };
  const signature = cloudinary.utils.api_sign_request(params, apiSecret);

  return {
    cloudName,
    apiKey,
    timestamp,
    signature,
    publicId,
    folder,
    type: 'authenticated',
    tags: params.tags,
    context,
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`,
  };
};

export const verifyAuthenticatedCloudinaryAsset = async ({ publicId, resourceType = 'image', expectedFolder = '' }) => {
  configureSecureCloudinary();
  const safeResourceType = ['image', 'raw', 'video'].includes(clean(resourceType)) ? clean(resourceType) : 'image';
  const asset = await cloudinary.api.resource(clean(publicId), {
    resource_type: safeResourceType,
    type: 'authenticated',
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
