export const EMPLOYMENT_STATUS_OTHER_VALUE = '__other__'

export const EMPLOYMENT_STATUS_OPTIONS = Object.freeze([
  { value: 'Employed - Private', label: 'Employed - Private', key: 'private' },
  { value: 'Self-Employed (With Business)', label: 'Self-Employed (With Business)', key: 'business' },
  { value: 'Employed Government', label: 'Employed Government', key: 'government' },
  { value: 'Self-Employed (Professional)', label: 'Self-Employed (Professional)', key: 'professional' },
  { value: 'Employed - NGO', label: 'Employed - NGO', key: 'ngo' },
  { value: 'OFW/Immigrant', label: 'OFW/Immigrant', key: 'ofw' },
])

const normalize = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/\s*\/\s*/g, '/')
  .replace(/\s*-\s*/g, '-')
  .replace(/\s+/g, ' ')

// Only explicit category values and known legacy aliases select a checkbox.
// Free-text values such as "Private Tutor" or "Government Consultant" remain
// custom values and therefore print only on the Other line.
const OPTION_ALIASES = new Map([
  ['employed-private', EMPLOYMENT_STATUS_OPTIONS[0]],
  ['employed private', EMPLOYMENT_STATUS_OPTIONS[0]],
  ['private employee', EMPLOYMENT_STATUS_OPTIONS[0]],

  ['self-employed (with business)', EMPLOYMENT_STATUS_OPTIONS[1]],
  ['self employed (with business)', EMPLOYMENT_STATUS_OPTIONS[1]],
  ['self-employed with business', EMPLOYMENT_STATUS_OPTIONS[1]],
  ['self employed with business', EMPLOYMENT_STATUS_OPTIONS[1]],
  ['self-employed', EMPLOYMENT_STATUS_OPTIONS[1]],
  ['self employed', EMPLOYMENT_STATUS_OPTIONS[1]],
  ['business owner', EMPLOYMENT_STATUS_OPTIONS[1]],

  ['employed government', EMPLOYMENT_STATUS_OPTIONS[2]],
  ['employed-government', EMPLOYMENT_STATUS_OPTIONS[2]],
  ['government employee', EMPLOYMENT_STATUS_OPTIONS[2]],

  ['self-employed (professional)', EMPLOYMENT_STATUS_OPTIONS[3]],
  ['self employed (professional)', EMPLOYMENT_STATUS_OPTIONS[3]],
  ['self-employed professional', EMPLOYMENT_STATUS_OPTIONS[3]],
  ['self employed professional', EMPLOYMENT_STATUS_OPTIONS[3]],
  ['professional', EMPLOYMENT_STATUS_OPTIONS[3]],

  ['employed-ngo', EMPLOYMENT_STATUS_OPTIONS[4]],
  ['employed ngo', EMPLOYMENT_STATUS_OPTIONS[4]],
  ['ngo employee', EMPLOYMENT_STATUS_OPTIONS[4]],

  ['ofw/immigrant', EMPLOYMENT_STATUS_OPTIONS[5]],
  ['ofw/immigrant worker', EMPLOYMENT_STATUS_OPTIONS[5]],
  ['ofw', EMPLOYMENT_STATUS_OPTIONS[5]],
  ['immigrant', EMPLOYMENT_STATUS_OPTIONS[5]],
])

const resolveKnownOption = (value) => OPTION_ALIASES.get(normalize(value)) || null

export const resolveEmploymentStatus = (value) => {
  const rawValue = String(value || '').trim()
  const knownOption = resolveKnownOption(rawValue)

  if (knownOption) {
    return {
      selectedValue: knownOption.value,
      checkedKey: knownOption.key,
      displayValue: knownOption.value,
      otherText: '',
      isOther: false,
    }
  }

  if (!rawValue) {
    return {
      selectedValue: '',
      checkedKey: '',
      displayValue: '',
      otherText: '',
      isOther: false,
    }
  }

  const isGenericOther = normalize(rawValue) === 'other'

  return {
    selectedValue: EMPLOYMENT_STATUS_OTHER_VALUE,
    checkedKey: '',
    displayValue: rawValue,
    otherText: isGenericOther ? '' : rawValue,
    isOther: true,
  }
}

export const getEmploymentStatusOtherText = (value) => resolveEmploymentStatus(value).otherText

export const isEmploymentStatusChecked = (value, key) => resolveEmploymentStatus(value).checkedKey === key

