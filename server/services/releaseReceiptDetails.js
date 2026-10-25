// Shared input rules: a release and its receipt are one financial transaction.
const clean = (value) => String(value ?? '').trim();
const properIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export const validateReleaseReceiptDetails = (input, actualReleaseDate, today, paymentMethod = 'bank_transfer') => {
  const isCash = paymentMethod === 'cash';
  const fields = {
    bankName: isCash ? 'Not applicable (Cash)' : clean(input?.bankName),
    accountNumber: isCash ? 'Not applicable' : clean(input?.accountNumber),
    receiptDate: clean(input?.receiptDate),
    referenceNumber: clean(input?.referenceNumber),
    witnessName: clean(input?.witnessName),
  };
  for (const [name, max] of Object.entries({ bankName: 150, accountNumber: 100, referenceNumber: 120, witnessName: 255 })) {
    if (!fields[name] || fields[name].length > max) {
      const error = new Error(`Receipt ${name} is required and must not exceed ${max} characters.`);
      error.statusCode = 400; throw error;
    }
  }
  if (!properIsoDate(fields.receiptDate) || fields.receiptDate > today ||
      (actualReleaseDate && fields.receiptDate < actualReleaseDate)) {
    const error = new Error('Receipt date must be valid, not in the future, and not earlier than the actual release date.');
    error.statusCode = 400; throw error;
  }
  return fields;
};


