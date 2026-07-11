import PrintPageShell from './PrintPageShell'
import { formatDate } from './printUtils'

const readProofPayload = () => {
  try {
    const saved = localStorage.getItem('accredited_seller_proof_payload')
    if (!saved) return {}
    return JSON.parse(saved)
  } catch {
    return {}
  }
}

const roleLabels = {
  broker_network_manager: 'Broker Network Manager',
  broker: 'Broker',
  manager: 'Manager',
  agent: 'Agent',
}

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (!bytes) return '-'
  return `${(bytes / 1024).toFixed(1)} KB`
}

const underTwenty = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

const integerToWords = (value) => {
  const number = Math.floor(Math.abs(Number(value || 0)))
  if (number < 20) return underTwenty[number]
  if (number < 100) return `${tens[Math.floor(number / 10)]}${number % 10 ? `-${underTwenty[number % 10]}` : ''}`
  if (number < 1000) return `${underTwenty[Math.floor(number / 100)]} hundred${number % 100 ? ` ${integerToWords(number % 100)}` : ''}`
  if (number < 1_000_000) return `${integerToWords(Math.floor(number / 1000))} thousand${number % 1000 ? ` ${integerToWords(number % 1000)}` : ''}`
  if (number < 1_000_000_000) return `${integerToWords(Math.floor(number / 1_000_000))} million${number % 1_000_000 ? ` ${integerToWords(number % 1_000_000)}` : ''}`
  return `${integerToWords(Math.floor(number / 1_000_000_000))} billion${number % 1_000_000_000 ? ` ${integerToWords(number % 1_000_000_000)}` : ''}`
}

const amountInWords = (value) => {
  const amount = Math.max(Number(value || 0), 0)
  const pesos = Math.floor(amount)
  const centavos = Math.round((amount - pesos) * 100)
  const pesoWords = integerToWords(pesos)
  const centavoWords = centavos ? ` and ${integerToWords(centavos)} centavos` : ''
  return `${pesoWords}${centavoWords} pesos only`.toUpperCase()
}

const UploadedDocumentPrint = ({ seller = {} }) => {
  const document = seller.proofOfIncomeDocument || seller.proof_of_income_document || {}
  const fileUrl = String(document.fileUrl || document.file_url || '')
  const fileType = String(document.fileMimeType || document.file_mime_type || '')
  const isImage = fileUrl.startsWith('data:image') || fileType.startsWith('image/')

  return (
    <section className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-black shadow-lg print:shadow-none">
      <div className="border-2 border-black p-4 text-[12px]">
        <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
          <div>
            <h1 className="text-xl font-black uppercase leading-none">D&amp;C Prime Realty</h1>
            <p className="mt-2 font-semibold">Uploaded Seller Proof of Income</p>
          </div>
          <div className="text-right text-[11px] font-semibold">
            <p>Print Date: {formatDate(new Date().toISOString())}</p>
            <p>Document Type: Proof of Income</p>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <td className="w-1/4 border border-black bg-slate-100 px-2 py-1 font-black">Seller Name</td>
              <td className="border border-black px-2 py-1 font-semibold">{seller.full_name || seller.fullName || '-'}</td>
              <td className="w-1/4 border border-black bg-slate-100 px-2 py-1 font-black">Role</td>
              <td className="border border-black px-2 py-1 font-semibold">{roleLabels[seller.role] || seller.role || '-'}</td>
            </tr>
            <tr>
              <td className="border border-black bg-slate-100 px-2 py-1 font-black">Email</td>
              <td className="border border-black px-2 py-1 font-semibold">{seller.email || '-'}</td>
              <td className="border border-black bg-slate-100 px-2 py-1 font-black">Contact No.</td>
              <td className="border border-black px-2 py-1 font-semibold">{seller.contact_no || seller.contactNo || '-'}</td>
            </tr>
            <tr>
              <td className="border border-black bg-slate-100 px-2 py-1 font-black">File Name</td>
              <td className="border border-black px-2 py-1 font-semibold">{document.fileName || document.file_name || '-'}</td>
              <td className="border border-black bg-slate-100 px-2 py-1 font-black">Uploaded</td>
              <td className="border border-black px-2 py-1 font-semibold">{formatDate(document.uploadedAt || document.uploaded_at)}</td>
            </tr>
            <tr>
              <td className="border border-black bg-slate-100 px-2 py-1 font-black">File Type</td>
              <td className="border border-black px-2 py-1 font-semibold">{fileType || '-'}</td>
              <td className="border border-black bg-slate-100 px-2 py-1 font-black">File Size</td>
              <td className="border border-black px-2 py-1 font-semibold">{formatBytes(document.fileSizeBytes || document.file_size_bytes)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 border border-black">
          <div className="border-b border-black bg-slate-100 px-2 py-1 text-center text-[12px] font-black uppercase">Proof of Income Document</div>
          <div className="flex min-h-[170mm] items-center justify-center p-3 text-center">
            {isImage ? (
              <img src={fileUrl} alt="Proof of income" className="max-h-[165mm] max-w-full object-contain" />
            ) : fileUrl ? (
              <div className="font-semibold"><p>Uploaded file is saved but cannot be previewed as an image.</p><p className="mt-2 text-[11px]">File: {document.fileName || document.file_name || 'Proof of income'}</p></div>
            ) : <p className="font-semibold">No proof of income file uploaded.</p>}
          </div>
        </div>
      </div>
    </section>
  )
}

const CommissionReceiptPrint = ({ seller = {}, receipt = {} }) => {
  const releases = receipt.releases || []
  const totalAmount = Number(receipt.totalAmount || 0)
  const releaseDescription = releases.map((release) => release.stage).join(', ')

  return (
    <section className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white px-[15mm] py-[14mm] font-serif text-black shadow-lg print:shadow-none">
      <div className="mx-auto max-w-[178mm] text-[11px] leading-relaxed">
        <h1 className="pt-8 text-center text-[15px] font-bold uppercase tracking-wide">Acknowledgement Receipt</h1>

        <p className="mt-12 text-justify text-[12px] leading-7">
          This is to acknowledge receipt by <strong>{seller.full_name || '-'}</strong> from <strong>D&amp;C Prime Realty</strong> of the following released commission payment:
        </p>

        <table className="mt-5 w-full border-collapse text-center text-[11px]">
          <thead>
            <tr className="font-bold uppercase">
              <th className="border border-black px-2 py-3">Bank</th>
              <th className="border border-black px-2 py-3">Account No.</th>
              <th className="border border-black px-2 py-3">Date</th>
              <th className="border border-black px-2 py-3">Reference Number</th>
              <th className="border border-black px-2 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black px-2 py-4 font-semibold">{receipt.bankName || '-'}</td>
              <td className="border border-black px-2 py-4 font-semibold">{receipt.accountNumber || '-'}</td>
              <td className="border border-black px-2 py-4 font-semibold">{formatDate(receipt.receiptDate)}</td>
              <td className="border border-black px-2 py-4 font-semibold">{receipt.referenceNumber || '-'}</td>
              <td className="border border-black px-2 py-4 font-semibold">{money(totalAmount).replace('₱', '')}</td>
            </tr>
            <tr>
              <td className="border border-black px-2 py-3" colSpan="3"></td>
              <td className="border border-black px-2 py-3 text-right font-bold">TOTAL:</td>
              <td className="border border-black px-2 py-3 font-bold">{money(totalAmount).replace('₱', '')}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-5 text-justify text-[11px] leading-6">
          <strong>{amountInWords(totalAmount)}</strong> ({money(totalAmount)}) as released commission for Unit ID <strong>{receipt.unitId || '-'}</strong> under <strong>{receipt.projectName || '-'}</strong>, located at {receipt.projectLocation || '-'}, for buyer <strong>{receipt.buyerName || '-'}</strong>. Included release stage{releases.length === 1 ? '' : 's'}: <strong>{releaseDescription || '-'}</strong>.
        </p>

        <table className="mt-5 w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-100 font-bold uppercase">
              <th className="border border-black px-2 py-2 text-left">Release Stage</th>
              <th className="border border-black px-2 py-2 text-center">Release Date</th>
              <th className="border border-black px-2 py-2 text-right">Gross</th>
              <th className="border border-black px-2 py-2 text-right">Deduction</th>
              <th className="border border-black px-2 py-2 text-right">Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {releases.map((release) => (
              <tr key={release.releaseId}>
                <td className="border border-black px-2 py-2 font-semibold">{release.stage}</td>
                <td className="border border-black px-2 py-2 text-center">{formatDate(release.actualReleaseDate)}</td>
                <td className="border border-black px-2 py-2 text-right">{money(release.grossAmount)}</td>
                <td className="border border-black px-2 py-2 text-right">{money(release.deductionAmount)}</td>
                <td className="border border-black px-2 py-2 text-right font-bold">{money(release.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-10 grid grid-cols-2 gap-x-20 gap-y-12 text-center text-[11px]">
          <div>
            <div className="min-h-16 border-b border-black"></div>
            <p className="mt-2 font-bold uppercase">{seller.full_name || '-'}</p>
            <p>{roleLabels[seller.role] || seller.role || 'Accredited Seller'}</p>
            <p className="mt-1">PRC No. {seller.prc_no || seller.prcNo || '-'}</p>
          </div>
          <div>
            <div className="min-h-16 border-b border-black"></div>
            <p className="mt-2 font-bold uppercase">{receipt.witnessName || '-'}</p>
            <p>Witness</p>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-x-20 text-[11px]">
          <div>
            <p className="font-bold uppercase">Receipt Details</p>
            <p className="mt-2">Receipt No.: POI-{String(receipt.receiptId || '').padStart(6, '0')}</p>
            <p>Unit ID: {receipt.unitId || '-'}</p>
            <p>Date: {formatDate(receipt.receiptDate)}</p>
            <p>Project: {receipt.projectName || '-'}</p>
          </div>
          <div className="pt-8 text-center">
            <div className="border-b border-black pb-8"></div>
            <p className="mt-2">Prepared / Released By</p>
            <p className="font-bold uppercase">{receipt.createdByName || '-'}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

const AccreditedSellerProofOfIncomePrintPage = () => {
  const { seller = {}, receipt = null } = readProofPayload()

  return (
    <PrintPageShell title={receipt ? 'Commission Proof of Income' : 'Seller Proof of Income'}>
      {receipt ? <CommissionReceiptPrint seller={seller} receipt={receipt} /> : <UploadedDocumentPrint seller={seller} />}
    </PrintPageShell>
  )
}

export default AccreditedSellerProofOfIncomePrintPage
