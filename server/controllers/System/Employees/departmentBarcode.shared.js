export const DEFAULT_EMPLOYEE_DEPARTMENT_CODES = Object.freeze([
  { name: 'Administration', prefix: 'ADM' },
  { name: 'Accounting', prefix: 'ACC' },
  { name: 'IT', prefix: 'IT' },
  { name: 'Sales', prefix: 'SLS' },
  { name: 'Marketing', prefix: 'MKT' },
  { name: 'Operations', prefix: 'OPS' },
]);

const clean = (value) => String(value ?? '').trim();

export const normalizeDepartmentName = (value) => clean(value).replace(/\s+/g, ' ').slice(0, 120);

export const normalizeBarcodePrefix = (value) => clean(value)
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')
  .slice(0, 8);

export const deriveDepartmentPrefix = (department) => {
  const name = normalizeDepartmentName(department);
  if (!name) return '';
  const known = DEFAULT_EMPLOYEE_DEPARTMENT_CODES.find((item) => item.name.toLowerCase() === name.toLowerCase());
  if (known) return known.prefix;

  const words = name.toUpperCase().match(/[A-Z0-9]+/g) || [];
  if (words.length > 1) return normalizeBarcodePrefix(words.map((word) => word[0]).join('')) || 'DEP';
  const single = words[0] || 'DEP';
  return normalizeBarcodePrefix(single.slice(0, 3)) || 'DEP';
};

const parseJson = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const normalizeDepartmentConfigs = (rawConfigs, rawLegacyDepartments = []) => {
  const parsedConfigs = parseJson(rawConfigs);
  const legacyDepartments = parseJson(rawLegacyDepartments)
    .map((value) => normalizeDepartmentName(typeof value === 'string' ? value : value?.name))
    .filter(Boolean);

  const source = parsedConfigs.length
    ? parsedConfigs
    : [...DEFAULT_EMPLOYEE_DEPARTMENT_CODES.map((item) => item.name), ...legacyDepartments];

  const configs = [];
  const names = new Set();
  const prefixes = new Set();

  for (const item of source) {
    const name = normalizeDepartmentName(typeof item === 'string' ? item : item?.name);
    if (!name || names.has(name.toLowerCase())) continue;

    let prefix = normalizeBarcodePrefix(typeof item === 'string' ? '' : item?.prefix) || deriveDepartmentPrefix(name);
    if (!prefix) continue;

    if (prefixes.has(prefix)) {
      const base = prefix.slice(0, 6) || 'DEP';
      let suffix = 2;
      while (prefixes.has(`${base}${suffix}`) && suffix < 100) suffix += 1;
      prefix = `${base}${suffix}`.slice(0, 8);
    }

    names.add(name.toLowerCase());
    prefixes.add(prefix);
    configs.push({ name, prefix });
  }

  return configs.length ? configs.slice(0, 100) : DEFAULT_EMPLOYEE_DEPARTMENT_CODES.map((item) => ({ ...item }));
};

export const validateDepartmentConfigs = (rawConfigs) => {
  const source = Array.isArray(rawConfigs) ? rawConfigs : [];
  if (!source.length) {
    const error = new Error('At least one employee department is required.');
    error.statusCode = 400;
    throw error;
  }

  const configs = [];
  const names = new Set();
  const prefixes = new Set();

  for (const item of source) {
    const name = normalizeDepartmentName(item?.name);
    const prefix = normalizeBarcodePrefix(item?.prefix);
    if (!name || !prefix) {
      const error = new Error('Each employee department needs both a department name and Employee Code prefix.');
      error.statusCode = 400;
      throw error;
    }
    if (!/^[A-Z0-9]{1,8}$/.test(prefix)) {
      const error = new Error(`Employee Code prefix for ${name} must use 1 to 8 letters or numbers only.`);
      error.statusCode = 400;
      throw error;
    }
    if (names.has(name.toLowerCase())) {
      const error = new Error(`Department ${name} is listed more than once.`);
      error.statusCode = 400;
      throw error;
    }
    if (prefixes.has(prefix)) {
      const error = new Error(`Employee Code prefix ${prefix} is already used by another department.`);
      error.statusCode = 400;
      throw error;
    }
    names.add(name.toLowerCase());
    prefixes.add(prefix);
    configs.push({ name, prefix });
  }

  return configs.slice(0, 100);
};
