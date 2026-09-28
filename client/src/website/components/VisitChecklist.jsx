import { FiCheckCircle, FiDownload, FiPrinter } from 'react-icons/fi'
import { Link } from 'react-router-dom'

export const visitChecklistItems = [
  'Confirm the meeting place and schedule with the property team.',
  'Bring a valid ID and save the contact details of your guide.',
  'Wear comfortable footwear suitable for the site conditions.',
  'Ask for the latest property availability and written quotation.',
  'Review road access, surroundings, boundaries and unit markers.',
  'Prepare questions about documents, fees and payment terms.',
  'Take notes and photos when permitted during the visit.',
  'Do not pay without an official instruction and receipt process.',
]

const VisitChecklist = ({ compact = false }) => {
  const printChecklist = () => window.print()
  const downloadText = () => {
    const content = ['D&C Prime Realty — Property Visit Checklist', '', ...visitChecklistItems.map((item, index) => `${index + 1}. ${item}`)].join('\n')
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'dc-prime-property-visit-checklist.txt'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="rounded-[18px] border border-[#ded9ce] bg-white p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#806014]">Property visit checklist</p>
          <h2 className={`${compact ? 'text-[22px]' : 'text-[27px]'} mt-2 text-[#1b1813]`}>Prepare before visiting the project</h2>
        </div>
        <div className="flex gap-2 print:hidden">
          {compact ? <Link to="/visit-checklist" className="website-button-dark">Open full checklist</Link> : <><button type="button" onClick={downloadText} className="website-button-light"><FiDownload /> Download</button><button type="button" onClick={printChecklist} className="website-button-dark"><FiPrinter /> Print</button></>}
        </div>
      </div>
      <div className={`${compact ? 'mt-5 grid gap-3' : 'mt-6 grid gap-3 sm:grid-cols-2'}`}>
        {visitChecklistItems.map((item) => <p key={item} className="flex items-start gap-3 text-[12px] leading-5 text-[#5f5a52]"><FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#356447]" /> {item}</p>)}
      </div>
    </div>
  )
}

export default VisitChecklist


