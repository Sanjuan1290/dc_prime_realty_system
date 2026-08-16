import { Buffer } from 'node:buffer';

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const DEFAULT_COMPANY = 'D&C Prime Realty';

const toAscii = (value = '') => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/₱/g, 'PHP ')
  .replace(/[^\x20-\x7E]/g, '?');

const escapePdfText = (value = '') => toAscii(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const cleanMoney = (value) => Number(Number(value || 0).toFixed(2));

const amountOnly = (value) => new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(cleanMoney(value));

const toDateOnly = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value.slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 10);
};

const longDate = (value) => {
  const clean = toDateOnly(value);
  if (clean === '-') return clean;
  const [year, month, day] = clean.split('-').map(Number);
  if (!year || !month || !day) return clean;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

export const getManilaDateOnly = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const formatSoaReference = (statementId, statementDate = getManilaDateOnly()) => {
  const year = String(statementDate || '').slice(0, 4) || String(new Date().getFullYear());
  return `SOA-${year}-${String(Number(statementId || 0)).padStart(6, '0')}`;
};

export const sanitizeAttachmentFileName = (value = 'statement-of-account') => {
  const cleaned = String(value || 'statement-of-account')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${cleaned || 'statement-of-account'}.pdf`;
};

const approximateTextWidth = (text, fontSize) => toAscii(text).length * fontSize * 0.52;

const wrapText = (text, maxWidth, fontSize) => {
  const words = toAscii(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && approximateTextWidth(candidate, fontSize) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const normalizeJpegImage = (image = null) => {
  const content = Buffer.isBuffer(image?.content)
    ? image.content
    : image?.content
      ? Buffer.from(image.content)
      : null;

  if (!content || content.length < 12 || content[0] !== 0xff || content[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < content.length) {
    while (offset < content.length && content[offset] !== 0xff) offset += 1;
    while (offset < content.length && content[offset] === 0xff) offset += 1;
    if (offset >= content.length) break;

    const marker = content[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) continue;
    if (offset + 1 >= content.length) break;

    const segmentLength = content.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > content.length) break;

    if (JPEG_SOF_MARKERS.has(marker) && segmentLength >= 8) {
      const height = content.readUInt16BE(offset + 3);
      const width = content.readUInt16BE(offset + 5);
      const components = content[offset + 7] || 3;
      if (width > 0 && height > 0) {
        return {
          content,
          width,
          height,
          colorSpace: components === 1 ? '/DeviceGray' : components === 4 ? '/DeviceCMYK' : '/DeviceRGB',
        };
      }
    }

    offset += segmentLength;
  }

  return null;
};

const fitImageInside = (image, boxX, boxTop, boxWidth, boxHeight) => {
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: boxX + (boxWidth - width) / 2,
    top: boxTop + (boxHeight - height) / 2,
    width,
    height,
  };
};

const createContentBuilder = () => {
  const commands = [];
  const y = (top) => PAGE_HEIGHT - top;

  const setStroke = (r = 0, g = 0, b = 0) => commands.push(`${r} ${g} ${b} RG`);
  const setFill = (r = 0, g = 0, b = 0) => commands.push(`${r} ${g} ${b} rg`);
  const setLineWidth = (width = 1) => commands.push(`${width} w`);

  const line = (x1, top1, x2, top2, options = {}) => {
    setStroke(...(options.stroke || [0, 0, 0]));
    setLineWidth(options.width || 1);
    if (options.dash) commands.push(`[${options.dash.join(' ')}] 0 d`);
    else commands.push('[] 0 d');
    commands.push(`${x1} ${y(top1)} m ${x2} ${y(top2)} l S`);
  };

  const rect = (x, top, width, height, options = {}) => {
    const bottom = y(top + height);
    if (options.fill) {
      setFill(...options.fill);
      commands.push(`${x} ${bottom} ${width} ${height} re f`);
    }
    if (options.stroke !== false) {
      setStroke(...(options.stroke || [0, 0, 0]));
      setLineWidth(options.lineWidth || 1);
      commands.push('[] 0 d');
      commands.push(`${x} ${bottom} ${width} ${height} re S`);
    }
  };

  const text = (value, x, top, options = {}) => {
    const fontSize = options.size || 10;
    const font = options.bold ? 'F2' : 'F1';
    const safe = escapePdfText(value);
    let drawX = x;
    if (options.align === 'right' && Number.isFinite(options.width)) {
      drawX = x + options.width - approximateTextWidth(value, fontSize);
    } else if (options.align === 'center' && Number.isFinite(options.width)) {
      drawX = x + (options.width - approximateTextWidth(value, fontSize)) / 2;
    }
    setFill(...(options.fill || [0, 0, 0]));
    commands.push(`BT /${font} ${fontSize} Tf 1 0 0 1 ${drawX.toFixed(2)} ${(y(top) - fontSize).toFixed(2)} Tm (${safe}) Tj ET`);
  };

  const wrappedText = (value, x, top, width, options = {}) => {
    const fontSize = options.size || 10;
    const lineHeight = options.lineHeight || fontSize * 1.25;
    const lines = wrapText(value, width, fontSize);
    lines.forEach((item, index) => text(item, x, top + index * lineHeight, { ...options, width }));
    return lines.length * lineHeight;
  };

  const image = (name, x, top, width, height) => {
    const bottom = y(top + height);
    commands.push(`q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${bottom.toFixed(2)} cm /${name} Do Q`);
  };

  return { commands, line, rect, text, wrappedText, image };
};

const buildPdfBuffer = (content, metadata = {}, logoImage = null) => {
  const stream = Buffer.from(content, 'latin1');
  const title = escapePdfText(metadata.title || 'Statement of Account');
  const author = escapePdfText(metadata.author || DEFAULT_COMPANY);
  const createdAt = new Date();
  const pdfDate = `D:${createdAt.getUTCFullYear()}${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}${String(createdAt.getUTCDate()).padStart(2, '0')}${String(createdAt.getUTCHours()).padStart(2, '0')}${String(createdAt.getUTCMinutes()).padStart(2, '0')}${String(createdAt.getUTCSeconds()).padStart(2, '0')}Z`;
  const normalizedLogo = normalizeJpegImage(logoImage);
  const logoObjectId = normalizedLogo ? 7 : null;
  const infoObjectId = normalizedLogo ? 8 : 7;
  const resourceXObject = normalizedLogo ? ` /XObject << /Logo ${logoObjectId} 0 R >>` : '';

  const objects = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${resourceXObject} >> /Contents 6 0 R >>`,
    4: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    5: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    6: Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'),
      stream,
      Buffer.from('\nendstream', 'latin1'),
    ]),
    [infoObjectId]: `<< /Title (${title}) /Author (${author}) /Creator (D&C Prime Realty System) /CreationDate (${pdfDate}) >>`,
  };

  if (normalizedLogo) {
    objects[logoObjectId] = Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width ${normalizedLogo.width} /Height ${normalizedLogo.height} /ColorSpace ${normalizedLogo.colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${normalizedLogo.content.length} >>\nstream\n`,
        'latin1'
      ),
      normalizedLogo.content,
      Buffer.from('\nendstream', 'latin1'),
    ]);
  }

  const objectCount = infoObjectId;
  const parts = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'binary')];
  const offsets = [0];
  let length = parts[0].length;

  for (let id = 1; id <= objectCount; id += 1) {
    offsets[id] = length;
    const body = Buffer.isBuffer(objects[id]) ? objects[id] : Buffer.from(objects[id], 'latin1');
    const objectBuffer = Buffer.concat([
      Buffer.from(`${id} 0 obj\n`, 'latin1'),
      body,
      Buffer.from('\nendobj\n', 'latin1'),
    ]);
    parts.push(objectBuffer);
    length += objectBuffer.length;
  }

  const xrefOffset = length;
  const xrefLines = ['xref', `0 ${objectCount + 1}`, '0000000000 65535 f '];
  for (let id = 1; id <= objectCount; id += 1) {
    xrefLines.push(`${String(offsets[id]).padStart(10, '0')} 00000 n `);
  }
  const trailer = Buffer.from(
    `${xrefLines.join('\n')}\ntrailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info ${infoObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    'latin1'
  );
  parts.push(trailer);
  return Buffer.concat(parts);
};

export const buildSoaPdfBuffer = ({ notification = {}, soaReference, statementDate, logoImage = null }) => {
  const builder = createContentBuilder();
  const { line, rect, text, wrappedText, image } = builder;
  const normalizedLogo = normalizeJpegImage(logoImage);
  const companyName = notification.companyName || DEFAULT_COMPANY;
  const companyEmail = notification.companyEmail || 'dcprimerealty@gmail.com';
  const companyContactNumber = notification.companyContactNumber || '(046) 866-0616';
  const statementDateLabel = longDate(statementDate);
  const dueDateLabel = longDate(notification.dueDate);
  const isOverdue = notification.notificationType === 'overdue';
  const amountDueImmediately = isOverdue ? cleanMoney(notification.paymentDue) : 0;
  const left = 38;
  const right = PAGE_WIDTH - 38;

  if (normalizedLogo) {
    const logoPlacement = fitImageInside(normalizedLogo, left, 28, 54, 54);
    image('Logo', logoPlacement.x, logoPlacement.top, logoPlacement.width, logoPlacement.height);
  } else {
    rect(left, 35, 48, 48, { fill: [0.05, 0.05, 0.05], stroke: [0.75, 0.55, 0.12], lineWidth: 2 });
    text('D&C', left, 50, { size: 13, bold: true, width: 48, align: 'center', fill: [0.95, 0.72, 0.18] });
    text('PRIME', left, 66, { size: 6.5, bold: true, width: 48, align: 'center', fill: [0.95, 0.72, 0.18] });
  }
  text(companyName, left + 62, 38, { size: 13, bold: true });
  text("Unit D, Mia's Building, Purok 1,", left + 62, 57, { size: 8.5 });
  text('Mataas na Lupa, Indang, Cavite, 4122 Philippines', left + 62, 70, { size: 8.5 });

  const infoX = 510;
  const infoW = right - infoX;
  text('STATEMENT OF ACCOUNT', infoX, 33, { size: 15, bold: true, width: infoW, align: 'center' });
  const infoRows = [
    ['Statement Date', `As of ${statementDateLabel}`],
    ['SOA Number', soaReference],
    ['Project', notification.projectName || '-'],
    ['Unit No.', notification.unitId || '-'],
  ];
  const infoTop = 56;
  const infoRowH = 18;
  const infoLabelW = 105;
  infoRows.forEach(([label, value], index) => {
    const top = infoTop + index * infoRowH;
    rect(infoX, top, infoLabelW, infoRowH);
    rect(infoX + infoLabelW, top, infoW - infoLabelW, infoRowH);
    text(label, infoX + 5, top + 4, { size: 8.5, bold: true });
    text(value, infoX + infoLabelW + 4, top + 4, { size: 8.5, width: infoW - infoLabelW - 8, align: 'center' });
  });

  const amountTop = 154;
  text('AMOUNT DETAILS', infoX, amountTop - 18, { size: 12, bold: true, width: infoW, align: 'center' });
  const amountRows = [
    ['Total Contract Price', amountOnly(notification.totalContractPrice)],
    ['Legal/Miscellaneous', amountOnly(notification.legalMiscFee)],
    ['Total Amount', `PHP ${amountOnly(notification.totalContractPrice)}`],
  ];
  amountRows.forEach(([label, value], index) => {
    const top = amountTop + index * infoRowH;
    rect(infoX, top, infoLabelW, infoRowH);
    rect(infoX + infoLabelW, top, infoW - infoLabelW, infoRowH);
    text(label, infoX + 5, top + 4, { size: 8.5, bold: index === 2 });
    text(value, infoX + infoLabelW + 5, top + 4, { size: 8.5, bold: index === 2, width: infoW - infoLabelW - 10, align: 'right' });
  });

  line(left, 224, right, 224, { width: 0.7, dash: [3, 2] });

  const billX = 110;
  const billW = 620;
  const billTop = 239;
  rect(billX, billTop, billW, 24, { lineWidth: 1.5 });
  text('This is to bill the total amount of', billX + 7, billTop + 6, { size: 10, bold: true });
  text(amountOnly(notification.paymentDue), billX + billW - 175, billTop + 6, { size: 10, bold: true, width: 165, align: 'right' });

  const detailRows = [
    [isOverdue ? 'Overdue Amount' : 'Amortization', amountOnly(isOverdue ? notification.paymentDue : 0)],
    ['Penalty', amountOnly(notification.penaltyAmount)],
    ['Miscellaneous Fees & Adjustments', '0.00'],
    ['Amount Due Immediately', amountOnly(amountDueImmediately)],
  ];
  detailRows.forEach(([label, value], index) => {
    const top = 274 + index * 17;
    text(label, billX + 7, top, { size: 9, bold: index === 3 });
    text(value, billX + billW - 175, top, { size: 9, bold: index === 3, width: 165, align: 'right' });
  });

  const dueTop = 352;
  text(`${notification.description || 'Payment'} Due on ${dueDateLabel}`, billX + 7, dueTop, { size: 11, bold: true });
  text(amountOnly(notification.paymentDue), billX + billW - 175, dueTop, { size: 11, bold: true, width: 165, align: 'right' });

  text(`NOTE: All transactions after ${statementDateLabel} are not reflected in this Statement of Account (SOA).`, billX + 7, 393, { size: 8.5, bold: true });
  line(left, 416, right, 416, { width: 0.7, dash: [3, 2] });

  const notes = [
    'Please pay on or before the due date to avoid penalties.',
    'Payments made after the statement date may not yet be reflected.',
    'If payment has already been made, kindly disregard this statement.',
    `For inquiries, call ${companyContactNumber} or email ${companyEmail}.`,
  ];
  notes.forEach((note, index) => text(`- ${note}`, billX + 7, 430 + index * 15, { size: 8.5 }));

  text('PAYMENT REMINDERS', left, 499, { size: 9.5, bold: true, width: right - left, align: 'center' });
  text("- Always provide the buyer's full name and CIN when making payments.", billX + 7, 518, { size: 8.5 });
  text('- All check payments should be made payable to the order of D&C PRIME REALTY.', billX + 7, 533, { size: 8.5 });
  line(left, 548, right, 548, { width: 0.7, dash: [3, 2] });
  line(left, 570, right, 570, { width: 2.2 });
  wrappedText(`Prepared for ${notification.buyerName || 'Buyer'}`, left, 552, 300, { size: 7.5 });

  return buildPdfBuffer(builder.commands.join('\n'), {
    title: `${soaReference} - ${notification.projectName || 'Project'} ${notification.unitId || ''}`,
    author: companyName,
  }, normalizedLogo);
};


export const buildMissingDocumentsPdfBuffer = ({
  companyName = DEFAULT_COMPANY,
  companyEmail = 'dcprimerealty@gmail.com',
  companyContactNumber = '(046) 866-0616',
  buyerName = 'Buyer',
  projectName = 'Lot Project',
  unitId = '-',
  generatedDate = getManilaDateOnly(),
  missingDocuments = [],
  rejectedDocuments = [],
  logoImage = null,
} = {}) => {
  const builder = createContentBuilder();
  const { line, rect, text, wrappedText, image } = builder;
  const normalizedLogo = normalizeJpegImage(logoImage);
  const left = 48;
  const right = PAGE_WIDTH - 48;
  const contentWidth = right - left;
  const safeMissing = Array.isArray(missingDocuments) ? missingDocuments.filter(Boolean) : [];
  const safeRejected = Array.isArray(rejectedDocuments) ? rejectedDocuments.filter(Boolean) : [];
  const totalPending = safeMissing.length + safeRejected.length;

  if (normalizedLogo) {
    const logoPlacement = fitImageInside(normalizedLogo, left, 28, 56, 56);
    image('Logo', logoPlacement.x, logoPlacement.top, logoPlacement.width, logoPlacement.height);
  } else {
    rect(left, 34, 50, 50, { fill: [0.05, 0.05, 0.05], stroke: [0.75, 0.55, 0.12], lineWidth: 2 });
    text('D&C', left, 49, { size: 13, bold: true, width: 50, align: 'center', fill: [0.95, 0.72, 0.18] });
    text('PRIME', left, 66, { size: 6.5, bold: true, width: 50, align: 'center', fill: [0.95, 0.72, 0.18] });
  }
  text(companyName, left + 66, 40, { size: 15, bold: true });
  text('MISSING DOCUMENT REQUIREMENTS', left + 66, 61, { size: 11, bold: true, fill: [0.12, 0.29, 0.58] });
  text(`Generated: ${longDate(generatedDate)}`, right - 190, 42, { size: 8.5, width: 190, align: 'right' });
  line(left, 96, right, 96, { width: 1.2, stroke: [0.2, 0.32, 0.5] });

  const infoTop = 112;
  const infoRows = [
    ['Client', buyerName || 'Buyer'],
    ['Project', projectName || 'Lot Project'],
    ['Unit No.', unitId || '-'],
    ['Pending Required Documents', String(totalPending)],
  ];
  const labelWidth = 185;
  const rowHeight = 24;
  infoRows.forEach(([label, value], index) => {
    const top = infoTop + index * rowHeight;
    rect(left, top, labelWidth, rowHeight, { fill: [0.96, 0.97, 0.99], stroke: [0.78, 0.82, 0.88] });
    rect(left + labelWidth, top, contentWidth - labelWidth, rowHeight, { stroke: [0.78, 0.82, 0.88] });
    text(label, left + 8, top + 7, { size: 9, bold: true, fill: [0.28, 0.36, 0.48] });
    text(value, left + labelWidth + 9, top + 7, { size: 9.5, bold: index === 3 });
  });

  let cursorTop = infoTop + infoRows.length * rowHeight + 18;
  const introHeight = wrappedText(
    'Please submit the documents listed below so we can continue processing your account. Documents marked RESUBMIT were previously rejected and need a corrected copy.',
    left,
    cursorTop,
    contentWidth,
    { size: 9, lineHeight: 12 }
  );
  cursorTop += introHeight + 12;

  rect(left, cursorTop, contentWidth, 24, { fill: [0.92, 0.95, 1], stroke: [0.75, 0.82, 0.9] });
  text('DOCUMENTS REQUIRING ACTION', left + 10, cursorTop + 7, { size: 10, bold: true, fill: [0.12, 0.29, 0.58] });
  cursorTop += 24;

  const actionItems = [
    ...safeMissing.map((name) => ({ name, status: 'MISSING' })),
    ...safeRejected.map((name) => ({ name, status: 'RESUBMIT' })),
  ];

  if (!actionItems.length) {
    rect(left, cursorTop, contentWidth, 30, { stroke: [0.82, 0.85, 0.9] });
    text('No missing or rejected required documents.', left + 14, cursorTop + 10, { size: 9, fill: [0.38, 0.45, 0.55] });
    cursorTop += 30;
  } else {
    const columnGap = 12;
    const columnWidth = (contentWidth - columnGap) / 2;
    const leftItems = actionItems.slice(0, Math.ceil(actionItems.length / 2));
    const rightItems = actionItems.slice(Math.ceil(actionItems.length / 2));
    const drawColumn = (items, x, startIndex = 0) => {
      let top = cursorTop;
      items.forEach((item, index) => {
        const labelWidth = 62;
        const nameLines = wrapText(item.name, columnWidth - labelWidth - 20, 7.8);
        const height = Math.max(19, 7 + nameLines.length * 9);
        const isRejected = item.status === 'RESUBMIT';
        rect(x, top, columnWidth, height, { stroke: [0.82, 0.85, 0.9] });
        rect(x, top, labelWidth, height, {
          fill: isRejected ? [1, 0.94, 0.92] : [0.94, 0.96, 1],
          stroke: false,
        });
        text(item.status, x + 6, top + 6, {
          size: 7.2,
          bold: true,
          fill: isRejected ? [0.72, 0.18, 0.12] : [0.12, 0.29, 0.58],
        });
        text(`${startIndex + index + 1}.`, x + labelWidth + 6, top + 6, { size: 7.8, bold: true });
        nameLines.forEach((lineText, lineIndex) => {
          text(lineText, x + labelWidth + 20, top + 6 + lineIndex * 9, { size: 7.8 });
        });
        top += height;
      });
      return top;
    };

    const leftBottom = drawColumn(leftItems, left, 0);
    const rightBottom = drawColumn(rightItems, left + columnWidth + columnGap, leftItems.length);
    cursorTop = Math.max(leftBottom, rightBottom);
  }

  const footerTop = Math.min(Math.max(cursorTop + 18, 500), 545);
  line(left, footerTop, right, footerTop, { width: 0.7, stroke: [0.75, 0.8, 0.87] });
  text(
    `For questions, contact ${companyName} at ${companyContactNumber} or ${companyEmail}.`,
    left,
    footerTop + 11,
    { size: 8.2, width: contentWidth, align: 'center', fill: [0.32, 0.4, 0.52] }
  );
  text(
    'This is an auto-generated document. Please do not reply directly to this email.',
    left,
    footerTop + 25,
    { size: 7.8, width: contentWidth, align: 'center', fill: [0.42, 0.48, 0.58] }
  );

  return buildPdfBuffer(builder.commands.join('\n'), {
    title: `Missing Document Requirements - ${unitId || 'Unit'}`,
    author: companyName,
  }, normalizedLogo);
};
