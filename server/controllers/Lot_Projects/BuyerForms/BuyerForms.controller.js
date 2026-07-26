import nodemailer from 'nodemailer';
import {
  db,
  getErrorMessage,
  getListingLookupWhere,
  getProjectBySlug,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';
import {
  assertBuyerFormSchema,
  createBuyerFormToken,
  expireBuyerFormLinks,
  getBuyerFormAdminState,
  getPublicBuyerFormUrl,
  getRequestIp,
  hashBuyerFormToken,
  parseJsonObject,
  resetBuyerFormsForAvailable,
  revokeOpenBuyerFormLinks,
  sanitizeBuyerProfilePayload,
  validateBuyerProfilePayload,
} from './buyerForm.shared.js';

const clampExpirationHours = (value) => {
  const hours = Number(value || 72);
  if (!Number.isFinite(hours)) return 72;
  return Math.min(Math.max(Math.round(hours), 1), 168);
};

const safeEmail = (value) => String(value || '').trim().slice(0, 150);
const safePhone = (value) => String(value || '').trim().slice(0, 50);
const safeReason = (value) => String(value || '').trim().slice(0, 1000);

const getListingForAdmin = async (connection, projectId, listingLookup, { lock = false } = {}) => {
  const lookup = getListingLookupWhere(listingLookup, 'l');
  const [rows] = await connection.query(
    `
      SELECT
        l.lot_project_listing_id,
        l.lot_project_listing_unit_id,
        l.lot_project_listing_status,
        l.buyer_form_generation,
        l.pending_buyer_form_submission_id
      FROM lot_project_listings l
      WHERE l.lot_project_id = ?
        AND ${lookup.sql}
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [projectId, ...lookup.params]
  );
  return rows[0] || null;
};

const sendBuyerFormEmail = async ({ recipientEmail, publicUrl, projectName, unitId, expiresAt }) => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    return { sent: false, message: `Email was not sent because SMTP settings are missing: ${missing.join(', ')}.` };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const companyName = String(process.env.COMPANY_NAME || 'D&C Prime Realty').trim();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER).trim();
  const subject = `Buyer Information Form — ${unitId}`;
  const expirationLabel = expiresAt ? new Date(expiresAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'the stated expiry time';

  await transporter.sendMail({
    from,
    to: recipientEmail,
    subject,
    text: [
      `You were invited to complete the buyer information form for ${unitId} in ${projectName}.`,
      '',
      publicUrl,
      '',
      `This link expires on ${expirationLabel}.`,
      'Submitting the form temporarily holds the unit for admin review. It does not complete the final reservation.',
      '',
      companyName,
    ].join('\n'),
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a;max-width:640px;margin:0 auto">
        <h2 style="margin:0 0 12px">Buyer Information Form</h2>
        <p>You were invited to complete the buyer information form for <strong>${unitId}</strong> in <strong>${projectName}</strong>.</p>
        <p style="margin:24px 0"><a href="${publicUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open Buyer Form</a></p>
        <p>This link expires on ${expirationLabel}.</p>
        <p>Submitting the form temporarily holds the unit for admin review. It does not complete the final reservation.</p>
        <p style="margin-top:28px;color:#64748b">${companyName}</p>
      </div>
    `,
  });

  return { sent: true, message: `Buyer form link sent to ${recipientEmail}.` };
};

export const getBuyerFormState = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || '').trim());
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    await assertBuyerFormSchema(connection);
    const listing = await getListingForAdmin(
      connection,
      project.lot_project_id,
      String(req.params.listingId || '').trim()
    );
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const state = await getBuyerFormAdminState(connection, listing.lot_project_listing_id);
    return res.json({ success: true, data: { listing, ...state } });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const createBuyerFormLink = async (req, res) => {
  const connection = await db.getConnection();
  let emailResult = null;

  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || '').trim());
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    await assertBuyerFormSchema(connection);
    await connection.beginTransaction();

    const listing = await getListingForAdmin(
      connection,
      project.lot_project_id,
      String(req.params.listingId || '').trim(),
      { lock: true }
    );
    if (!listing) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (String(listing.lot_project_listing_status).toLowerCase() !== 'available') {
      await connection.rollback();
      return res.status(400).json({ message: 'A buyer form link can only be created for an available unit.' });
    }

    await expireBuyerFormLinks(connection, listing.lot_project_listing_id);
    await revokeOpenBuyerFormLinks(connection, listing.lot_project_listing_id, { status: 'superseded' });

    const nextGeneration = Number(listing.buyer_form_generation || 0) + 1;
    await connection.query(
      `
        UPDATE lot_project_listings
        SET buyer_form_generation = ?,
            pending_buyer_form_submission_id = NULL
        WHERE lot_project_listing_id = ?
      `,
      [nextGeneration, listing.lot_project_listing_id]
    );

    const token = createBuyerFormToken();
    const tokenHash = hashBuyerFormToken(token);
    const expirationHours = clampExpirationHours(req.body.expiresHours);
    const recipientEmail = safeEmail(req.body.recipientEmail);
    const recipientMobileNumber = safePhone(req.body.recipientMobileNumber);

    const [insertResult] = await connection.query(
      `
        INSERT INTO lot_project_buyer_form_links (
          lot_project_id,
          lot_project_listing_id,
          token_hash,
          generation_number,
          link_status,
          expires_at,
          generated_by_user_id,
          generated_at,
          recipient_email,
          recipient_mobile_number
        ) VALUES (?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL ? HOUR), ?, NOW(), ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        tokenHash,
        nextGeneration,
        expirationHours,
        req.authUser?.id || null,
        recipientEmail || null,
        recipientMobileNumber || null,
      ]
    );

    const [[createdLink]] = await connection.query(
      `
        SELECT
          lot_project_buyer_form_link_id AS id,
          link_status AS status,
          generation_number AS generation,
          expires_at AS expiresAt,
          generated_at AS generatedAt,
          recipient_email AS recipientEmail,
          recipient_mobile_number AS recipientMobileNumber
        FROM lot_project_buyer_form_links
        WHERE lot_project_buyer_form_link_id = ?
      `,
      [insertResult.insertId]
    );

    const publicUrl = getPublicBuyerFormUrl(req, token);

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Buyer Forms',
      entityType: 'lot_project_buyer_form_link',
      entityId: String(insertResult.insertId),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${project.lot_project_name}`,
      title: 'Generated buyer form link',
      description: `Generated a new buyer form link for ${listing.lot_project_listing_unit_id}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        generation: nextGeneration,
        expiresHours: expirationHours,
        recipientEmail: recipientEmail || null,
        recipientMobileNumber: recipientMobileNumber || null,
      },
    });

    await connection.commit();

    if (req.body.sendEmail && recipientEmail) {
      try {
        emailResult = await sendBuyerFormEmail({
          recipientEmail,
          publicUrl,
          projectName: project.lot_project_name,
          unitId: listing.lot_project_listing_unit_id,
          expiresAt: createdLink.expiresAt,
        });
      } catch (emailError) {
        emailResult = { sent: false, message: `Link created, but email failed: ${emailError.message}` };
      }
    }

    return res.status(201).json({
      success: true,
      message: emailResult?.sent
        ? emailResult.message
        : 'Buyer form link created. Copy it now; the raw token is not stored and cannot be shown again.',
      data: {
        link: createdLink,
        publicUrl,
        email: emailResult,
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const revokeBuyerFormLink = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || '').trim());
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    await assertBuyerFormSchema(connection);
    await connection.beginTransaction();
    const listing = await getListingForAdmin(
      connection,
      project.lot_project_id,
      String(req.params.listingId || '').trim(),
      { lock: true }
    );
    if (!listing) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const linkId = Number(req.params.linkId || 0);
    const [result] = await connection.query(
      `
        UPDATE lot_project_buyer_form_links
        SET link_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
        WHERE lot_project_buyer_form_link_id = ?
          AND lot_project_listing_id = ?
          AND link_status IN ('active', 'opened')
      `,
      [linkId, listing.lot_project_listing_id]
    );

    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(400).json({ message: 'The buyer form link is no longer active.' });
    }

    await connection.query(
      `UPDATE lot_project_listings SET buyer_form_generation = buyer_form_generation + 1 WHERE lot_project_listing_id = ?`,
      [listing.lot_project_listing_id]
    );

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Buyer Forms',
      entityType: 'lot_project_buyer_form_link',
      entityId: String(linkId),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${project.lot_project_name}`,
      title: 'Revoked buyer form link',
      description: `Revoked the buyer form link for ${listing.lot_project_listing_unit_id}.`,
      metadata: { listingId: listing.lot_project_listing_id },
    });

    await connection.commit();
    return res.json({ success: true, message: 'Buyer form link revoked.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const rejectBuyerFormSubmission = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const project = await getProjectBySlug(String(req.params.projectSlug || '').trim());
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });

    await assertBuyerFormSchema(connection);
    await connection.beginTransaction();

    const listing = await getListingForAdmin(
      connection,
      project.lot_project_id,
      String(req.params.listingId || '').trim(),
      { lock: true }
    );
    if (!listing) {
      await connection.rollback();
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const submissionId = Number(req.params.submissionId || 0);
    const [[submission]] = await connection.query(
      `
        SELECT *
        FROM lot_project_buyer_form_submissions
        WHERE lot_project_buyer_form_submission_id = ?
          AND lot_project_listing_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [submissionId, listing.lot_project_listing_id]
    );

    if (!submission || !['submitted', 'pending_review'].includes(submission.submission_status)) {
      await connection.rollback();
      return res.status(400).json({ message: 'The buyer form submission is no longer pending review.' });
    }

    const reason = safeReason(req.body.reason) || 'Rejected by admin.';
    await connection.query(
      `
        UPDATE lot_project_buyer_form_submissions
        SET submission_status = 'rejected',
            reviewed_by_user_id = ?,
            reviewed_at = NOW(),
            rejected_at = NOW(),
            rejection_reason = ?,
            updated_at = NOW()
        WHERE lot_project_buyer_form_submission_id = ?
      `,
      [req.authUser?.id || null, reason, submissionId]
    );

    await connection.query(
      `
        UPDATE lot_project_buyer_form_links
        SET link_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
        WHERE lot_project_buyer_form_link_id = ?
      `,
      [submission.lot_project_buyer_form_link_id]
    );

    if (Number(listing.pending_buyer_form_submission_id || 0) === submissionId) {
      await connection.query(
        `
          UPDATE lot_project_listings
          SET lot_project_listing_status = 'available',
              lot_project_listing_sold_substatus = NULL,
              hold_client_name = NULL,
              hold_note = NULL,
              hold_created_at = NULL,
              hold_created_by_user_id = NULL,
              pending_buyer_form_submission_id = NULL,
              buyer_form_generation = buyer_form_generation + 1
          WHERE lot_project_listing_id = ?
        `,
        [listing.lot_project_listing_id]
      );
    }

    await writeAuditLog(connection, req, {
      action: 'reject',
      module: 'Buyer Forms',
      entityType: 'lot_project_buyer_form_submission',
      entityId: String(submissionId),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${submission.buyer_full_name}`,
      title: 'Rejected buyer form submission',
      description: `Rejected the buyer form submission for ${listing.lot_project_listing_unit_id}.`,
      metadata: { reason, listingId: listing.lot_project_listing_id },
    });

    await connection.commit();
    return res.json({ success: true, message: 'Submission rejected and the unit returned to available.' });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

const getPublicLinkRecord = async (connection, tokenHash, { lock = false } = {}) => {
  const [rows] = await connection.query(
    `
      SELECT
        link.lot_project_buyer_form_link_id,
        link.lot_project_id,
        link.lot_project_listing_id,
        link.generation_number,
        link.link_status,
        link.expires_at,
        link.submitted_at,
        l.lot_project_listing_unit_id,
        l.lot_project_listing_status,
        l.lot_project_listing_area_sqm,
        l.lot_project_listing_tcp,
        l.buyer_form_generation,
        l.pending_buyer_form_submission_id,
        p.lot_project_name,
        p.lot_project_location,
        p.lot_project_slug
      FROM lot_project_buyer_form_links link
      INNER JOIN lot_project_listings l
        ON l.lot_project_listing_id = link.lot_project_listing_id
      INNER JOIN lot_projects p
        ON p.lot_project_id = link.lot_project_id
      WHERE link.token_hash = ?
      LIMIT 1
      ${lock ? 'FOR UPDATE' : ''}
    `,
    [tokenHash]
  );
  return rows[0] || null;
};

const publicLinkError = (record) => {
  if (!record) return { status: 404, message: 'This buyer form link is invalid.' };
  if (record.link_status === 'submitted' || record.link_status === 'consumed') {
    return { status: 409, message: 'This buyer form was already submitted.' };
  }
  if (!['active', 'opened'].includes(record.link_status)) {
    return { status: 410, message: 'This buyer form link is no longer active.' };
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    return { status: 410, message: 'This buyer form link has expired.' };
  }
  if (Number(record.generation_number) !== Number(record.buyer_form_generation)) {
    return { status: 410, message: 'This buyer form link was replaced by a newer link.' };
  }
  if (String(record.lot_project_listing_status).toLowerCase() !== 'available') {
    return { status: 409, message: 'This unit is no longer available.' };
  }
  return null;
};

export const getPublicBuyerForm = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await assertBuyerFormSchema(connection);
    const token = String(req.params.token || '').trim();
    if (!token || token.length > 200) return res.status(404).json({ message: 'This buyer form link is invalid.' });

    const tokenHash = hashBuyerFormToken(token);
    const record = await getPublicLinkRecord(connection, tokenHash);

    if (record && ['submitted', 'consumed'].includes(record.link_status)) {
      return res.json({
        success: true,
        data: {
          alreadySubmitted: true,
          projectName: record.lot_project_name,
          projectLocation: record.lot_project_location,
          projectSlug: record.lot_project_slug,
          unitId: record.lot_project_listing_unit_id,
          submittedAt: record.submitted_at,
        },
      });
    }

    const error = publicLinkError(record);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    await connection.query(
      `
        UPDATE lot_project_buyer_form_links
        SET link_status = 'opened',
            first_opened_at = COALESCE(first_opened_at, NOW()),
            last_opened_at = NOW(),
            updated_at = NOW()
        WHERE lot_project_buyer_form_link_id = ?
          AND link_status IN ('active', 'opened')
      `,
      [record.lot_project_buyer_form_link_id]
    );

    return res.json({
      success: true,
      data: {
        projectName: record.lot_project_name,
        projectLocation: record.lot_project_location,
        projectSlug: record.lot_project_slug,
        unitId: record.lot_project_listing_unit_id,
        areaSqm: Number(record.lot_project_listing_area_sqm || 0),
        tcp: Number(record.lot_project_listing_tcp || 0),
        expiresAt: record.expires_at,
      },
    });
  } catch (error) {
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const submitPublicBuyerForm = async (req, res) => {
  const connection = await db.getConnection();
  try {
    if (String(req.body.website || '').trim()) {
      return res.status(400).json({ message: 'The form could not be submitted.' });
    }
    if (req.body.privacyConsent !== true) {
      return res.status(400).json({ message: 'Privacy consent is required.' });
    }

    const validation = validateBuyerProfilePayload(req.body.clientProfile || req.body);
    if (!validation.ok) return res.status(400).json({ message: validation.message, field: validation.field });

    await assertBuyerFormSchema(connection);
    const token = String(req.params.token || '').trim();
    if (!token || token.length > 200) return res.status(404).json({ message: 'This buyer form link is invalid.' });

    const tokenHash = hashBuyerFormToken(token);
    await connection.beginTransaction();
    const record = await getPublicLinkRecord(connection, tokenHash, { lock: true });
    const linkError = publicLinkError(record);
    if (linkError) {
      await connection.rollback();
      return res.status(linkError.status).json({ success: false, message: linkError.message });
    }

    const profile = sanitizeBuyerProfilePayload(validation.profile);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 255) || null;
    const [insertResult] = await connection.query(
      `
        INSERT INTO lot_project_buyer_form_submissions (
          lot_project_buyer_form_link_id,
          lot_project_id,
          lot_project_listing_id,
          submission_status,
          buyer_full_name,
          buyer_email,
          buyer_contact_number,
          buyer_type,
          submitted_payload_json,
          privacy_consent_at,
          submission_ip,
          submission_user_agent,
          submitted_at
        ) VALUES (?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())
      `,
      [
        record.lot_project_buyer_form_link_id,
        record.lot_project_id,
        record.lot_project_listing_id,
        profile.buyerName,
        profile.email || null,
        profile.contactNo || null,
        profile.buyerType,
        JSON.stringify(profile),
        getRequestIp(req),
        userAgent,
      ]
    );

    const submissionId = Number(insertResult.insertId);
    await connection.query(
      `
        UPDATE lot_project_buyer_form_links
        SET link_status = 'submitted', submitted_at = NOW(), updated_at = NOW()
        WHERE lot_project_buyer_form_link_id = ?
      `,
      [record.lot_project_buyer_form_link_id]
    );

    const [listingUpdateResult] = await connection.query(
      `
        UPDATE lot_project_listings
        SET lot_project_listing_status = 'hold',
            lot_project_listing_sold_substatus = NULL,
            hold_client_name = ?,
            hold_note = 'Buyer form submitted — pending admin review',
            hold_created_at = NOW(),
            hold_created_by_user_id = NULL,
            pending_buyer_form_submission_id = ?
        WHERE lot_project_listing_id = ?
          AND lot_project_listing_status = 'available'
      `,
      [profile.buyerName, submissionId, record.lot_project_listing_id]
    );

    if (!listingUpdateResult.affectedRows) {
      const error = new Error('This unit is no longer available.');
      error.statusCode = 409;
      throw error;
    }

    await writeAuditLog(connection, req, {
      actorName: profile.buyerName,
      actorEmail: profile.email || null,
      actorRole: 'public_buyer',
      action: 'create',
      module: 'Buyer Forms',
      entityType: 'lot_project_buyer_form_submission',
      entityId: String(submissionId),
      entityLabel: `Unit ${record.lot_project_listing_unit_id} — ${profile.buyerName}`,
      title: 'Buyer submitted information form',
      description: `${profile.buyerName} submitted buyer information for ${record.lot_project_listing_unit_id}.`,
      metadata: {
        listingId: record.lot_project_listing_id,
        linkId: record.lot_project_buyer_form_link_id,
        buyerType: profile.buyerType,
      },
    });

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: 'Your buyer information was submitted. The unit is temporarily held while D&C Prime Realty reviews the reservation.',
      data: {
        submissionId,
        unitId: record.lot_project_listing_unit_id,
        status: 'pending_review',
      },
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This buyer form was already submitted.' });
    }
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const resetBuyerFormDataForAvailable = resetBuyerFormsForAvailable;
export const supersedeBuyerFormLinks = revokeOpenBuyerFormLinks;
export const readBuyerFormStateForProfile = getBuyerFormAdminState;
export const decodeBuyerSubmissionPayload = parseJsonObject;

