/**
 * The historical-receipt form and Accredited Sellers use the same
 * ProofOfIncomeDoubleCheck component. Supply its established data contract:
 * seller, property, selectedReleases, totalAmount and receiptDetails.
 * This builds review-only metadata; it never creates or changes a payout.
 */
export const buildMissingProofOfIncomeReview = ({ commissionGroup, commission, missingReceiptChoice, receiptDetails, paymentMethod = 'bank_transfer' }) => {
  const choice = missingReceiptChoice || {}
  const group = commissionGroup || {}
  const seller = commission || {}
  const details = receiptDetails || {}
  const receiptAmount = Number(choice.amount)
  const commissionId = Number(choice.commissionId)
  const releaseId = Number(choice.releaseId)
  const sellerId = Number(choice.sellerId)
  const fields = {
    seller: String(seller.seller || '').trim(),
    project: String(group.project || '').trim(),
    unit: String(group.unit || '').trim(),
    buyer: String(group.client || '').trim(),
    stage: String(choice.stage || '').trim(),
  }
  if (Object.values(fields).some((value) => !value || value === '-')
      || !Number.isSafeInteger(commissionId) || commissionId <= 0
      || !Number.isSafeInteger(releaseId) || releaseId <= 0
      || !Number.isSafeInteger(sellerId) || sellerId <= 0
      || !Number.isFinite(receiptAmount) || receiptAmount <= 0) {
    throw new Error('The paid seller, buyer, property, or release details are incomplete. Refresh Commission Details before linking a receipt.')
  }

  const actualReleaseDate = String(choice.actualReleaseDate || '').slice(0, 10)
  const receipt = {
    paymentMethod,
    bankName: paymentMethod === 'cash' ? 'Not applicable (Cash)' : String(details.bankName || '').trim(),
    accountNumber: paymentMethod === 'cash' ? 'Not applicable' : String(details.accountNumber || '').trim(),
    receiptDate: String(details.receiptDate || '').trim(),
    referenceNumber: paymentMethod === 'cash' ? 'Generated automatically on save' : String(details.referenceNumber || '').trim(),
    witnessName: String(details.witnessName || '').trim(),
  }
  if (!actualReleaseDate || Object.values(receipt).some((value) => !value)) {
    throw new Error('The original payment date or receipt details are incomplete. Review the entered values before linking the receipt.')
  }
  return {
    action: 'create-existing-release-receipt',
    commissionId,
    releaseId,
    // Preserve the same review schema as Accredited Sellers: no fabricated payout.
    seller: { name: fields.seller },
    property: { project: fields.project, unit: fields.unit, buyer: fields.buyer },
    selectedReleases: [{
      releaseId,
      stage: fields.stage,
      releasePercent: Number(choice.releasePercent) || 0,
      triggerPercent: Number(choice.triggerPercent) || 0,
      amount: receiptAmount,
      releaseDate: actualReleaseDate,
      status: 'Released',
    }],
    totalAmount: receiptAmount,
    receiptDetails: receipt,
    note: 'The commission payment was already released. This action records only its missing receipt.',
  }
}



