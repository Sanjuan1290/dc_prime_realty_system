const LOCALHOST_IPV6 = new Set(['::1', '0:0:0:0:0:0:0:1']);

export const normalizeIpAddress = (value) => {
  let address = String(value || '').trim();
  if (!address) return null;

  // Express may return an IPv4 address in IPv6-mapped form.
  if (address.toLowerCase().startsWith('::ffff:')) address = address.slice(7);
  if (LOCALHOST_IPV6.has(address.toLowerCase())) address = '127.0.0.1';

  // Remove an IPv6 interface zone id, which is local-machine information.
  const zoneIndex = address.indexOf('%');
  if (zoneIndex > 0) address = address.slice(0, zoneIndex);

  return address.slice(0, 45) || null;
};

export const getRequestIpAddress = (req = {}) => normalizeIpAddress(
  req.ip
    || req.socket?.remoteAddress
    || req.connection?.remoteAddress
    || null
);

export const parseTrustProxySetting = (value = '') => {
  const setting = String(value || '').trim();
  if (!setting || ['0', 'false', 'off', 'no'].includes(setting.toLowerCase())) return false;
  if (['true', 'on', 'yes'].includes(setting.toLowerCase())) return 1;

  // A numeric value is the number of trusted proxy hops. For a typical Nginx
  // deployment use TRUST_PROXY=1. This is safer than trusting arbitrary headers.
  if (/^\d+$/.test(setting)) return Number(setting);

  if (setting.includes(',')) {
    return setting.split(',').map((entry) => entry.trim()).filter(Boolean);
  }

  return setting;
};
