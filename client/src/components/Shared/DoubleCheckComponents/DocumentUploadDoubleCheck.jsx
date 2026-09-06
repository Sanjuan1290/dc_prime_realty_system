import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { money, pick } from './core/doubleCheckFormatters'

const DocumentUploadDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const target = data.targetDocument || data.payment || {}
  const files = Array.isArray(data.files) ? data.files : []
  const isPayment = request.variant === 'payment-proof' || Boolean(data.payment)
  const steps = [
    { key: 'target', title: isPayment ? 'Payment' : 'Target Document', content: <DoubleCheckSection title={isPayment ? 'Payment' : 'Target Document'} helper={isPayment ? 'Verify which payment these proof files belong to.' : 'Verify which buyer document these files will be attached to.'} tone="blue"><DoubleCheckFields fields={isPayment ? [
      { label: 'Buyer', value: pick(target, 'buyer') },
      { label: 'Unit', value: pick(target, 'unit') },
      { label: 'Amount', value: pick(target, 'amount'), formatter: money, tone: 'financial' },
      { label: 'Payment Date', value: pick(target, 'paymentDate') },
      { label: 'Method', value: pick(target, 'method') },
      { label: 'Reference', value: pick(target, 'reference'), wide: true },
      { label: 'Upload Note', value: pick(data.uploadNote || {}, 'note'), wide: true },
    ] : [
      { label: 'Document', value: pick(target, 'name'), wide: true },
    ]} /></DoubleCheckSection> },
    { key: 'files', title: 'Files', content: <DoubleCheckSection title="Files" helper="Preview each selected file and verify its name, type, and size before upload." tone="emerald" badge={`${files.length} file${files.length === 1 ? '' : 's'}`}>{files.length ? <div className="space-y-3">{files.map((file, index) => <DoubleCheckListCard key={`${pick(file, 'fileName', 'name')}-${index}`} title={pick(file, 'fileName', 'name') || `File ${index + 1}`} previewUrl={pick(file, 'previewUrl')} index={index} total={files.length} fields={[
      { label: 'File Type', value: pick(file, 'fileType', 'type') },
      { label: 'File Size', value: pick(file, 'fileSize', 'size') },
    ]} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No files are selected.</p>}</DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || (isPayment ? 'Review Payment Proof Upload' : 'Review Document Upload')} description={request.description || 'Preview every selected file before protected upload starts.'} confirmLabel={request.confirmLabel || (isPayment ? 'Confirm & Upload Proof' : 'Confirm & Upload Files')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default DocumentUploadDoubleCheck

