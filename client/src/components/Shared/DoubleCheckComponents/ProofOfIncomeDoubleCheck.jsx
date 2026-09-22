import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { formatDate, money, percent, pick, titleCase } from './core/doubleCheckFormatters'

const ProofOfIncomeDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const seller = data.seller || {}
  const property = data.property || {}
  const releases = Array.isArray(data.selectedReleases) ? data.selectedReleases : []
  const receipt = data.receiptDetails || {}
  const steps = [
    { key: 'seller', title: 'Seller & Property', content: <DoubleCheckSection title="Seller & Property" helper="Verify who will receive the proof of income and which property it covers." tone="blue"><DoubleCheckFields fields={[
      { label: 'Seller', value: pick(seller, 'name'), wide: true },
      { label: 'Project', value: pick(property, 'project') },
      { label: 'Unit', value: pick(property, 'unit') },
      { label: 'Buyer', value: pick(property, 'buyer'), wide: true },
      { label: 'Total Amount', value: data.totalAmount, formatter: money, tone: 'financial' },
    ]} /></DoubleCheckSection> },
    { key: 'releases', title: 'Selected Releases', content: <DoubleCheckSection title="Selected Releases" helper="Verify only the released commission stages included in this receipt." tone="emerald" badge={`${releases.length} release${releases.length === 1 ? '' : 's'}`}>{releases.length ? <div className="space-y-3">{releases.map((release, index) => <DoubleCheckListCard key={`${pick(release, 'releaseId', 'release_id') || index}`} title={pick(release, 'stage', 'releaseStage') || `Release ${index + 1}`} index={index} total={releases.length} fields={[
      { label: 'Release Percentage', value: pick(release, 'releasePercent', 'release_percent'), formatter: percent, tone: 'financial' },
      { label: 'Amount', value: pick(release, 'amount', 'netAmount', 'net_amount'), formatter: money, tone: 'financial' },
      { label: 'Actual Release Date', value: pick(release, 'releaseDate', 'actualReleaseDate'), formatter: formatDate },
      { label: 'Status', value: pick(release, 'status'), formatter: titleCase },
    ]} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No commission release stages are selected.</p>}</DoubleCheckSection> },
    { key: 'receipt', title: 'Receipt Details', content: <DoubleCheckSection title="Receipt Details" helper="Receipt Date is the Proof of Income issue date and remains separate from each commission Actual Release Date." tone="amber"><DoubleCheckFields fields={[
      { label: 'Bank Name', value: pick(receipt, 'bankName') },
      { label: 'Account Number', value: pick(receipt, 'accountNumber') },
      { label: 'Receipt Date', value: pick(receipt, 'receiptDate'), formatter: formatDate },
      { label: 'Reference Number', value: pick(receipt, 'referenceNumber') },
      { label: 'Witness Name', value: pick(receipt, 'witnessName'), wide: true },
    ]} /></DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || 'Review Proof of Income Receipt'} description={request.description || 'Verify the seller, selected releases, and receipt details before creating the permanent record.'} confirmLabel={request.confirmLabel || 'Confirm, Generate & Print'} summary={request.summary || pick(seller, 'name')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default ProofOfIncomeDoubleCheck
