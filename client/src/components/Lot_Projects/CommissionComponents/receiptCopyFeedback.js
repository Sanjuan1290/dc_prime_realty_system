// Copy only the shared receipt fields; each payee keeps their own payment method,
// bank/account, and payment reference. UI notifications reflect actual changes.
export const copyReceiptDateAndWitness = (forms, selectedKey) => {
  const source = forms?.[selectedKey]?.receiptDetails;
  if (!source?.receiptDate || !String(source?.witnessName || '').trim()) {
    return { forms, copied: 0, reason: 'missing_source' };
  }
  let copied = 0;
  const updated = Object.fromEntries(Object.entries(forms).map(([key, form]) => {
    if (key === selectedKey) return [key, form];
    const receipt = form.receiptDetails || {};
    if (receipt.receiptDate === source.receiptDate && receipt.witnessName === source.witnessName) return [key, form];
    copied += 1;
    return [key, { ...form, receiptDetails: {
      ...receipt, receiptDate: source.receiptDate, witnessName: source.witnessName,
    } }];
  }));
  return { forms: copied ? updated : forms, copied, reason: copied ? 'copied' : 'unchanged' };
};
