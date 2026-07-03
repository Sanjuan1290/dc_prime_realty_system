import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiCreditCard, FiFileText, FiHome, FiPrinter, FiSave, FiUser } from 'react-icons/fi'
import StatusAlert from '../../components/Shared/StatusAlert'
import UnitStatus from '../../components/BailenProject/ListingProfileComponents/UnitStatus/UnitStatus'
import ClientProfile from '../../components/BailenProject/ListingProfileComponents/ClientProfile/ClientProfile'
import PaymentsSOA from '../../components/BailenProject/ListingProfileComponents/PaymentsSOA/Payments_SOA'
import Documents from '../../components/BailenProject/ListingProfileComponents/Documents/Documents'
import Printouts from '../../components/BailenProject/ListingProfileComponents/Printouts/Printouts'

const listings = {
  'LA-0402': { unitCode: 'LA-0402', lotType: 'Inner', area: 300, pricePerSqm: 3200, netSellingPrice: 960000, lmfRate: 5, tcp: 1008000, reservationFee: 50000, status: 'Sold / Active', cadastralLots: ['CAD-001','CAD-002'], description: 'Sample sold unit with active SOA.' },
  'LA-0403': { unitCode: 'LA-0403', lotType: 'Corner', area: 150, pricePerSqm: 3000, netSellingPrice: 450000, lmfRate: 10, tcp: 495000, reservationFee: 50000, status: 'Available', cadastralLots: ['CAD-003'], description: 'Available corner lot.' },
  'LA-0501': { unitCode: 'LA-0501', lotType: 'Inner', area: 220, pricePerSqm: 3250, netSellingPrice: 715000, lmfRate: 8, tcp: 772200, reservationFee: 50000, status: 'Fully Paid', cadastralLots: ['CAD-005'], description: 'Fully paid sample unit.' },
}

const client = { buyerType: 'Single', buyerName: 'Robert San Juan', contactNo: '09171234567', email: 'robert.sample@gmail.com', address: 'Indang, Cavite', occupation: 'Web Developer', employerBusinessName: 'D&C Prime Realty', seller: 'Ana Garcia', profileStatus: 'Complete' }
const soaRows = [
  { dueDate: '2026-07-01', description: 'Reservation Fee', beginningBalance: 1008000, dueAmount: 50000, amountPaid: 50000, datePaid: '2026-07-01', referenceId: 'CASH-20260701-LA0402-0001', status: 'Paid', endingBalance: 958000 },
  { dueDate: '2026-07-15', description: '1st Downpayment', beginningBalance: 958000, dueAmount: 118800, amountPaid: 118800, datePaid: '2026-07-15', referenceId: 'BDO-874612', status: 'Paid', endingBalance: 839200 },
  { dueDate: '2026-08-15', description: 'Monthly Amortization 1', beginningBalance: 839200, dueAmount: 25000, amountPaid: 0, datePaid: '-', referenceId: '-', status: 'Unpaid', endingBalance: 839200 },
]
const documents = [
  { id: 1, name: 'Valid Government ID', requirement: 'Required', status: 'Approved', fileName: 'valid-id.pdf' },
  { id: 2, name: 'Reservation Agreement', requirement: 'Required', status: 'Approved', fileName: 'reservation-agreement.pdf' },
  { id: 3, name: 'Proof of Income', requirement: 'Optional', status: 'Missing', fileName: '-' },
]

const tabs = [
  { key: 'unit', label: 'Unit & Status', icon: FiHome },
  { key: 'client', label: 'Client Profile', icon: FiUser },
  { key: 'payments', label: 'Payments & SOA', icon: FiCreditCard },
  { key: 'documents', label: 'Documents', icon: FiFileText },
  { key: 'printouts', label: 'Printouts', icon: FiPrinter },
]

const ListingProfile = () => {
  const { listingId } = useParams()
  const [activeTab, setActiveTab] = useState('unit')
  const [alert, setAlert] = useState(null)
  const listing = useMemo(() => listings[listingId] || listings['LA-0402'], [listingId])

  const renderTab = () => {
    if (activeTab === 'unit') return <UnitStatus listing={listing} />
    if (activeTab === 'client') return <ClientProfile client={client} />
    if (activeTab === 'payments') return <PaymentsSOA listing={listing} soaRows={soaRows} />
    if (activeTab === 'documents') return <Documents documents={documents} />
    return <Printouts listing={listing} client={client} soaRows={soaRows} />
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3"><Link to="/bailenProject/listings" className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"><FiArrowLeft className="h-5 w-5" /></Link><div><p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Listing Profile</p><h1 className="text-3xl font-black text-slate-950">{listing.unitCode}</h1><p className="text-sm font-semibold text-slate-500">Mock client, SOA, documents, and printout workspace.</p></div></div>
        <button onClick={() => setAlert({ type: 'success', message: 'Mock profile saved.' })} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"><FiSave className="h-4 w-4" />Save Mock Changes</button>
      </div>
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} /> : null}
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex gap-2 overflow-x-auto">{tabs.map((tab) => { const Icon = tab.icon; const active = activeTab === tab.key; return <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}><Icon className="h-4 w-4" />{tab.label}</button> })}</div></section>
      {renderTab()}
    </main>
  )
}

export default ListingProfile
