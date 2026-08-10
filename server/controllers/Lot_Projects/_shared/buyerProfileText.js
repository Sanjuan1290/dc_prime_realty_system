const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
const WORD_PART_SEPARATOR = /(['’\-])/;
const ROMAN_NUMERAL_PATTERN = /^(?=[ivxlcdm]+$)m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/i;

const UPPERCASE_WORDS = new Set([
  'bpo',
  'ceo',
  'cfo',
  'coo',
  'cto',
  'dba',
  'hr',
  'it',
  'ncr',
  'ofw',
  'qa',
  'sql',
  'uae',
  'ui',
  'usa',
  'ux',
]);

export const cleanBuyerProfileText = (value, maxLength = 2000) =>
  String(value ?? '')
    .replace(CONTROL_CHARACTERS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);

const formatWordPart = (part) => {
  if (!part) return '';

  const lower = part.toLocaleLowerCase('en-PH');

  if (UPPERCASE_WORDS.has(lower) || ROMAN_NUMERAL_PATTERN.test(lower) || /^\d+[a-z]+$/i.test(lower)) {
    return lower.toLocaleUpperCase('en-PH');
  }

  const formatted = `${lower.charAt(0).toLocaleUpperCase('en-PH')}${lower.slice(1)}`;

  // Common surname pattern: mcdonald -> McDonald.
  if (/^Mc[\p{L}]/u.test(formatted)) {
    return `Mc${formatted.charAt(2).toLocaleUpperCase('en-PH')}${formatted.slice(3)}`;
  }

  return formatted;
};

const formatWord = (word) =>
  word
    .split(WORD_PART_SEPARATOR)
    .map((part) => (WORD_PART_SEPARATOR.test(part) ? part : formatWordPart(part)))
    .join('');

/**
 * Converts buyer-facing free text to a formal display format before it is saved.
 * Examples: "robert renby" -> "Robert Renby", "imus" -> "Imus".
 */
export const toFormalTitleCase = (value, maxLength = 2000) => {
  const cleaned = cleanBuyerProfileText(value, maxLength);
  if (!cleaned) return '';

  return cleaned
    .toLocaleLowerCase('en-PH')
    .replace(WORD_PATTERN, (word) => formatWord(word))
    .slice(0, maxLength);
};

export const FORMAL_BUYER_PROFILE_FIELDS = Object.freeze([
  'buyerFirstName',
  'buyerMiddleName',
  'buyerLastName',
  'buyerSuffix',
  'buyerName',
  'placeOfBirth',
  'citizenship',
  'gender',
  'civilStatus',
  'presentAddress',
  'permanentAddress',
  'employmentStatus',
  'employerBusinessName',
  'natureOfWorkBusiness',
  'occupationPositionTitle',
  'employerBusinessAddress',
  'secondBuyerFirstName',
  'secondBuyerMiddleName',
  'secondBuyerLastName',
  'secondBuyerSuffix',
  'secondBuyerName',
  'secondBuyerPlaceOfBirth',
  'secondBuyerCitizenship',
  'secondBuyerGender',
  'secondBuyerCivilStatus',
  'secondBuyerPresentAddress',
  'secondBuyerPermanentAddress',
  'secondBuyerEmploymentStatus',
  'secondBuyerEmployerBusinessName',
  'secondBuyerNatureOfWorkBusiness',
  'secondBuyerOccupationPositionTitle',
  'secondBuyerEmployerBusinessAddress',
]);

const formalFieldSet = new Set(FORMAL_BUYER_PROFILE_FIELDS);

export const isFormalBuyerProfileField = (field) => formalFieldSet.has(String(field || ''));


