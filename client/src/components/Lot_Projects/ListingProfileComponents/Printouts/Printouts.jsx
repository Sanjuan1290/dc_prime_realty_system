import { useParams } from 'react-router-dom'
import { FiFileText, FiImage, FiPrinter, FiReceipt } from 'react-icons/fi'

const buildPrintItems = (projectSlug) => [
  {
    title: 'Offer to Buy',
    type: 'offer-to-buy',
    desc: "Offer to Buy & Buyer's Profile form with buyer, property, terms, and signatures.",
    icon: FiFileText,
    path: `/lot-projects/${projectSlug}/printouts/offer-to-buy`,
  },
  {
    title: 'Statement of Account',
    type: 'statement-of-account',
    desc: 'SOA schedule with due amount, paid amount, references, and running balance.',
    icon: FiPrinter,
    path: `/lot-projects/${projectSlug}/printouts/statement-of-account`,
  },
  {
    title: 'Acknowledgement Receipt',
    type: 'acknowledgement-receipt',
    desc: 'Printable receipt for payment acknowledgement with bank/reference details.',
    icon: FiReceipt,
    path: `/lot-projects/${projectSlug}/printouts/acknowledgement-receipt`,
  },
  {
    title: 'Print Documents',
    type: 'documents',
    desc: 'Printable document image compilation. Images only, no document labels.',
    icon: FiImage,
    path: `/lot-projects/${projectSlug}/printouts/documents`,
  },
]

const Printouts = ({ listing, client, soaRows = [], documents = [], payments = [] }) => {
  const { projectSlug = listing?.project_slug || 'bailen-lot-project' } = useParams()
  const printItems = buildPrintItems(projectSlug)

  const handlePreview = (item) => {
    const payload = {
      listing,
      client,
      soaRows,
      documents,
      payments,
    }

    localStorage.setItem('lot_print_payload', JSON.stringify(payload))
    localStorage.setItem('bailen_print_payload', JSON.stringify(payload))

    window.open(item.path, '_blank')
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-black text-slate-950">Printouts</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Open complete printable pages. Use the print button to save as PDF.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {printItems.map((item) => {
          const Icon = item.icon

          return (
            <button
              key={item.type}
              type="button"
              onClick={() => handlePreview(item)}
              className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-blue-200 hover:bg-blue-50 active:scale-[0.99]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm transition group-hover:bg-blue-600 group-hover:text-white">
                <Icon className="h-6 w-6" />
              </div>

              <p className="mt-4 font-black text-slate-950">{item.title}</p>

              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">
                {item.desc}
              </p>

              <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-blue-700">
                <FiPrinter className="h-4 w-4" />
                Preview
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default Printouts
