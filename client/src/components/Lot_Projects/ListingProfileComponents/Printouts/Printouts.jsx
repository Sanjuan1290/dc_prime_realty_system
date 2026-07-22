import { FiFileText, FiImage, FiPrinter } from 'react-icons/fi'

const printItems = [
  {
    title: 'Offer to Buy',
    type: 'offer-to-buy',
    desc: "Offer to Buy & Buyer's Profile form with buyer, property, terms, and signatures.",
    icon: FiFileText,
    path: 'offer-to-buy',
  },
  {
    title: 'Statement of Account',
    type: 'statement-of-account',
    desc: 'SOA schedule with due amount, penalty, payments, references, and balances.',
    icon: FiPrinter,
    path: 'statement-of-account',
  },
  {
    title: 'Acknowledgement Receipts',
    type: 'acknowledgement-receipts',
    desc: 'One printable acknowledgement receipt per verified payment, one payment per A4 page.',
    icon: FiFileText,
    path: 'acknowledgement-receipts',
  },
  {
    title: 'Print Documents',
    type: 'documents',
    desc: 'Printable document image compilation using uploaded document files.',
    icon: FiImage,
    path: 'documents',
  },
]

const Printouts = ({
  projectSlug,
  project = {},
  listing,
  client,
  soaRows = [],
  payments = [],
  documents = [],
}) => {
  const handlePreview = (item) => {
    localStorage.setItem(
      'lot_project_print_payload',
      JSON.stringify({
        project,
        listing,
        client,
        soaRows,
        payments,
        documents,
      })
    )

    window.open(`/lot-projects/${projectSlug}/printouts/${item.path}`, '_blank')
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-black text-slate-950">Printouts</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          Open complete printable pages before printing.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {printItems.map((item) => {
          const Icon = item.icon
          const paymentCount = payments.filter(
            (payment) => String(payment?.status || 'Verified').toLowerCase() === 'verified'
          ).length

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

              <div className="mt-4 flex items-start justify-between gap-3">
                <p className="font-black text-slate-950">{item.title}</p>

                {item.type === 'acknowledgement-receipts' ? (
                  <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700">
                    {paymentCount}
                  </span>
                ) : null}
              </div>

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
