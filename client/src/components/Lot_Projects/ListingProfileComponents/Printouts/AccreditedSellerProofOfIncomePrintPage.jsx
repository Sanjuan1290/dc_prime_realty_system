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

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (!bytes) return '-'
  return `${(bytes / 1024).toFixed(1)} KB`
}

const AccreditedSellerProofOfIncomePrintPage = () => {
  const { seller = {} } = readProofPayload()
  const document = seller.proofOfIncomeDocument || seller.proof_of_income_document || {}
  const fileUrl = String(document.fileUrl || document.file_url || '')
  const fileType = String(document.fileMimeType || document.file_mime_type || '')
  const isImage = fileUrl.startsWith('data:image') || fileType.startsWith('image/')

  return (
    <PrintPageShell title="Seller Proof of Income">
      <section className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-black shadow-lg print:shadow-none">
        <div className="border-2 border-black p-4 text-[12px]">
          <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
            <div>
              <h1 className="text-xl font-black uppercase leading-none">D&amp;C Prime Realty</h1>
              <p className="mt-2 font-semibold">Accredited Seller Proof of Income</p>
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
                <td className="border border-black bg-slate-100 px-2 py-1 font-black">Seller Group</td>
                <td className="border border-black px-2 py-1 font-semibold">{seller.seller_group_name || seller.sellerGroupName || '-'}</td>
                <td className="border border-black bg-slate-100 px-2 py-1 font-black">Reports Under</td>
                <td className="border border-black px-2 py-1 font-semibold">{seller.reports_under_name || seller.reportsUnderName || 'Direct to Developer'}</td>
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
            <div className="border-b border-black bg-slate-100 px-2 py-1 text-center text-[12px] font-black uppercase">
              Proof of Income Document
            </div>
            <div className="flex min-h-[170mm] items-center justify-center p-3 text-center">
              {isImage ? (
                <img src={fileUrl} alt="Proof of income" className="max-h-[165mm] max-w-full object-contain" />
              ) : fileUrl ? (
                <div className="font-semibold">
                  <p>Uploaded file is saved but cannot be previewed as an image.</p>
                  <p className="mt-2 text-[11px]">File: {document.fileName || document.file_name || 'Proof of income'}</p>
                </div>
              ) : (
                <p className="font-semibold">No proof of income file uploaded.</p>
              )}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-12 text-center text-[11px] font-semibold">
            <div>
              <div className="border-b border-black pb-6"></div>
              <p className="mt-2">Prepared By</p>
            </div>
            <div>
              <div className="border-b border-black pb-6"></div>
              <p className="mt-2">Reviewed / Approved By</p>
            </div>
          </div>
        </div>
      </section>
    </PrintPageShell>
  )
}

export default AccreditedSellerProofOfIncomePrintPage
