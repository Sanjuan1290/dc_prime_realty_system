import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCloudinaryMoveToEntry,
  buildCloudinaryUnitAssetMove,
  createCloudinarySignature,
  deleteCloudinaryEmptyFolder,
  getCloudinaryFolderCleanupPaths,
  getCloudinaryPublicIdFromUrl,
  replaceCloudinaryUnitSegment,
  sanitizeCloudinaryPathPart,
} from '../services/cloudinaryUnitFolder.service.js';

test('Unit IDs use the same Cloudinary-safe folder format as the client uploader', () => {
  assert.equal(sanitizeCloudinaryPathPart('LA-0201'), 'la_0201');
  assert.equal(sanitizeCloudinaryPathPart(' Bailen Project '), 'bailen_project');
});

test('Cloudinary document paths replace only the unit segment', () => {
  const source = 'dc_prime/bailen_project/la_0101/buyer_counselling/documentimages';
  assert.equal(
    replaceCloudinaryUnitSegment(source, 'LA-0201', 'LA-0101'),
    'dc_prime/bailen_project/la_0201/buyer_counselling/documentimages'
  );
});


test('Old Cloudinary document folders are cleaned deepest-first up to the Unit ID folder', () => {
  assert.deepEqual(
    getCloudinaryFolderCleanupPaths('dc_prime/bailen_project/la_0101/buyer_counselling/documentimages'),
    [
      'dc_prime/bailen_project/la_0101/buyer_counselling/documentimages',
      'dc_prime/bailen_project/la_0101/buyer_counselling',
      'dc_prime/bailen_project/la_0101',
    ]
  );
});

test('Asset move plan renames a fixed-folder public ID to the new Unit ID', () => {
  const move = buildCloudinaryUnitAssetMove(
    {
      url: 'https://res.cloudinary.com/demo/image/upload/v123/dc_prime/bailen_project/la_0101/buyer_counselling/documentimages/file_abc.jpg',
      cloudinaryPublicId: 'dc_prime/bailen_project/la_0101/buyer_counselling/documentimages/file_abc',
      cloudinaryResourceType: 'image',
      cloudinaryFolder: 'dc_prime/bailen_project/la_0101/buyer_counselling/documentimages',
    },
    'LA-0201',
    'LA-0101'
  );

  assert.equal(move.needsRename, true);
  assert.equal(
    move.toPublicId,
    'dc_prime/bailen_project/la_0201/buyer_counselling/documentimages/file_abc'
  );
  assert.equal(
    move.toFolder,
    'dc_prime/bailen_project/la_0201/buyer_counselling/documentimages'
  );
});

test('Saving can repair a stale old folder even when the database already has the new Unit ID', () => {
  const move = buildCloudinaryUnitAssetMove(
    {
      cloudinaryPublicId: 'dc_prime/bailen_project/la_0101/buyer_counselling/documentimages/file_abc',
      cloudinaryFolder: 'dc_prime/bailen_project/la_0101/buyer_counselling/documentimages',
      cloudinaryResourceType: 'image',
    },
    'LA-0201',
    'LA-0201'
  );

  assert.equal(move.needsRename, true);
  assert.match(move.toPublicId, /\/la_0201\//);
});

test('Public ID can be recovered from older Cloudinary URL-only document entries', () => {
  assert.equal(
    getCloudinaryPublicIdFromUrl(
      'https://res.cloudinary.com/demo/image/upload/v1720000000/dc_prime/bailen_project/la_0101/doc/documentimages/file_name.png',
      'image'
    ),
    'dc_prime/bailen_project/la_0101/doc/documentimages/file_name'
  );

  assert.equal(
    getCloudinaryPublicIdFromUrl(
      'https://res.cloudinary.com/demo/raw/upload/v1720000000/dc_prime/bailen_project/la_0101/doc/documentimages/form.pdf',
      'raw'
    ),
    'dc_prime/bailen_project/la_0101/doc/documentimages/form.pdf'
  );
});

test('Rename response replaces stored URL, public ID, and folder metadata', () => {
  const original = {
    url: 'https://old.example/file.jpg',
    fileName: 'file.jpg',
    cloudinaryPublicId: 'dc_prime/bailen_project/la_0101/doc/documentimages/file',
    cloudinaryFolder: 'dc_prime/bailen_project/la_0101/doc/documentimages',
  };
  const move = {
    toPublicId: 'dc_prime/bailen_project/la_0201/doc/documentimages/file',
    toFolder: 'dc_prime/bailen_project/la_0201/doc/documentimages',
    resourceType: 'image',
  };

  const result = applyCloudinaryMoveToEntry(original, move, {
    public_id: move.toPublicId,
    secure_url: 'https://new.example/file.jpg',
    resource_type: 'image',
  });

  assert.equal(result.url, 'https://new.example/file.jpg');
  assert.equal(result.cloudinaryPublicId, move.toPublicId);
  assert.equal(result.cloudinaryFolder, move.toFolder);
});



test('Empty legacy folders are deleted through the authenticated Cloudinary Admin API', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };
  let request = null;

  process.env.CLOUDINARY_CLOUD_NAME = 'demo-cloud';
  process.env.CLOUDINARY_API_KEY = 'demo-key';
  process.env.CLOUDINARY_API_SECRET = 'demo-secret';
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return { ok: true, status: 200, json: async () => ({ deleted: [] }) };
  };

  try {
    const result = await deleteCloudinaryEmptyFolder({
      folder: 'dc_prime/bailen_project/la_0101',
      skipBackup: true,
    });

    assert.equal(result.deleted, true);
    assert.match(request.url, /folders\/dc_prime\/bailen_project\/la_0101\?skip_backup=true$/);
    assert.equal(request.options.method, 'DELETE');
    assert.match(request.options.headers.Authorization, /^Basic /);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.cloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalEnv.cloudName;
    if (originalEnv.apiKey === undefined) delete process.env.CLOUDINARY_API_KEY;
    else process.env.CLOUDINARY_API_KEY = originalEnv.apiKey;
    if (originalEnv.apiSecret === undefined) delete process.env.CLOUDINARY_API_SECRET;
    else process.env.CLOUDINARY_API_SECRET = originalEnv.apiSecret;
  }
});

test('Cloudinary signature is stable regardless of object key order', () => {
  const first = createCloudinarySignature(
    { to_public_id: 'new/path', timestamp: 123, from_public_id: 'old/path' },
    'secret'
  );
  const second = createCloudinarySignature(
    { from_public_id: 'old/path', to_public_id: 'new/path', timestamp: 123 },
    'secret'
  );

  assert.equal(first, second);
  assert.equal(first.length, 40);
});

