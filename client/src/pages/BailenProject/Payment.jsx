import { NavLink } from 'react-router-dom'
import { FiCreditCard, FiExternalLink } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'

const Payment = () => {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Bailen Payments" description="Use this as the payment landing page. Actual payment entry stays inside each listing SOA." icon={FiCreditCard} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Payment workflow</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Payments should be recorded from the listing details page so every payment stays linked to a unit, buyer, SOA row, and reference number.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            { step: '1', title: 'Open Listing', text: 'Go to Listings and open the unit details.' },
            { step: '2', title: 'Payments & SOA', text: 'Record payment against the correct SOA row.' },
            { step: '3', title: 'Audit Logs', text: 'Review the read-only payment audit trail.' },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">{item.step}</span>
              <h3 className="mt-3 font-bold text-slate-950">{item.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <NavLink to="/bailenProject/listings" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700">
            Open Listings
            <FiExternalLink className="h-4 w-4" />
          </NavLink>
          <NavLink to="/bailenProject/payments-audit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            View Audit Logs
            <FiExternalLink className="h-4 w-4" />
          </NavLink>
        </div>
      </section>
    </main>
  )
}

export default Payment
