import {
  getRequiredParentRole,
  isGroupHeadRole,
  SELLER_ROLE_LABELS,
} from './sellerHierarchyRules.js';

export const NETWORK_MEMBER_IMPORT_MAX_ROWS = 2000;

export const NETWORK_MEMBER_IMPORT_ROLES = Object.freeze([
  'division_manager',
  'sales_director',
  'unit_manager',
  'sales_agent',
]);

export const NETWORK_MEMBER_IMPORT_ROLE_ORDER = Object.freeze({
  division_manager: 0,
  sales_director: 1,
  unit_manager: 2,
  sales_agent: 3,
});

const ROLE_ALIASES = new Map([
  ['division manager', 'division_manager'],
  ['division_manager', 'division_manager'],
  ['divisionmanager', 'division_manager'],
  ['dm', 'division_manager'],
  ['sales director', 'sales_director'],
  ['sales_director', 'sales_director'],
  ['salesdirector', 'sales_director'],
  ['sd', 'sales_director'],
  ['unit manager', 'unit_manager'],
  ['unit_manager', 'unit_manager'],
  ['unitmanager', 'unit_manager'],
  ['um', 'unit_manager'],
  ['sales agent', 'sales_agent'],
  ['sales_agent', 'sales_agent'],
  ['salesagent', 'sales_agent'],
  ['sa', 'sales_agent'],
  ['agent', 'sales_agent'],
]);

const cleanText = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
export const normalizeNetworkMemberImportEmail = (value) => cleanText(value).toLowerCase();
export const normalizeNetworkMemberImportFullName = (value) => cleanText(value).toLowerCase();

const pick = (row, keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return '';
};

const normalizeRole = (value) => {
  const key = cleanText(value).toLowerCase().replace(/[-]+/g, ' ');
  const compactKey = key.replace(/[\s_-]+/g, '');
  const compactAliases = {
    dm: 'division_manager',
    divisionmanager: 'division_manager',
    sd: 'sales_director',
    salesdirector: 'sales_director',
    um: 'unit_manager',
    unitmanager: 'unit_manager',
    sa: 'sales_agent',
    salesagent: 'sales_agent',
    agent: 'sales_agent',
  };
  return ROLE_ALIASES.get(key) || ROLE_ALIASES.get(key.replace(/\s+/g, '_')) || compactAliases[compactKey] || '';
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));

export const normalizeNetworkMemberImportRows = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, NETWORK_MEMBER_IMPORT_MAX_ROWS + 1).map((row, index) => ({
    sourceRow: Number(pick(row, ['source_row', 'sourceRow', '_row_number', 'row_number'])) || index + 2,
    firstName: cleanText(pick(row, ['first_name', 'firstName', 'First Name'])),
    middleName: cleanText(pick(row, ['middle_name', 'middleName', 'Middle Name'])),
    lastName: cleanText(pick(row, ['last_name', 'lastName', 'Last Name'])),
    email: normalizeNetworkMemberImportEmail(pick(row, ['email', 'Email'])),
    contactNumber: cleanText(pick(row, ['contact_no', 'contact_number', 'contactNumber', 'Contact Number'])),
    role: normalizeRole(pick(row, ['role', 'Role'])),
    roleRaw: cleanText(pick(row, ['role', 'Role'])),
    reportsUnderEmail: normalizeNetworkMemberImportEmail(pick(row, ['reports_under_email', 'reportsUnderEmail', 'Reports Under Email'])),
    tinNo: cleanText(pick(row, ['tin_no', 'tin', 'tinNo', 'TIN'])),
    prcNo: cleanText(pick(row, ['prc_no', 'prc_number', 'prcNo', 'PRC Number'])),
  }));
};

const accountName = (account = {}) =>
  cleanText([account.first_name, account.middle_name, account.last_name].filter(Boolean).join(' ')) || account.email || 'Seller';

const currentMemberName = (member = {}) => member.full_name || accountName(member);

/**
 * Pure import analyzer used by both Preview and Confirm Import. Database writes
 * must only proceed when this function returns canCommit=true. The server calls
 * it again inside the commit transaction so a stale browser preview cannot
 * bypass Network/hierarchy rules.
 */
export const analyzeNetworkMemberImport = ({
  rows = [],
  group = {},
  existingAccounts = [],
  currentMembers = [],
} = {}) => {
  const normalizedRows = normalizeNetworkMemberImportRows(rows);
  const groupId = Number(group.seller_group_id || group.id || 0);
  const groupType = String(group.seller_group_type || group.type || '');
  const groupStatus = String(group.seller_group_status || group.status || 'active');
  const headUserId = Number(group.seller_group_head_user_id || group.headUserId || 0);

  const accountBuckets = new Map();
  existingAccounts.forEach((account) => {
    const email = normalizeNetworkMemberImportEmail(account.email);
    if (!email) return;
    if (!accountBuckets.has(email)) accountBuckets.set(email, []);
    accountBuckets.get(email).push(account);
  });

  const currentMemberByEmail = new Map();
  const currentMembersByFullName = new Map();
  currentMembers.forEach((member) => {
    const email = normalizeNetworkMemberImportEmail(member.email);
    if (email) currentMemberByEmail.set(email, member);

    const normalizedFullName = normalizeNetworkMemberImportFullName(currentMemberName(member));
    if (normalizedFullName) {
      if (!currentMembersByFullName.has(normalizedFullName)) currentMembersByFullName.set(normalizedFullName, []);
      currentMembersByFullName.get(normalizedFullName).push(member);
    }
  });
  const headMember = currentMembers.find((member) => Number(member.user_id) === headUserId) || null;

  const duplicateCounts = new Map();
  const duplicateFullNameRows = new Map();
  normalizedRows.forEach((row) => {
    if (row.email) duplicateCounts.set(row.email, (duplicateCounts.get(row.email) || 0) + 1);

    const displayName = cleanText([row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '));
    const normalizedFullName = normalizeNetworkMemberImportFullName(displayName);
    if (normalizedFullName) {
      if (!duplicateFullNameRows.has(normalizedFullName)) duplicateFullNameRows.set(normalizedFullName, []);
      duplicateFullNameRows.get(normalizedFullName).push({
        sourceRow: row.sourceRow,
        email: row.email,
        displayName,
      });
    }
  });

  const analyzedRows = normalizedRows.map((row) => {
    const errors = [];
    const warnings = [];
    const accounts = accountBuckets.get(row.email) || [];
    const sellerAccounts = accounts.filter((account) => NETWORK_MEMBER_IMPORT_ROLES.includes(String(account.role || '')));
    const nonSellerAccounts = accounts.filter((account) => !NETWORK_MEMBER_IMPORT_ROLES.includes(String(account.role || '')));
    const activeNonSellerAccounts = nonSellerAccounts.filter((account) => String(account.user_status || '') === 'active');
    const sharedPersonKeys = [...new Set(nonSellerAccounts.map((account) => String(account.person_key || '').trim()).filter(Boolean))];
    const existing = sellerAccounts.length === 1 ? sellerAccounts[0] : null;
    const sourcePersonAccount = !existing && nonSellerAccounts.length
      ? (activeNonSellerAccounts.length === 1
          ? activeNonSellerAccounts[0]
          : sharedPersonKeys.length === 1
            ? [...nonSellerAccounts].sort((a, b) => Number(b.user_id || 0) - Number(a.user_id || 0))[0]
            : nonSellerAccounts.length === 1
              ? nonSellerAccounts[0]
              : null)
      : null;
    let action = 'CREATE';

    if (!row.firstName) errors.push('First Name is required.');
    if (!row.lastName) errors.push('Last Name is required.');
    if (!row.email) errors.push('Email is required.');
    else if (!isEmail(row.email)) errors.push('Enter a valid email address.');
    if (!row.role) errors.push(`Role must be DM, SD, UM, or SA${row.roleRaw ? ` (received “${row.roleRaw}”)` : ''}.`);
    if (row.email && (duplicateCounts.get(row.email) || 0) > 1) errors.push('Email appears more than once in this Excel file. Each imported seller must use a unique email.');

    const displayName = cleanText([row.firstName, row.middleName, row.lastName].filter(Boolean).join(' '));
    const normalizedFullName = normalizeNetworkMemberImportFullName(displayName);
    const matchingImportNames = normalizedFullName ? (duplicateFullNameRows.get(normalizedFullName) || []) : [];
    if (matchingImportNames.length > 1) {
      const otherRows = matchingImportNames
        .filter((item) => Number(item.sourceRow) !== Number(row.sourceRow))
        .map((item) => `Row ${item.sourceRow}${item.email ? ` (${item.email})` : ''}`);
      errors.push(`Full Name “${displayName}” is duplicated in this Excel file${otherRows.length ? `: ${otherRows.join(', ')}` : ''}. Each imported seller must have a unique full name.`);
    }

    if (normalizedFullName) {
      const conflictingMembers = (currentMembersByFullName.get(normalizedFullName) || [])
        .filter((member) => normalizeNetworkMemberImportEmail(member.email) !== row.email);
      if (conflictingMembers.length) {
        const conflicts = conflictingMembers
          .slice(0, 3)
          .map((member) => `${currentMemberName(member)}${member.email ? ` (${normalizeNetworkMemberImportEmail(member.email)})` : ''}`)
          .join(', ');
        errors.push(`Full Name “${displayName}” already belongs to another Accredited Seller in this Network: ${conflicts}. Use a different full name or verify the existing seller record before importing.`);
      }
    }

    if (sellerAccounts.length > 1) errors.push('Multiple seller identities use this email. Resolve the duplicate seller accounts before importing.');
    if (!existing && nonSellerAccounts.length > 1 && !sourcePersonAccount) {
      errors.push('Multiple unrelated non-seller accounts use this email. Resolve the duplicate person records before importing.');
    }

    if (existing) {
      const existingRole = String(existing.role || '');
      const existingGroupId = Number(existing.seller_group_id || 0);
      const sellerStatus = String(existing.accredited_seller_status || 'inactive');

      if (Number(existing.is_system_dummy || 0) === 1) {
        errors.push('System-generated seller accounts cannot be changed through Excel import.');
      } else {
        if (row.role && row.role !== existingRole) {
          errors.push(`Existing seller role is ${SELLER_ROLE_LABELS[existingRole] || existingRole}. Bulk import cannot change seller roles; use Edit Member first.`);
        }
        if (existingGroupId && existingGroupId !== groupId && sellerStatus === 'active') {
          errors.push(`This seller is Active in ${existing.seller_group_name || 'another Network'}. Set the seller Inactive there before transferring.`);
        }
        if (existingGroupId && existingGroupId !== groupId && Number(existing.headed_group_id || 0)) {
          errors.push('This seller is the hierarchy head of another Network. Assign a different head before transferring the seller.');
        }
        if (existingGroupId && existingGroupId !== groupId && Number(existing.direct_report_count || 0) > 0) {
          errors.push('This seller still has members reporting under them in another Network. Reassign those members before transferring.');
        }

        if (!existing.accredited_seller_id) {
          action = 'UPDATE';
          warnings.push('An existing seller-role account was found. Seller accreditation will be added without creating another login account.');
        } else if (existingGroupId === groupId) {
          action = 'UPDATE';
          warnings.push('Existing member will be updated and kept Active. Blank optional fields will preserve current values.');
        } else if (sellerStatus !== 'active') {
          action = existingGroupId ? 'TRANSFER' : 'UPDATE';
          warnings.push(existingGroupId
            ? `Inactive seller will be transferred from ${existing.seller_group_name || 'the previous Network'} and reactivated.`
            : 'Inactive seller account will be activated and assigned to this Network.');
        }
      }
    } else if (sourcePersonAccount) {
      const sourceRole = String(sourcePersonAccount.role || '');
      if (sourceRole === 'external_group' || String(sourcePersonAccount.account_category || '') === 'external') {
        errors.push('This email belongs to an External Network account and cannot also be used as an In-House seller identity.');
      } else if (Number(sourcePersonAccount.is_system_account || 0) === 1) {
        errors.push('This email belongs to a protected system-generated account and cannot be used for seller accreditation.');
      } else {
        warnings.push('Existing employee/system account will be preserved. A separate seller identity will be created for Network hierarchy and commissions.');
      }
    }

    const isCurrentHead = Boolean(existing && headUserId && Number(existing.user_id) === headUserId);
    if (row.role === 'division_manager' && !isCurrentHead) {
      errors.push(headUserId
        ? `This Network already has ${currentMemberName(headMember)} as its hierarchy head. Excel import cannot add or replace the Division Manager head.`
        : 'Assign the Network hierarchy head through Add Member/Edit Network before using Excel import.');
    }
    if (isCurrentHead && row.role && String(existing.role || '') !== row.role) {
      errors.push('Excel import cannot change the Network hierarchy head role.');
    }
    if (isCurrentHead && row.reportsUnderEmail) {
      errors.push('The Network hierarchy head must leave Reports Under Email blank.');
    }

    return {
      ...row,
      action,
      existingUserId: existing ? Number(existing.user_id) : null,
      existingAccreditedSellerId: existing ? Number(existing.accredited_seller_id || 0) || null : null,
      existingGroupId: existing ? Number(existing.seller_group_id || 0) || null : null,
      sourcePersonUserId: sourcePersonAccount ? Number(sourcePersonAccount.user_id || 0) || null : null,
      sourcePersonKey: sourcePersonAccount?.person_key || null,
      sourcePersonRole: sourcePersonAccount?.role || null,
      isCurrentHead,
      displayName,
      errors,
      warnings,
    };
  });

  const importByEmail = new Map();
  analyzedRows.forEach((row) => {
    if (row.email && !importByEmail.has(row.email)) importByEmail.set(row.email, row);
  });

  analyzedRows.forEach((row) => {
    if (!row.role || row.isCurrentHead) return;
    const expectedParentRole = getRequiredParentRole(row.role);

    if (!expectedParentRole) {
      if (row.reportsUnderEmail) row.errors.push(`${SELLER_ROLE_LABELS[row.role] || 'This role'} must leave Reports Under Email blank.`);
      return;
    }
    if (!row.reportsUnderEmail) {
      row.errors.push(`${SELLER_ROLE_LABELS[row.role]} requires Reports Under Email for an active ${SELLER_ROLE_LABELS[expectedParentRole]}.`);
      return;
    }
    if (row.reportsUnderEmail === row.email) {
      row.errors.push('A seller cannot report under their own email address.');
      return;
    }

    const importedParent = importByEmail.get(row.reportsUnderEmail);
    if (importedParent) {
      if (importedParent.role !== expectedParentRole) {
        row.errors.push(`${row.reportsUnderEmail} is ${SELLER_ROLE_LABELS[importedParent.role] || importedParent.roleRaw || 'an invalid role'}; ${SELLER_ROLE_LABELS[row.role]} must report under a ${SELLER_ROLE_LABELS[expectedParentRole]}.`);
      }
      if (importedParent.errors.length) {
        row.errors.push(`Reporting parent ${row.reportsUnderEmail} has import errors and cannot be used until those errors are fixed.`);
      }
      row.parentDisplayName = importedParent.displayName || row.reportsUnderEmail;
      row.parentSource = 'import';
      return;
    }

    const currentParent = currentMemberByEmail.get(row.reportsUnderEmail);
    if (!currentParent) {
      row.errors.push(`${row.reportsUnderEmail} was not found as an existing member of this Network or in this Excel file.`);
      return;
    }
    if (Number(currentParent.is_system_dummy || 0) === 1) {
      row.errors.push('A system-generated seller cannot be selected as Reports Under.');
      return;
    }
    if (String(currentParent.role || '') !== expectedParentRole) {
      row.errors.push(`${row.reportsUnderEmail} is ${SELLER_ROLE_LABELS[currentParent.role] || currentParent.role}; ${SELLER_ROLE_LABELS[row.role]} must report under a ${SELLER_ROLE_LABELS[expectedParentRole]}.`);
      return;
    }
    if (String(currentParent.user_status || 'inactive') !== 'active' || String(currentParent.accredited_seller_status || 'inactive') !== 'active') {
      row.errors.push(`${row.reportsUnderEmail} exists in this Network but is not Active.`);
      return;
    }
    row.parentDisplayName = currentMemberName(currentParent);
    row.parentSource = 'existing';
    row.parentUserId = Number(currentParent.user_id);
  });

  // Propagate parent-row failures after every row has completed hierarchy validation.
  // This keeps the Preview truthful even when a child appears before its parent
  // in the Excel sheet.
  analyzedRows.forEach((row) => {
    if (row.parentSource !== 'import' || !row.reportsUnderEmail) return;
    const importedParent = importByEmail.get(row.reportsUnderEmail);
    if (importedParent?.errors?.length && !row.errors.some((message) => message.includes('Reporting parent'))) {
      row.errors.push(`Reporting parent ${row.reportsUnderEmail} has import errors and cannot be used until those errors are fixed.`);
    }
  });

  if (normalizedRows.length > NETWORK_MEMBER_IMPORT_MAX_ROWS) {
    analyzedRows[0]?.errors.push(`Import is limited to ${NETWORK_MEMBER_IMPORT_MAX_ROWS.toLocaleString()} rows per file.`);
  }
  if (groupType && groupType !== 'in_house') {
    analyzedRows.forEach((row) => row.errors.push('Excel member import is available only for In-House Networks.'));
  }
  if (groupStatus && groupStatus !== 'active') {
    analyzedRows.forEach((row) => row.errors.push('Activate this Network before importing members.'));
  }

  const errorRows = analyzedRows.filter((row) => row.errors.length);
  const warningRows = analyzedRows.filter((row) => !row.errors.length && row.warnings.length);
  const readyRows = analyzedRows.filter((row) => !row.errors.length);
  const counts = readyRows.reduce((summary, row) => {
    summary[row.action.toLowerCase()] = (summary[row.action.toLowerCase()] || 0) + 1;
    return summary;
  }, { create: 0, update: 0, transfer: 0 });

  return {
    network: {
      id: groupId,
      name: group.seller_group_name || group.name || 'In-House Network',
      type: groupType || 'in_house',
      status: groupStatus || 'active',
      headUserId: headUserId || null,
      headName: headMember ? currentMemberName(headMember) : null,
      headEmail: headMember?.email || null,
      headRole: headMember?.role || null,
    },
    rows: analyzedRows,
    summary: {
      total: analyzedRows.length,
      ready: readyRows.length,
      warnings: warningRows.length,
      errors: errorRows.length,
      ...counts,
    },
    canCommit: analyzedRows.length > 0 && errorRows.length === 0,
  };
};

export const sortNetworkMemberImportRows = (rows = []) => [...rows].sort((a, b) => {
  const roleDelta = (NETWORK_MEMBER_IMPORT_ROLE_ORDER[a.role] ?? 99) - (NETWORK_MEMBER_IMPORT_ROLE_ORDER[b.role] ?? 99);
  if (roleDelta) return roleDelta;
  return Number(a.sourceRow || 0) - Number(b.sourceRow || 0);
});
