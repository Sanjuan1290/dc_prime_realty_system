const clean = (value) => String(value ?? '').trim();

const EMAIL_API_URL = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 15_000;

const getRequestTimeoutMs = () => {
  const configured = Number(process.env.EMAIL_REQUEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.max(5_000, Math.min(configured, 60_000));
};

const normalizeRecipients = (value) => {
  const recipients = Array.isArray(value) ? value : [value];
  return recipients.map(clean).filter(Boolean);
};

const normalizeAttachment = (attachment = {}) => {
  const filename = clean(attachment.filename || attachment.name);
  if (!filename) {
    const error = new Error('Email attachment filename is required.');
    error.statusCode = 500;
    throw error;
  }

  const path = clean(attachment.path);
  if (path) return { filename, path };

  const rawContent = attachment.content;
  if (rawContent === undefined || rawContent === null) {
    const error = new Error(`Email attachment content is missing for ${filename}.`);
    error.statusCode = 500;
    throw error;
  }

  let content;
  if (Buffer.isBuffer(rawContent)) {
    content = rawContent.toString('base64');
  } else if (rawContent instanceof Uint8Array) {
    content = Buffer.from(rawContent).toString('base64');
  } else if (rawContent instanceof ArrayBuffer) {
    content = Buffer.from(rawContent).toString('base64');
  } else {
    content = clean(rawContent);
  }

  if (!content) {
    const error = new Error(`Email attachment content is empty for ${filename}.`);
    error.statusCode = 500;
    throw error;
  }

  return { filename, content };
};

export const isResendConfigured = () => Boolean(
  clean(process.env.RESEND_API_KEY)
  && clean(process.env.EMAIL_FROM)
);

export const assertResendConfigured = () => {
  const missing = ['RESEND_API_KEY', 'EMAIL_FROM'].filter((key) => !clean(process.env[key]));
  if (!missing.length) return;

  const error = new Error(`Email is unavailable. Configure Resend: ${missing.join(', ')}.`);
  error.statusCode = 503;
  error.code = 'RESEND_NOT_CONFIGURED';
  throw error;
};

export const getEmailFromAddress = () => {
  const from = clean(process.env.EMAIL_FROM);
  const angleMatch = from.match(/<([^<>]+)>\s*$/);
  return clean(angleMatch?.[1] || from);
};

export const getCompanyContactEmail = (fallback = 'dcprimerealty@gmail.com') => (
  clean(process.env.COMPANY_EMAIL)
  || getEmailFromAddress()
  || clean(fallback)
);

export const sendEmail = async ({
  to,
  subject,
  text = '',
  html = '',
  attachments = [],
  cc,
  bcc,
  replyTo,
  idempotencyKey,
} = {}) => {
  assertResendConfigured();

  const recipients = normalizeRecipients(to);
  if (!recipients.length) {
    const error = new Error('At least one email recipient is required.');
    error.statusCode = 400;
    throw error;
  }

  const cleanSubject = clean(subject);
  if (!cleanSubject) {
    const error = new Error('Email subject is required.');
    error.statusCode = 500;
    throw error;
  }

  const payload = {
    from: clean(process.env.EMAIL_FROM),
    to: recipients,
    subject: cleanSubject,
    text: String(text ?? ''),
    html: String(html ?? ''),
  };

  const normalizedCc = normalizeRecipients(cc || []);
  const normalizedBcc = normalizeRecipients(bcc || []);
  const normalizedReplyTo = normalizeRecipients(replyTo || []);
  if (normalizedCc.length) payload.cc = normalizedCc;
  if (normalizedBcc.length) payload.bcc = normalizedBcc;
  if (normalizedReplyTo.length) payload.reply_to = normalizedReplyTo;
  if (Array.isArray(attachments) && attachments.length) {
    payload.attachments = attachments.map(normalizeAttachment);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  try {
    const response = await fetch(EMAIL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clean(process.env.RESEND_API_KEY)}`,
        'Content-Type': 'application/json',
        'User-Agent': 'dc-prime-realty/1.0',
        ...(clean(idempotencyKey) ? { 'Idempotency-Key': clean(idempotencyKey) } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        clean(result?.message)
        || clean(result?.error?.message)
        || `Resend rejected the email request with status ${response.status}.`
      );
      error.statusCode = 502;
      error.code = 'RESEND_SEND_FAILED';
      error.providerStatus = response.status;
      throw error;
    }

    return result;
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('Resend took too long to respond. Please try again.');
      timeoutError.statusCode = 504;
      timeoutError.code = 'RESEND_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
