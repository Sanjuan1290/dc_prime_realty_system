import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { formatDate, money, percent, pick, requirementLabel, roleLabel, statusLabel, titleCase } from './core/doubleCheckFormatters'
import { buyerEmploymentReviewFields, hasSecondBuyerReviewData, principalBuyerReviewFields, secondBuyerReviewFields } from './BuyerProfileDoubleCheck'

const ReservationDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const listing = data.listing || {}
  const buyer = data.buyerProfile || data.clientProfile || {}
  const documents = Array.isArray(data.documentRequirements) ? data.documentRequirements : Array.isArray(data.documents) ? data.documents : []
  const terms = data.paymentTerms || data.reservation?.paymentTerms || {}
  const seller = data.sellerAssignment || data.reservation?.seller || {}

  const steps = [
    { key: 'listing', title: 'Listing & Pricing', content: <DoubleCheckSection title="Listing & Pricing" helper="Verify the property and reservation pricing." tone="blue"><DoubleCheckFields fields={[
      { label: 'Project', value: pick(listing, 'project', 'projectName') },
      { label: 'Unit', value: pick(listing, 'unit', 'unitCode') },
      { label: 'Lot Type', value: pick(listing, 'lotType'), formatter: titleCase },
      { label: 'Area (SQM)', value: pick(listing, 'areaSqm') },
      { label: 'Mode of Payment', value: pick(listing, 'modeOfPayment') || pick(data.reservation || {}, 'modeOfPayment'), formatter: titleCase },
      { label: 'Selected Price / SQM', value: pick(listing, 'selectedPricePerSqm'), formatter: money, tone: 'financial' },
      { label: 'Base Selling Price', value: pick(listing, 'baseSellingPrice'), formatter: money, tone: 'financial' },
      { label: 'Sale Discount Amount', value: pick(listing, 'saleDiscountAmount'), formatter: money, tone: 'financial' },
      { label: 'Net Selling Price', value: pick(listing, 'netSellingPrice'), formatter: money, tone: 'financial' },
      { label: 'Final TCP', value: pick(listing, 'tcp'), formatter: money, tone: 'financial' },
      { label: 'Reservation Fee', value: pick(listing, 'reservationFee') || pick(terms, 'reservationFee'), formatter: money, tone: 'financial' },
    ]} /></DoubleCheckSection> },
    { key: 'buyer', title: 'Buyer Information', content: <div className="space-y-4"><DoubleCheckSection title="Principal Buyer" helper="Verify every identity, contact, and address value entered for the principal buyer." tone="violet"><DoubleCheckFields fields={principalBuyerReviewFields(buyer)} /></DoubleCheckSection><DoubleCheckSection title="Principal Buyer Work / Business" helper="Verify employment, occupation, business, and monthly income information." tone="amber"><DoubleCheckFields fields={buyerEmploymentReviewFields(buyer)} /></DoubleCheckSection>{hasSecondBuyerReviewData(buyer) ? <><DoubleCheckSection title="Second Buyer" helper="Verify every identity, contact, and address value entered for the spouse or co-buyer." tone="violet"><DoubleCheckFields fields={secondBuyerReviewFields(buyer)} /></DoubleCheckSection><DoubleCheckSection title="Second Buyer Work / Business" helper="Verify the second buyer's employment and income information." tone="amber"><DoubleCheckFields fields={buyerEmploymentReviewFields(buyer, 'secondBuyer')} /></DoubleCheckSection></> : null}</div> },
    { key: 'documents', title: 'Document Checklist', content: <DoubleCheckSection title="Document Checklist" helper="Verify every selected document and whether it is Required or Optional." tone="emerald" badge={`${documents.length} document${documents.length === 1 ? '' : 's'}`}>{documents.length ? <div className="space-y-3">{documents.map((document, index) => <DoubleCheckListCard key={`${pick(document, 'document_id', 'id') || index}`} title={pick(document, 'name', 'document_name', 'reviewTitle') || `Document ${index + 1}`} subtitle={pick(document, 'source')} index={index} total={documents.length} fields={[
      { label: 'Requirement', value: pick(document, 'requirement', 'is_required'), formatter: requirementLabel },
      { label: 'Status', value: pick(document, 'status', 'document_status') || 'active', formatter: statusLabel },
    ]} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No documents are selected for this reservation.</p>}</DoubleCheckSection> },
    { key: 'terms', title: 'Payment Terms & Financials', content: <DoubleCheckSection title="Payment Terms & Financials" helper="Verify amounts, dates, terms, discounts, interest, and penalty settings." tone="amber"><DoubleCheckFields fields={[
      { label: 'Reservation Fee', value: pick(terms, 'reservationFee'), formatter: money, tone: 'financial' },
      { label: 'Historical / Backdated Entry', value: Boolean(pick(terms, 'isHistoricalEntry')) ? 'Yes' : 'No' },
      { label: 'Starting Date', value: pick(terms, 'startingDate'), formatter: formatDate },
      { label: 'First Due / Full Payment Due Date', value: pick(terms, 'firstDueDate'), formatter: formatDate },
      { label: 'LMF Rate', value: pick(terms, 'legalMiscFeeRate'), formatter: percent, tone: 'financial' },
      { label: 'Legal / Misc Fee Treatment', value: pick(terms, 'legalMiscFeeMode', 'legalMiscFee'), formatter: titleCase },
      { label: 'Sale Discount', value: pick(terms, 'saleDiscountPercentage'), formatter: percent, tone: 'financial' },
      { label: 'Downpayment Input Mode', value: pick(terms, 'downpaymentInputMode', 'downpaymentPercentageMode'), formatter: titleCase },
      { label: 'Downpayment Percentage', value: pick(terms, 'downpaymentPercentage'), formatter: percent, tone: 'financial' },
      { label: 'Actual Downpayment Amount', value: pick(terms, 'downpaymentAmount', 'customDownpaymentAmount'), formatter: money, tone: 'financial' },
      { label: 'Downpayment Terms', value: pick(terms, 'downpaymentTerms') },
      { label: 'Reservation Fee Treatment', value: pick(terms, 'reservationFeeTreatment'), formatter: titleCase },
      { label: 'Downpayment Discount', value: pick(terms, 'dpDiscountPercentage'), formatter: percent, tone: 'financial' },
      { label: 'Monthly Terms', value: pick(terms, 'monthlyTerms') },
      { label: 'Annual Interest Rate', value: pick(terms, 'interestRate', 'annualInterestRate'), formatter: percent, tone: 'financial' },
      { label: 'Daily Penalty Rate', value: pick(terms, 'dailyPenaltyRate'), formatter: percent, tone: 'financial' },
      { label: 'Penalty-Free Grace Period (Days)', value: pick(terms, 'penaltyGraceDays') },
    ]} /></DoubleCheckSection> },
    { key: 'seller', title: 'Seller Assignment', content: <DoubleCheckSection title="Seller Assignment" helper="Verify the seller and commission assignment used for this reservation." tone="violet"><DoubleCheckFields fields={[
      { label: 'Seller', value: pick(seller, 'sellerName', 'name', 'fullName') },
      { label: 'Seller Role', value: pick(seller, 'role', 'sellerRole'), formatter: roleLabel },
      { label: 'Seller Group', value: pick(seller, 'groupName', 'sellerGroupName') },
      { label: 'Commission Rate', value: pick(seller, 'commissionRate', 'rate'), formatter: percent, tone: 'financial' },
      { label: 'Commission Base', value: pick(seller, 'commissionBase'), formatter: money, tone: 'financial' },
    ]} /></DoubleCheckSection> },
  ]

  return <DoubleCheckShell title={request.title || 'Final Reservation Review'} description={request.description || 'Review the reservation details before creating the buyer account, document checklist, SOA, seller assignment, and commission records.'} confirmLabel={request.confirmLabel || 'Confirm & Reserve Listing'} summary={request.summary || [pick(listing, 'project'), pick(listing, 'unit')].filter(Boolean).join(' · ')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default ReservationDoubleCheck
