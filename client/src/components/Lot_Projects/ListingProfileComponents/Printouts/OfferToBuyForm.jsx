import {
  getEmploymentStatusOtherText,
  isEmploymentStatusChecked,
} from '../../../../utils/employmentStatus'
import {
  cleanMoney,
  formatDate,
  getNormalizedSoaRows,
  getValue,
} from './printUtils'

/*
 * OFFER TO BUY & BUYER'S PROFILE (Individual) - OTB Revised April 2026
 *
 * This form is a one-to-one copy of the supplied reference PDF
 * ("Copy of Offer to Buy and Buyer's Profile.pdf"): Legal page 8.5in x 14in
 * (612pt x 1008pt), Source Sans SemiBold, same rules, same shaded bands.
 *
 * Every rule, fill, label and check box below is drawn at the exact
 * coordinate (in points, origin = top-left of the page) read from the PDF, so
 * nothing depends on table/flex layout that could drift. Only the values that
 * the system fills in are dynamic - they are placed inside the reference
 * cells by <Val> / <ValLines>.
 */

/* ------------------------------------------------------------------ */
/* Data helpers (unchanged behaviour)                                  */
/* ------------------------------------------------------------------ */

const blank = (value) => {
  if (value === undefined || value === null || value === '-') return ''
  return String(value)
}

const valueFrom = (source, keys, fallback = '') => blank(getValue(source, keys, fallback))

const plainMoney = (value) => {
  const amount = Number(value || 0)
  if (!(amount > 0)) return ''

  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const getRowAmount = (rows, keyword) => rows
  .filter((row) => String(row.description || '').toLowerCase().includes(keyword))
  .reduce((sum, row) => sum + cleanMoney(row.dueAmount), 0)

const getMonthlyAmount = (rows) => {
  const row = rows.find((item) => String(item.description || '').toLowerCase().includes('monthly'))
  return cleanMoney(row?.dueAmount || 0)
}

const buyerField = (client, key) => valueFrom(client, [key], '')
const secondBuyerField = (client, suffix) => valueFrom(client, [`secondBuyer${suffix}`], '')

const formatBuyerName = ({ lastName, firstName, middleName, suffix, fallback }) => {
  const familyName = [lastName, suffix].filter(Boolean).join(' ')
  const givenNames = [firstName, middleName].filter(Boolean).join(' ')

  if (familyName && givenNames) return `${familyName}, ${givenNames}`
  if (familyName || givenNames) return familyName || givenNames
  return fallback || ''
}

const getBuyerValues = (client, name, second = false) => {
  const get = (key) => second
    ? secondBuyerField(client, key)
    : buyerField(client, key.charAt(0).toLowerCase() + key.slice(1))

  const birthDate = formatDate(get('BirthDate'))
  const permanentAddress = get('PermanentAddress')
  const permanentZip = get('PermanentZipCode')
  const employmentStatus = get('EmploymentStatus')

  return {
    fullName: formatBuyerName({
      lastName: second ? secondBuyerField(client, 'LastName') : buyerField(client, 'buyerLastName'),
      firstName: second ? secondBuyerField(client, 'FirstName') : buyerField(client, 'buyerFirstName'),
      middleName: second ? secondBuyerField(client, 'MiddleName') : buyerField(client, 'buyerMiddleName'),
      suffix: second ? secondBuyerField(client, 'Suffix') : buyerField(client, 'buyerSuffix'),
      fallback: name,
    }),
    birthDate: birthDate === '-' ? '' : birthDate,
    placeOfBirth: get('PlaceOfBirth'),
    citizenship: get('Citizenship'),
    gender: get('Gender'),
    civil: String(second ? secondBuyerField(client, 'CivilStatus') : buyerField(client, 'civilStatus')).toLowerCase(),
    presentAddress: get('PresentAddress'),
    presentZip: get('PresentZipCode'),
    // The reference form has a single "Permanent Address" line (no zip cell),
    // so a saved permanent zip code is printed at the end of the address.
    permanentAddress: [permanentAddress, permanentZip && !permanentAddress.includes(permanentZip) ? permanentZip : '']
      .filter(Boolean)
      .join(' '),
    mobile: get('ContactNo'),
    residencePhone: get('ResidencePhoneNumber'),
    email: get('Email'),
    tin: get('Tin'),
    employmentStatus,
    otherEmployment: getEmploymentStatusOtherText(employmentStatus),
    employer: get('EmployerBusinessName'),
    employerAddress: get('EmployerBusinessAddress'),
    employerZip: get('EmployerZipCode'),
    nature: get('NatureOfWorkBusiness'),
    occupation: get('OccupationPositionTitle'),
  }
}

/* ------------------------------------------------------------------ */
/* Text fitting (values must never spill out of the reference cells)   */
/* ------------------------------------------------------------------ */

// Advance widths (1/1000 em) of ASCII 32-126 in Source Sans 3 SemiBold.
const ADVANCE = [200,315,482,513,513,841,639,275,324,324,438,513,275,322,275,344,513,513,513,513,513,513,513,513,513,513,275,275,513,513,513,444,875,558,597,576,625,538,510,628,663,282,494,597,502,745,657,674,582,674,592,545,546,655,536,800,541,501,540,324,344,324,513,500,549,516,563,462,564,507,317,520,558,262,263,522,271,843,560,549,564,564,373,431,361,556,495,748,481,495,443,324,255,324,513]

const measure = (text, size) => {
  let width = 0

  for (const character of String(text).normalize('NFD')) {
    const code = character.charCodeAt(0)
    if (code >= 0x300 && code <= 0x36f) continue // combining accents (n + tilde)
    width += code >= 32 && code <= 126 ? ADVANCE[code - 32] : 550
  }

  return (width * size) / 1000
}

// Shrink a single line to fit; squeeze it (textLength) only as a last resort.
const fitLine = (text, maxWidth, size, minSize) => {
  let fontSize = size

  while (measure(text, fontSize) > maxWidth && fontSize - 0.25 >= minSize) fontSize -= 0.25

  return measure(text, fontSize) > maxWidth
    ? { fontSize, textLength: maxWidth }
    : { fontSize }
}

const wrapWords = (text, maxWidth, size) => {
  const lines = []
  let current = ''

  String(text).split(/\s+/).filter(Boolean).forEach((word) => {
    const candidate = current ? `${current} ${word}` : word

    if (current && measure(candidate, size) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  })

  if (current) lines.push(current)
  return lines
}

const layoutLines = (text, maxWidth, size, maxLines, minSize) => {
  for (let fontSize = size; fontSize >= minSize - 0.001; fontSize -= 0.25) {
    const lines = wrapWords(text, maxWidth, fontSize)
    if (lines.length <= maxLines) return { fontSize, lines }
  }

  const lines = wrapWords(text, maxWidth, minSize)
  return {
    fontSize: minSize,
    lines: [...lines.slice(0, maxLines - 1), lines.slice(maxLines - 1).join(' ')],
  }
}

/* ------------------------------------------------------------------ */
/* Reference geometry (points, top-left origin) - from the PDF          */
/* ------------------------------------------------------------------ */

const GRAY = '#c0c0c0'
const NAVY = '#000080'

// [x, y, width, height, fill]
const FILLS = [
  [17.4, 131.5, 558.75, 23.25, GRAY], // PROPERTY DESCRIPTION
  [17.4, 193.55, 558.75, 24.25, GRAY], // OFFER TERMS AND CONDITIONS
  [17.4, 409.7, 558.75, 13.1, GRAY], // INDIVIDUAL BUYER/s INFORMATION
  [17.4, 619.15, 558.75, 13.1, GRAY], // Work/Business Information
  [17.4, 774.3, 558.75, 23.15, GRAY], // INCOME DETAILS (MONTHLY)
  [17.4, 820.4, 558.75, 13.3, NAVY], // SIGNATURES of BUYER/S
  [17.4, 870.15, 558.75, 23.15, GRAY], // SALES AGENT
]

// [y, x1, x2, strokeWidth]
const H_LINES = [
  [75.47, 12.28, 602.67, 1.44],
  [131.47, 17.28, 576.22, 0.24],
  [154.72, 17.28, 576.22, 0.24],
  [178.02, 17.28, 576.22, 0.24],
  [193.57, 17.28, 576.22, 0.24],
  [217.82, 17.52, 296.71, 0.24],
  [217.82, 296.47, 575.98, 0.24],
  [218.3, 17.52, 296.23, 0.24],
  [218.3, 296.47, 575.98, 0.24],
  [233.59, 21.86, 32.59, 0.48],
  [233.59, 296.71, 306.54, 0.48],
  [256.92, 17.28, 576.22, 0.24],
  [268.67, 17.28, 576.22, 0.24],
  [291.87, 17.28, 576.22, 0.24],
  [315.02, 17.28, 576.22, 0.24],
  [338.22, 17.28, 576.22, 0.24],
  [362.87, 17.28, 576.22, 0.24],
  [386.02, 17.28, 575.98, 0.24],
  [386.5, 390.12, 575.98, 0.24],
  [409.72, 17.28, 576.22, 0.24],
  [422.87, 17.28, 576.22, 0.24],
  [448.52, 17.28, 576.22, 0.24],
  [462.67, 17.28, 576.22, 0.24],
  [477.47, 17.28, 576.22, 0.24],
  [535.37, 17.28, 576.22, 0.24],
  [558.52, 17.28, 576.22, 0.24],
  [571.52, 17.28, 576.22, 0.24],
  [583.32, 17.28, 576.22, 0.24],
  [595.07, 17.28, 576.22, 0.24],
  [606.87, 17.28, 576.22, 0.24],
  [618.67, 17.28, 576.22, 0.24],
  [632.27, 17.28, 576.22, 0.24],
  [700.12, 17.28, 576.22, 0.24],
  [713.12, 17.28, 576.22, 0.24],
  [726.12, 17.28, 576.22, 0.24],
  [749.27, 17.28, 576.22, 0.24],
  [761.77, 17.28, 576.22, 0.24],
  [774.27, 17.28, 576.22, 0.24],
  [820.37, 17.28, 576.22, 0.24],
  [833.72, 17.28, 576.22, 0.24],
  [857.07, 17.28, 576.22, 0.24],
  [870.12, 17.28, 576.22, 0.24],
  [893.32, 17.28, 576.22, 0.24],
  [905.07, 295.03, 576.22, 0.24],
  [916.87, 17.28, 576.22, 0.24],
  [931.72, 12.28, 602.67, 1.44],
]

// [x, y1, y2, strokeWidth]
const V_LINES = [
  [13.0, 74.75, 931.0, 1.44],
  [17.4, 131.35, 916.99, 0.24],
  [22.1, 218.42, 233.83, 0.48],
  [32.35, 218.42, 233.83, 0.48],
  [129.1, 177.9, 193.45, 0.24],
  [129.1, 256.8, 314.9, 0.24],
  [129.1, 338.1, 362.75, 0.24],
  [129.1, 448.4, 462.55, 0.24],
  [198.55, 462.55, 477.35, 0.24],
  [198.55, 535.25, 558.4, 0.24],
  [198.55, 726.0, 749.15, 0.24],
  [214.3, 177.9, 193.45, 0.24],
  [295.15, 177.9, 193.45, 0.24],
  [295.15, 422.75, 774.15, 0.24],
  [295.15, 833.6, 870.0, 0.24],
  [295.15, 893.2, 916.75, 0.24],
  [296.11, 218.18, 233.35, 0.24],
  [296.11, 233.35, 256.8, 0.24],
  [296.35, 256.8, 409.6, 0.24],
  [296.59, 218.18, 233.35, 0.24],
  [296.59, 233.35, 256.8, 0.24],
  [306.3, 218.42, 233.83, 0.48],
  [390.0, 256.8, 386.14, 0.24],
  [401.0, 448.4, 462.55, 0.24],
  [419.5, 386.62, 409.6, 0.24],
  [495.5, 462.55, 477.35, 0.24],
  [495.5, 535.25, 558.4, 0.24],
  [495.5, 726.0, 749.15, 0.24],
  [576.1, 131.59, 632.39, 0.24],
  [576.1, 700.24, 916.99, 0.24],
  [601.95, 74.75, 931.0, 1.44],
]

// [x, baselineY, fontSize, style, text, width]
// style: r = SemiBold, b = SemiBold + pseudo-bold outline (the WPS "bold"),
//        i / ib = the same in italic, w = white bold (on the navy band)
const TEXT_RUNS = [
  [19.08, 92.21, 13.45, 'b', 'Offer To Buy & Buyer\'s Profile', 171.34],
  [19.08, 107.09, 9.95, 'b', 'Real Estate Sales – For Individual', 141.41],
  [21.36, 127.61, 9.5, 'b', 'Buyer Type', 45.98],
  [78.96, 127.61, 9.5, 'r', 'Single', 25.21],
  [129.0, 127.61, 9.5, 'r', 'Spouses', 33.97],
  [185.88, 127.61, 9.5, 'r', 'and Account', 50.71],
  [275.28, 127.61, 9.95, 'b', 'Sales Officer', 53.87],
  [329.28, 127.61, 6.95, 'b', ':', 1.91],
  [463.08, 127.61, 9.95, 'b', 'Date Received:', 63.81],
  [216.0, 147.41, 15.95, 'b', 'PROPERTY DESCRIPTION', 171.5],
  [19.2, 168.77, 14.05, 'r', 'Location:', 56.42],
  [19.2, 186.65, 8.5, 'r', 'Property Type:', 54.18],
  [130.8, 186.65, 8.5, 'r', 'Lot Area (sqm):', 55.38],
  [216.0, 186.65, 8.5, 'r', 'Classification:', 51.42],
  [296.88, 186.65, 8.5, 'r', 'Description/Improvements:', 100.97],
  [213.24, 202.97, 9.5, 'b', 'OFFER TERMS AND CONDITIONS', 130.69],
  [129.12, 213.89, 7.45, 'ib', 'I/We, hereby offer to purchase the property described above under the following terms and conditions:', 319.98],
  [40.44, 227.21, 9.0, 'b', 'CASH', 20.97],
  [313.44, 227.21, 9.0, 'b', 'INSTALLMENT/In-house Financing', 131.52],
  [19.2, 265.37, 8.5, 'b', 'Purchase Price:', 56.58],
  [130.92, 265.37, 8.5, 'b', 'Php', 14.39],
  [297.0, 265.37, 8.5, 'b', 'Purchase Price:', 56.58],
  [391.8, 265.37, 8.5, 'b', 'Php', 14.39],
  [19.2, 277.61, 9.0, 'r', 'Reservation Fee:', 64.39],
  [297.0, 277.61, 9.0, 'r', 'Reservation Fee:', 64.27],
  [19.2, 300.77, 9.0, 'r', 'Balance:', 33.31],
  [297.0, 300.77, 9.0, 'r', 'Downpayment:', 59.35],
  [297.0, 324.05, 9.0, 'r', 'Balance:', 33.31],
  [19.2, 347.09, 9.0, 'r', 'Deferred Cash:', 56.95],
  [297.0, 347.09, 9.0, 'r', 'Terms (months/years to', 92.66],
  [297.0, 359.33, 9.0, 'r', 'pay):', 19.51],
  [297.0, 371.81, 9.0, 'r', 'Interest Rate:', 52.39],
  [296.4, 395.45, 9.0, 'r', 'Monthly Amortization:', 86.83],
  [224.16, 419.09, 9.5, 'b', 'INDIVIDUAL BUYER/s INFORMATION', 144.95],
  [19.2, 431.33, 8.5, 'b', 'Principal Full-name', 71.51],
  [92.4, 431.33, 8.5, 'r', '(Last Name, First Name, Middle Name)', 139.55],
  [296.88, 431.33, 8.5, 'b', 'Spouse/Second Buyer\'s Name', 109.19],
  [407.88, 431.33, 8.5, 'r', '(Last Name, First Name, Middle Name)', 139.55],
  [19.2, 457.01, 8.5, 'r', 'Date of Birth:', 48.3],
  [130.8, 457.01, 8.5, 'r', 'Place of Birth:', 51.06],
  [296.88, 457.01, 8.5, 'r', 'Date of Birth:', 48.3],
  [402.6, 457.01, 8.5, 'r', 'Place of Birth:', 51.18],
  [19.2, 471.17, 8.5, 'r', 'Citizenship:', 42.89],
  [200.28, 471.17, 8.5, 'r', 'Gender:', 28.98],
  [296.88, 471.17, 8.5, 'r', 'Citizenship:', 42.9],
  [497.16, 471.17, 8.5, 'r', 'Gender:', 28.97],
  [19.2, 530.69, 8.5, 'r', 'Present', 28.15],
  [50.76, 530.69, 8.5, 'r', 'Address:', 31.37],
  [296.76, 532.01, 8.5, 'r', 'Present', 28.15],
  [328.44, 532.01, 8.5, 'r', 'Address:', 31.38],
  [200.28, 543.89, 8.5, 'r', 'Zip Code', 31.91],
  [497.16, 543.89, 8.5, 'r', 'Zip Code', 31.91],
  [19.2, 567.05, 8.5, 'r', 'Permanent Address:', 73.86],
  [296.88, 567.05, 8.5, 'r', 'Permanent Address:', 73.85],
  [19.2, 580.01, 8.5, 'r', 'Mobile No.:', 41.1],
  [296.88, 580.01, 8.5, 'r', 'Mobile No.:', 41.1],
  [19.2, 591.77, 8.5, 'r', 'Residence Phone Number:', 96.06],
  [296.88, 591.77, 8.5, 'r', 'Residence Phone Number:', 96.05],
  [19.2, 603.65, 8.5, 'r', 'E-mail Add:', 41.58],
  [296.88, 603.65, 8.5, 'r', 'E-mail Add:', 41.58],
  [19.2, 615.29, 8.5, 'r', 'TIN:', 14.82],
  [296.88, 615.29, 8.5, 'r', 'TIN:', 14.82],
  [100.32, 628.61, 9.5, 'b', 'Work/Business Information', 111.64],
  [379.68, 628.61, 9.5, 'b', 'Work/Business Information', 111.52],
  [19.2, 640.85, 8.5, 'b', 'Employment Status: (Please check)', 128.87],
  [34.44, 655.25, 7.45, 'r', 'Employed –Private', 60.65],
  [141.72, 655.25, 7.45, 'r', 'Self-Employed', 47.04],
  [190.32, 655.25, 7.45, 'ib', '(With Business)', 47.8],
  [35.04, 672.05, 6.95, 'r', 'Employed Government', 69.23],
  [144.96, 672.05, 7.45, 'r', 'Self-Employed', 47.16],
  [193.68, 672.05, 7.45, 'ib', '(Professional)', 43.6],
  [34.08, 687.05, 7.45, 'r', 'Employed – NGO', 53.62],
  [145.2, 687.05, 6.95, 'r', 'OFW/immigrant', 47.99],
  [19.08, 697.25, 7.45, 'r', 'Other __________________________', 117.36],
  [19.2, 708.65, 8.5, 'r', 'Employer/Business Name:', 95.58],
  [296.88, 708.65, 8.5, 'r', 'Employer/Business Name:', 95.58],
  [19.2, 721.61, 8.5, 'r', 'Employer/Business Address:', 103.26],
  [296.88, 721.61, 8.5, 'r', 'Employer/Business Address:', 103.25],
  [200.28, 734.57, 8.5, 'r', 'Zip Code', 31.91],
  [497.16, 734.57, 8.5, 'r', 'Zip Code', 31.91],
  [19.2, 757.85, 8.5, 'r', 'Nature of Work/Business:', 92.21],
  [296.88, 757.85, 8.5, 'r', 'Nature of Work/Business:', 92.21],
  [19.2, 770.33, 8.5, 'r', 'Occupation/Position/Title:', 97.01],
  [296.88, 770.33, 8.5, 'r', 'Occupation/Position/Title:', 97.13],
  [221.16, 783.77, 9.5, 'b', 'INCOME DETAILS (MONTHLY)', 117.92],
  [176.16, 805.73, 8.5, 'b', 'PRINCIPAL', 39.18],
  [301.44, 805.73, 8.5, 'b', 'SPOUSE/SECOND BUYER', 89.99],
  [491.76, 805.73, 8.5, 'b', 'TOTAL', 23.94],
  [246.24, 830.09, 9.5, 'w', 'SIGNATURES of BUYER/S', 100.7],
  [69.72, 865.85, 8.5, 'b', 'Signature over Printed Name of Principal Buyer', 172.85],
  [337.08, 865.85, 8.5, 'b', 'Signature over Printed Name of Spouse/Second Buyer', 196.97],
  [267.0, 880.01, 9.95, 'b', 'SALES AGENT:', 60.94],
  [19.2, 901.85, 8.5, 'r', 'Name:', 23.7],
  [53.4, 913.25, 8.5, 'r', 'Last name', 37.55],
  [150.84, 913.49, 8.5, 'r', 'First Name', 39.59],
  [230.76, 913.49, 8.5, 'r', 'Middle Name', 47.75],
  [297.0, 901.85, 8.5, 'r', 'TIN No. :', 30.9],
  [297.0, 913.61, 8.5, 'r', 'Address:', 31.38],
  [17.28, 923.81, 6.95, 'b', 'OTB (Individual) – Revised April 2026', 110.12],
]

// Buyer Type check boxes above "Single", "Spouses", "and Account": [x, y, w, h]
const BUYER_TYPE_BOXES = {
  single: [82.44, 111.99, 10.58, 7.48],
  spouses: [139.04, 111.24, 10.28, 7.53],
  and_account: [197.24, 111.24, 10.33, 7.53],
}

// CASH / INSTALLMENT check boxes: [centerX, centerY]
const PAYMENT_BOXES = { cash: [27.22, 226.1], installment: [301.45, 226.1] }

// Left "Work/Business" employment boxes (outer edge): [x, y, w, h]
const EMPLOYMENT_BOXES = {
  private: [23.07, 645.17, 10.61, 10.61],
  business: [129.47, 648.57, 10.61, 10.61],
  government: [22.97, 661.32, 10.61, 10.61],
  professional: [130.87, 663.32, 10.61, 10.61],
  ngo: [23.32, 677.42, 10.61, 10.61],
  ofw: [130.62, 677.52, 10.61, 10.61],
}

// The reference embeds two pictures (Civil Status / Employment Status). They
// are rebuilt here as real vector text and boxes at the same size and place.
// Civil Status block [x, baselineY, fontSize, textLength, text]
const CIVIL_TEXT = [
  [21.27, 490.14, 8.51, 43.93, 'Civil Status:'],
  [44.43, 504.02, 8.41, 51.6, 'SingleMarried'],
  [190.22, 504.05, 8.42, 37.92, 'Separated'],
  [44.34, 518.01, 8.41, 68.79, 'Annulled/Divorced'],
  [190.61, 518.01, 8.42, 36.12, 'Widow/er'],
]

// [x, y, w, h] in the order: single/married, separated, annulled/divorced, widow/er
const CIVIL_BOXES = [
  [25.18, 495.82, 10.57, 10.58],
  [168.48, 494.27, 13.06, 12.75],
  [25.49, 508.89, 10.57, 10.58],
  [168.17, 508.27, 13.06, 13.06],
]

// The picture is used twice: principal buyer (dx 0) and spouse (dx 278.04)
const CIVIL_OFFSETS = [[0, 0], [278.04, 0.12]]
const CIVIL_KEYS = ['single', 'separated', 'annulled', 'widow']

// Right-hand Employment Status block: [x, baselineY, fontSize, textLength, weight, style, text]
const EMPLOYMENT_TEXT = [
  [297.62, 640.36, 8.16, 129.96, 500, 'normal', 'Employment Status: (Please check)'],
  [314.89, 652.99, 7.11, 60.01, 400, 'normal', 'Employed –Private'],
  [430.15, 653.0, 7.07, 45.58, 400, 'normal', 'Self-Employed'],
  [477.89, 652.89, 7.31, 51.4, 500, 'italic', '(With Business)'],
  [315.7, 667.64, 6.56, 67.12, 400, 'normal', 'Employed Government'],
  [431.07, 667.67, 7.07, 45.58, 400, 'normal', 'Self-Employed'],
  [478.81, 667.68, 7.37, 46.2, 500, 'italic', '(Professional)'],
  [315.35, 680.7, 7.11, 54.51, 400, 'normal', 'Employed – NGO'],
  [430.66, 680.7, 6.61, 47.39, 400, 'normal', 'OFW/immigrant'],
  [297.49, 698.89, 7.1, 17.49, 400, 'normal', 'Other'],
]

// order: private, business, government, professional, ngo, ofw
const EMPLOYMENT_PICTURE_BOXES = [
  [301.42, 644.86, 10.09, 9.78],
  [418.51, 646.49, 10.09, 9.78],
  [301.27, 659.83, 10.09, 9.78],
  [418.05, 661.17, 10.24, 9.93],
  [301.57, 674.65, 10.09, 9.78],
  [417.9, 676.28, 10.09, 9.78],
]
const EMPLOYMENT_KEYS = ['private', 'business', 'government', 'professional', 'ngo', 'ofw']

// Where the values go inside the reference cells. `x` is the start of the
// writing space, `w` the room available before the cell border.
const BUYER_CELLS = [
  {
    name: { x: 19.2, y: 443.6, w: 272 },
    birthDate: { x: 70.5, y: 457.01, w: 56 },
    placeOfBirth: { x: 184.5, y: 457.01, w: 108 },
    citizenship: { x: 65.5, y: 471.17, w: 131 },
    gender: { x: 232, y: 471.17, w: 61 },
    presentAddress: { x: 19.7, y: 545.3, w: 176 },
    presentZip: { x: 200.28, y: 555.1, w: 90 },
    permanentAddress: { x: 96.5, y: 567.05, w: 196 },
    mobile: { x: 63.5, y: 580.01, w: 229 },
    residencePhone: { x: 118.5, y: 591.77, w: 174 },
    email: { x: 64.5, y: 603.65, w: 228 },
    tin: { x: 37.5, y: 615.29, w: 255 },
  },
  {
    name: { x: 296.88, y: 443.6, w: 277 },
    birthDate: { x: 348.5, y: 457.01, w: 51 },
    placeOfBirth: { x: 457, y: 457.01, w: 116 },
    citizenship: { x: 343, y: 471.17, w: 150 },
    gender: { x: 529.5, y: 471.17, w: 44 },
    presentAddress: { x: 297.4, y: 545.3, w: 193 },
    presentZip: { x: 497.16, y: 555.1, w: 76 },
    permanentAddress: { x: 374, y: 567.05, w: 199 },
    mobile: { x: 341, y: 580.01, w: 232 },
    residencePhone: { x: 396, y: 591.77, w: 177 },
    email: { x: 342, y: 603.65, w: 231 },
    tin: { x: 314.5, y: 615.29, w: 258 },
  },
]

const WORK_CELLS = [
  {
    employer: { x: 118.5, y: 708.65, w: 174.5 },
    employerAddress: { x: 19.7, y: 735.7, w: 176 },
    employerZip: { x: 200.28, y: 745.4, w: 90 },
    nature: { x: 114.5, y: 757.85, w: 178 },
    occupation: { x: 119.5, y: 770.33, w: 173.5 },
    other: { x: 41.5, y: 696.5, w: 93 },
  },
  {
    employer: { x: 395.5, y: 708.65, w: 177.5 },
    employerAddress: { x: 297.4, y: 735.7, w: 193 },
    employerZip: { x: 497.16, y: 745.4, w: 76 },
    nature: { x: 392, y: 757.85, w: 181 },
    occupation: { x: 397, y: 770.33, w: 176 },
    other: { x: 318.5, y: 698.3, w: 80 },
  },
]

/* ------------------------------------------------------------------ */
/* Small SVG building blocks                                           */
/* ------------------------------------------------------------------ */

const Tick = ({ cx, cy, size = 8 }) => (
  <path
    className="otb-tick"
    d={`M${cx - size * 0.34} ${cy + size * 0.02} L${cx - size * 0.1} ${cy + size * 0.3} L${cx + size * 0.38} ${cy - size * 0.32}`}
    strokeWidth={Math.max(0.9, size * 0.13)}
  />
)

const TickIn = ({ box, size }) => {
  const [x, y, w, h] = box
  return <Tick cx={x + w / 2} cy={y + h / 2} size={size || Math.min(w, h) * 0.95} />
}

// A single line of filled-in text.
const Val = ({ x, y, w, size = 8.5, minSize = 5.5, anchor = 'start', children }) => {
  const text = blank(children).trim()
  if (!text) return null

  const fit = fitLine(text, w, size, minSize)

  return (
    <text
      className="otb-v"
      x={x}
      y={y}
      fontSize={fit.fontSize}
      textAnchor={anchor}
      textLength={fit.textLength}
      lengthAdjust={fit.textLength ? 'spacingAndGlyphs' : undefined}
    >
      {text}
    </text>
  )
}

// Filled-in text that may wrap onto a second line (address boxes).
const ValLines = ({ x, y, w, size = 8.5, minSize = 6, maxLines = 2, lineHeight = 9.6, children }) => {
  const text = blank(children).trim()
  if (!text) return null

  const layout = layoutLines(text, w, size, maxLines, minSize)

  return layout.lines.map((line, index) => {
    const fit = fitLine(line, w, layout.fontSize, minSize)

    return (
      <text
        key={index}
        className="otb-v"
        x={x}
        y={y + index * lineHeight}
        fontSize={fit.fontSize}
        textLength={fit.textLength}
        lengthAdjust={fit.textLength ? 'spacingAndGlyphs' : undefined}
      >
        {line}
      </text>
    )
  })
}

const BuyerBlock = ({ cells, values }) => (
  <>
    <Val {...cells.name} size={9.5} minSize={6.5}>{values.fullName}</Val>
    <Val {...cells.birthDate}>{values.birthDate}</Val>
    <Val {...cells.placeOfBirth}>{values.placeOfBirth}</Val>
    <Val {...cells.citizenship}>{values.citizenship}</Val>
    <Val {...cells.gender}>{values.gender}</Val>
    <ValLines {...cells.presentAddress}>{values.presentAddress}</ValLines>
    <Val {...cells.presentZip}>{values.presentZip}</Val>
    <Val {...cells.permanentAddress}>{values.permanentAddress}</Val>
    <Val {...cells.mobile}>{values.mobile}</Val>
    <Val {...cells.residencePhone}>{values.residencePhone}</Val>
    <Val {...cells.email}>{values.email}</Val>
    <Val {...cells.tin}>{values.tin}</Val>
  </>
)

const WorkBlock = ({ cells, values }) => (
  <>
    <Val {...cells.other} size={7.5} minSize={5.5}>{values.otherEmployment}</Val>
    <Val {...cells.employer}>{values.employer}</Val>
    <ValLines {...cells.employerAddress}>{values.employerAddress}</ValLines>
    <Val {...cells.employerZip}>{values.employerZip}</Val>
    <Val {...cells.nature}>{values.nature}</Val>
    <Val {...cells.occupation}>{values.occupation}</Val>
  </>
)

const isCivilChecked = (civil, key) => {
  if (key === 'single') return civil === 'single' || civil === 'married'
  if (key === 'separated') return civil.includes('separated')
  if (key === 'annulled') return civil.includes('annulled') || civil.includes('divorced')
  return civil.includes('widow')
}

/* ------------------------------------------------------------------ */
/* The form                                                            */
/* ------------------------------------------------------------------ */

const OfferToBuyForm = ({ listing = {}, client = {}, soaRows = [] }) => {
  const rows = getNormalizedSoaRows(soaRows)
  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const reservationFee = getRowAmount(rows, 'reservation') || cleanMoney(getValue(listing, ['reservationFee'], 0))
  const downpayment = getRowAmount(rows, 'downpayment') || cleanMoney(getValue(listing, ['downpayment'], 0))
  const balance = cleanMoney(getValue(listing, ['balanceAmount', 'balance'], Math.max(tcp - downpayment, 0)))
  const monthly = cleanMoney(getValue(listing, ['monthlyAmortization'], getMonthlyAmount(rows)))

  const buyerType = valueFrom(client, ['buyerType'], 'single')
  const modeOfPayment = valueFrom(listing, ['soaModeOfPayment', 'modeOfPayment'], 'installment').toLowerCase()
  const isCash = modeOfPayment === 'cash'
  const isInstallment = !isCash
  const monthlyTerms = isInstallment
    ? Number(getValue(listing, ['soaMonthlyTerms', 'monthlyTerms'], 0)) || rows.filter((row) => String(row.description || '').toLowerCase().includes('monthly')).length || 36
    : 0

  const buyerName = valueFrom(client, ['buyerName'], valueFrom(listing, ['buyer_name'], ''))
  const secondBuyerName = valueFrom(client, ['secondBuyerName'], '')
  const seller = valueFrom(listing, ['mainSeller', 'seller'], valueFrom(client, ['seller', 'salesOfficer'], ''))
  const sellerTinNo = valueFrom(listing, ['sellerTinNo', 'seller_tin_no'], '')
  const sellerLastName = valueFrom(listing, ['sellerLastName', 'seller_last_name'], '')
  const sellerFirstName = valueFrom(listing, ['sellerFirstName', 'seller_first_name'], '')
  const sellerMiddleName = valueFrom(listing, ['sellerMiddleName', 'seller_middle_name'], '')
  const sellerAddress = valueFrom(listing, ['sellerAddress', 'seller_address'], '')
  const dateReceivedValue = valueFrom(client, ['dateReceived'], valueFrom(listing, ['client_unit_created'], ''))
  const dateReceived = dateReceivedValue ? formatDate(dateReceivedValue) : ''
  const monthlyIncome = cleanMoney(getValue(client, ['monthlyIncome'], 0))
  const secondMonthlyIncome = cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0))
  const totalIncome = monthlyIncome + secondMonthlyIncome
  const interestRate = valueFrom(listing, ['interestRate', 'soaAnnualInterestRate'], '')

  const unitCode = valueFrom(listing, ['unit_id', 'unitCode'], '')
  const description = valueFrom(listing, ['description', 'improvements'], unitCode ? `Unit ${unitCode}` : '')

  const buyers = [getBuyerValues(client, buyerName), getBuyerValues(client, secondBuyerName, true)]

  return (
    <section
      className="print-page print-export-page otb-page mx-auto bg-white text-black shadow-lg print:shadow-none"
      data-print-page-size="8.5in 14in"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;1,500&family=Source+Sans+3:ital,wght@0,600;1,600&display=swap');

        /* The reference form is printed on 8.5in x 14in (Legal / long bond).
           A named page keeps this size even if a wrapper declares A4. */
        @page otb {
          size: legal portrait;
          margin: 0;
        }

        .otb-page {
          page: otb;
          box-sizing: border-box;
          position: relative;
          width: 8.5in;
          height: 14in;
          margin: 0 auto;
          padding: 0;
          overflow: hidden;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .otb-svg {
          display: block;
          width: 100%;
          height: 100%;
          max-width: none;
        }

        .otb-svg text {
          font-family: 'Source Sans 3', 'Source Sans Pro', 'Segoe UI', Arial, Helvetica, sans-serif;
          font-weight: 600;
          font-kerning: none;
          font-variant-ligatures: none;
          text-rendering: geometricPrecision;
        }

        .otb-svg .otb-i { font-style: italic; }

        .otb-svg .otb-rb {
          font-family: Roboto, Arial, Helvetica, sans-serif;
          font-weight: 400;
        }

        .otb-svg .otb-rb.otb-medium { font-weight: 500; }
        .otb-svg .otb-rb.otb-italic { font-style: italic; }

        .otb-svg .otb-line { stroke: #000000; fill: none; }
        .otb-svg .otb-tick { stroke: #000000; fill: none; stroke-linecap: round; stroke-linejoin: round; }

        @media print {
          .otb-page {
            width: 8.5in !important;
            height: 14in !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            break-after: auto !important;
            page-break-after: auto !important;
          }

          .otb-svg {
            width: 8.5in !important;
            height: 14in !important;
          }
        }
      `}</style>

      <svg
        className="otb-svg"
        viewBox="0 0 612 1008"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Offer To Buy and Buyer's Profile"
      >
        {/* Shaded section bands */}
        {FILLS.map(([x, y, width, height, fill], index) => (
          <rect key={`fill-${index}`} x={x} y={y} width={width} height={height} fill={fill} />
        ))}

        {/* Sales Officer box */}
        <rect x="332.62" y="112.42" width="122.74" height="15.16" fill="none" stroke="#000000" strokeWidth="0.6" />

        {/* Rules */}
        {H_LINES.map(([y, x1, x2, width], index) => (
          <line key={`h-${index}`} className="otb-line" x1={x1} y1={y} x2={x2} y2={y} strokeWidth={width} />
        ))}
        {V_LINES.map(([x, y1, y2, width], index) => (
          <line key={`v-${index}`} className="otb-line" x1={x} y1={y1} x2={x} y2={y2} strokeWidth={width} />
        ))}

        {/* Buyer Type boxes */}
        {Object.values(BUYER_TYPE_BOXES).map(([x, y, w, h], index) => (
          <rect
            key={`type-box-${index}`}
            x={x + 0.16}
            y={y + 0.16}
            width={w - 0.32}
            height={h - 0.32}
            rx="0.25"
            fill="none"
            stroke="#000000"
            strokeWidth="0.31"
          />
        ))}

        {/* Employment boxes (principal buyer) */}
        {Object.values(EMPLOYMENT_BOXES).map(([x, y, w, h], index) => (
          <rect
            key={`emp-box-${index}`}
            x={x + 0.19}
            y={y + 0.19}
            width={w - 0.38}
            height={h - 0.38}
            rx="0.25"
            fill="#ffffff"
            stroke="#666666"
            strokeWidth="0.375"
          />
        ))}

        {/* Civil Status picture, rebuilt for both buyers */}
        {CIVIL_OFFSETS.map(([dx, dy], side) => (
          <g key={`civil-${side}`} transform={`translate(${dx} ${dy})`}>
            {CIVIL_BOXES.map(([x, y, w, h], index) => (
              <rect
                key={index}
                x={x + 0.375}
                y={y + 0.375}
                width={w - 0.75}
                height={h - 0.75}
                fill="#ffffff"
                stroke="#666666"
                strokeWidth="0.75"
              />
            ))}
            {CIVIL_TEXT.map(([x, y, size, length, text], index) => (
              <text
                key={index}
                className="otb-rb"
                x={x}
                y={y}
                fontSize={size}
                textLength={length}
                lengthAdjust="spacingAndGlyphs"
              >
                {text}
              </text>
            ))}
          </g>
        ))}

        {/* Employment Status picture (spouse / second buyer), rebuilt */}
        {/* The reference picture has a white background that hides part of the rule above it */}
        <rect x="297.6" y="633.6" width="261.24" height="66.84" fill="#ffffff" />
        {EMPLOYMENT_PICTURE_BOXES.map(([x, y, w, h], index) => (
          <rect
            key={`emp-picture-box-${index}`}
            x={x + 0.375}
            y={y + 0.375}
            width={w - 0.75}
            height={h - 0.75}
            fill="#ffffff"
            stroke="#666666"
            strokeWidth="0.75"
          />
        ))}
        {EMPLOYMENT_TEXT.map(([x, y, size, length, weight, style, text], index) => (
          <text
            key={`emp-text-${index}`}
            className={`otb-rb${weight === 500 ? ' otb-medium' : ''}${style === 'italic' ? ' otb-italic' : ''}`}
            x={x}
            y={y}
            fontSize={size}
            textLength={length}
            lengthAdjust="spacingAndGlyphs"
          >
            {text}
          </text>
        ))}
        <line className="otb-line" x1="316.71" y1="699.18" x2="400.32" y2="699.18" strokeWidth="0.44" />

        {/* Printed labels */}
        {TEXT_RUNS.map(([x, y, size, style, text, width], index) => {
          const isBold = style === 'b' || style === 'ib' || style === 'w'
          const ink = style === 'w' ? '#ffffff' : '#000000'

          return (
            <text
              key={`text-${index}`}
              className={style === 'i' || style === 'ib' ? 'otb-i' : undefined}
              x={x}
              y={y}
              fontSize={size}
              fill={ink}
              stroke={isBold ? ink : undefined}
              strokeWidth={isBold ? size / 35 : undefined}
              strokeLinejoin={isBold ? 'miter' : undefined}
              strokeMiterlimit={isBold ? 10 : undefined}
              textLength={width}
              lengthAdjust="spacing"
            >
              {text}
            </text>
          )
        })}

        {/* ---------------- Filled-in values ---------------- */}

        {/* Header */}
        {Object.entries(BUYER_TYPE_BOXES).map(([key, box]) => (
          buyerType === key ? <TickIn key={key} box={box} size={7} /> : null
        ))}
        <Val x={336} y={123.3} w={116} size={9.5} minSize={6}>{seller}</Val>
        <Val x={530} y={127.61} w={66} size={9.5} minSize={6}>{dateReceived}</Val>

        {/* Property description */}
        <Val x={80} y={168.77} w={490} size={10.5} minSize={7}>{valueFrom(listing, ['project_location', 'location'], '')}</Val>
        <Val x={76.5} y={186.65} w={50}>{valueFrom(listing, ['property_type', 'propertyType'], 'Lot')}</Val>
        <Val x={189} y={186.65} w={23.5}>{valueFrom(listing, ['lotAreaSqm', 'lot_area_sqm', 'area'], '')}</Val>
        <Val x={270} y={186.65} w={23.5} size={7} minSize={6}>{valueFrom(listing, ['classification'], '')}</Val>
        <Val x={400.5} y={186.65} w={172}>{description}</Val>

        {/* Offer terms and conditions */}
        {isCash ? <Tick cx={PAYMENT_BOXES.cash[0]} cy={PAYMENT_BOXES.cash[1]} size={9} /> : null}
        {isInstallment ? <Tick cx={PAYMENT_BOXES.installment[0]} cy={PAYMENT_BOXES.installment[1]} size={9} /> : null}

        <Val x={149} y={265.37} w={144} size={9}>{isCash ? plainMoney(tcp) : ''}</Val>
        <Val x={132.5} y={277.61} w={160} size={9}>{isCash ? plainMoney(reservationFee) : ''}</Val>
        <Val x={132.5} y={300.77} w={160} size={9}>{isCash ? plainMoney(Math.max(tcp - reservationFee, 0)) : ''}</Val>

        <Val x={409.5} y={265.37} w={163} size={9}>{isInstallment ? plainMoney(tcp) : ''}</Val>
        <Val x={393} y={277.61} w={179.5} size={9}>{isInstallment ? plainMoney(reservationFee) : ''}</Val>
        <Val x={393} y={300.77} w={179.5} size={9}>{isInstallment ? plainMoney(downpayment) : ''}</Val>
        <Val x={393} y={324.05} w={179.5} size={9}>{isInstallment ? plainMoney(balance) : ''}</Val>
        <Val x={393} y={347.09} w={179.5} size={9}>{isInstallment && monthlyTerms > 0 ? `${monthlyTerms} months` : ''}</Val>
        <Val x={393} y={371.81} w={179.5} size={9}>{isInstallment ? interestRate : ''}</Val>
        <Val x={422.5} y={395.45} w={150} size={9}>{isInstallment ? plainMoney(monthly) : ''}</Val>

        {/* Individual buyer/s information */}
        {buyers.map((values, side) => (
          <BuyerBlock key={`buyer-${side}`} cells={BUYER_CELLS[side]} values={values} />
        ))}

        {/* Civil status ticks */}
        {CIVIL_OFFSETS.map(([dx, dy], side) => (
          CIVIL_KEYS.map((key, index) => (
            isCivilChecked(buyers[side].civil, key)
              ? (
                <g key={`civil-tick-${side}-${key}`} transform={`translate(${dx} ${dy})`}>
                  <TickIn box={CIVIL_BOXES[index]} size={9} />
                </g>
              )
              : null
          ))
        ))}

        {/* Work / business information */}
        {EMPLOYMENT_KEYS.map((key, index) => (
          isEmploymentStatusChecked(buyers[0].employmentStatus, key)
            ? <TickIn key={`emp-tick-0-${key}`} box={Object.values(EMPLOYMENT_BOXES)[index]} size={9} />
            : null
        ))}
        {EMPLOYMENT_KEYS.map((key, index) => (
          isEmploymentStatusChecked(buyers[1].employmentStatus, key)
            ? <TickIn key={`emp-tick-1-${key}`} box={EMPLOYMENT_PICTURE_BOXES[index]} size={9} />
            : null
        ))}
        {buyers.map((values, side) => (
          <WorkBlock key={`work-${side}`} cells={WORK_CELLS[side]} values={values} />
        ))}

        {/* Income details (monthly) */}
        <Val x={195.75} y={816.9} w={100} size={9.5} anchor="middle">{plainMoney(monthlyIncome)}</Val>
        <Val x={346.44} y={816.9} w={100} size={9.5} anchor="middle">{plainMoney(secondMonthlyIncome)}</Val>
        <Val x={503.73} y={816.9} w={100} size={9.5} anchor="middle">{plainMoney(totalIncome)}</Val>

        {/* Sales agent */}
        {sellerLastName || sellerFirstName || sellerMiddleName ? (
          <>
            <Val x={72.2} y={901.85} w={80} size={9} anchor="middle">{sellerLastName}</Val>
            <Val x={170.6} y={901.85} w={90} size={9} anchor="middle">{sellerFirstName}</Val>
            <Val x={254.6} y={901.85} w={74} size={9} anchor="middle">{sellerMiddleName}</Val>
          </>
        ) : (
          // Only a single full name is on file: write it across the whole Name line.
          <Val x={47} y={901.85} w={244} size={9}>{seller}</Val>
        )}
        <Val x={331} y={901.85} w={242} size={9}>{sellerTinNo}</Val>
        <Val x={331} y={913.61} w={242} size={8.5}>{sellerAddress}</Val>
      </svg>
    </section>
  )
}

export default OfferToBuyForm

