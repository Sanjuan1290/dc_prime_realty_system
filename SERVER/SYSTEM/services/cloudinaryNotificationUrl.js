export const resolveMalwareNotificationUrl = (env = process.env) => {
  const configured = String(env.CLOUDINARY_MALWARE_NOTIFICATION_URL || '').trim();
  const runtime = String(env.RENDER_EXTERNAL_URL || '').trim();
  if (!runtime) return configured;
  try {
    const origin = new URL(runtime);
    const callback = configured ? new URL(configured) : null;
    // This retired host no longer serves the API. Render supplies the current
    // service URL, so old environment values cannot keep breaking callbacks.
    if (!callback || callback.hostname === 'dc-prime-realty-api.onrender.com') {
      if (origin.protocol === 'https:' && origin.hostname.endsWith('.onrender.com'))
        return new URL('/api/v1/webhooks/cloudinary/malware', origin).href;
    }
  } catch { /* Retain explicit configuration if runtime metadata is invalid. */ }
  return configured;
};
