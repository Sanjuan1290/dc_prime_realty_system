import { useState } from 'react'
import {
  FiArrowLeft,
  FiCreditCard,
  FiFileText,
  FiHome,
  FiPrinter,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'

import StatusAlert from '../../components/Shared/StatusAlert'

import UnitStatus from '../../components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus'
import ClientProfile from '../../components/Lot_Projects/ListingProfileComponents/ClientProfile/ClientProfile'
import PaymentsSOA from '../../components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA'
import Documents from '../../components/Lot_Projects/ListingProfileComponents/Documents/Documents'
import Printouts from '../../components/Lot_Projects/ListingProfileComponents/Printouts/Printouts'
import ReserveListingModal from '../../components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal'

const mockListing = {
  unit_id: 'LA-0402',
  unitCode: 'LA-0402',

  project_name: 'Bailen Project',
  projectName: 'Bailen Project',
  project_location: 'Bailen, Cavite',
  administrator: 'IMELDA B. VILLALOBOS',

  cadastral_lot_no: '-',
  old_unit_ids: '-',
  source_unit_ids: '-',
  derived_unit_ids: '-',

  lot_type: 'Inner',
  listing_status: 'Available',
  status: 'Available',

  lot_area_sqm: '300 sqm',
  lotAreaSqm: 300,

  price_per_sqm: '₱1,200.00',
  pricePerSqm: 1200,

  net_selling_price: '₱360,000.00',
  netSellingPrice: 360000,

  lmf_rate: '10%',
  legalMiscRate: 10,

  lmf_amount: '₱36,000.00',
  lmfAmount: 36000,

  tcp: '₱396,000.00',
  tcpAmount: 396000,

  reservationFee: 50000,
  downpayment: 118800,
  balanceAmount: 227200,
  terms: '36 months',
  interestRate: '0.00%',
  monthlyAmortization: 6311,

  buyer_name: '-',
  spouse_co_owner: '-',
  email: '-',
  contact_no: '-',
  address: '-',
  region: 'REGION 4A',
  assigned_user: 'Super Admin',
  due_day: '1',

  total_paid: '₱0.00',
  balance: '₱396,000.00',
  payment_status: 'Unpaid',
  payment_count: '0',
  latest_payment_date: '-',
  latest_payment_amount: '₱0.00',

  seller: 'Rowena Cortez',
  seller_role: 'Broker Network Manager',
  reports_under: 'None',
  commission_rate: '8%',
  commission_amount: '₱28,800.00',
  released_amount: '₱0.00',
  remaining_commission: '₱28,800.00',
  commission_status: 'On Hold',

  total_documents: '14',
  required_documents: '14',
  submitted_documents: '0',
  approved_documents: '0',
  missing_required: '14',
  document_status: 'Incomplete',

  created_at: '2026-06-28',
  updated_at: '2026-07-01',
  client_unit_created: '2026-07-01',
  client_unit_updated: '2026-07-01',
}

const mockClient = {
  profileStatus: 'incomplete',

  buyerType: 'spouses',

  buyerRole: 'Principal Buyer',
  buyerName: 'robert',
  birthDate: '',
  placeOfBirth: '',
  computedAge: '-',
  citizenship: '',
  gender: '',
  civilStatus: '',
  contactNo: '0957567575',
  residencePhoneNumber: '',
  email: 'robert@gmail.cmo',
  tin: '',
  presentAddress:
    'b70 l44 cremonia st. cluster 5, bella vista, brgy. santiago, general trias, cavite',
  presentZipCode: '',
  permanentAddress: '',
  permanentZipCode: '',

  employmentStatus: '',
  employerBusinessName: '',
  employerZipCode: '',
  natureOfWorkBusiness: '',
  occupationPositionTitle: '',
  monthlyIncome: '',
  employerBusinessAddress: '',

  secondBuyerRole: 'spouse',
  secondBuyerName: '',
  secondBuyerBirthDate: '',
  secondBuyerPlaceOfBirth: '',
  secondBuyerComputedAge: '-',
  secondBuyerCitizenship: '',
  secondBuyerGender: '',
  secondBuyerCivilStatus: '',
  secondBuyerContactNo: '',
  secondBuyerResidencePhoneNumber: '',
  secondBuyerEmail: '',
  secondBuyerTin: '',
  secondBuyerPresentAddress: '',
  secondBuyerPresentZipCode: '',
  secondBuyerPermanentAddress: '',
  secondBuyerPermanentZipCode: '',

  secondBuyerEmploymentStatus: '',
  secondBuyerEmployerBusinessName: '',
  secondBuyerEmployerZipCode: '',
  secondBuyerNatureOfWorkBusiness: '',
  secondBuyerOccupationPositionTitle: '',
  secondBuyerMonthlyIncome: '',
  secondBuyerEmployerBusinessAddress: '',

  seller: 'Rowena Cortez',

  buyerTypeLabel: 'Spouses',
  salesOfficer: 'Rowena Cortez',
  dateReceived: '2026-07-01',
}

const mockSoaRows = [
  {
    dueDate: '2026-07-01',
    description: 'Reservation Fee',
    beginningBalance: 396000,
    dueAmount: 50000,
    datePaid: '-',
    amountPaid: 0,
    referenceId: '-',
    status: 'Unpaid',
    endingBalance: 396000,
  },
  {
    dueDate: '2026-07-15',
    description: 'Downpayment',
    beginningBalance: 346000,
    dueAmount: 118800,
    datePaid: '-',
    amountPaid: 0,
    referenceId: '-',
    status: 'Unpaid',
    endingBalance: 346000,
  },
  {
    dueDate: '2026-08-15',
    description: 'Monthly Amortization 1',
    beginningBalance: 227200,
    dueAmount: 6311,
    datePaid: '-',
    amountPaid: 0,
    referenceId: '-',
    status: 'Unpaid',
    endingBalance: 227200,
  },
  {
    dueDate: '2026-09-15',
    description: 'Monthly Amortization 2',
    beginningBalance: 220889,
    dueAmount: 6311,
    datePaid: '-',
    amountPaid: 0,
    referenceId: '-',
    status: 'Unpaid',
    endingBalance: 220889,
  },
]

const mockDocuments = [
  {
    id: 1,
    name: 'Two valid Government-issued IDs (w/ 3 specimen signatures)',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 2,
    name: 'TIN No. / TIN ID',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 3,
    name: 'PSA (Single)',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 4,
    name: "CLIENT REGISTRATION FORM (Seller's Copy)",
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 5,
    name: 'CLIENT REGISTRATION FORM (Administrator Copy)',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 6,
    name: "BUYER'S INFORMATION FORM",
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 7,
    name: 'INTENT TO BUY',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 8,
    name: "OFFER TO BUY & BUYER'S PROFILE",
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 9,
    name: 'RESERVATION AGREEMENT',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 10,
    name: 'Proof of Income',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 11,
    name: 'Proof of Billing',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 12,
    name: 'Birth Certificate',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 13,
    name: 'Marriage Certificate',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
  {
    id: 14,
    name: 'Signed Reservation Agreement',
    requirement: 'Required',
    status: 'Missing',
    fileName: '-',
  },
]

const tabs = [
  { key: 'unit', label: 'Unit & Status', icon: FiHome },
  { key: 'client', label: 'Client Profile', icon: FiUser },
  { key: 'payments', label: 'Payments / SOA', icon: FiCreditCard },
  { key: 'documents', label: 'Documents', icon: FiFileText },
  { key: 'printouts', label: 'Printouts', icon: FiPrinter },
]

const ListingProfile = () => {
  const navigate = useNavigate()
  const { listingId } = useParams()

  const [activeTab, setActiveTab] = useState('unit')
  const [showReserveModal, setShowReserveModal] = useState(false)
  const [alert, setAlert] = useState({
    type: 'info',
    message: 'Mock listing profile only. Each tab now renders its actual component file.',
  })

  const paymentListing = {
    ...mockListing,
    tcp: mockListing.tcpAmount,
    balance: mockListing.balanceAmount,
  }

  const handleReserveListing = (reservationPayload) => {
    setShowReserveModal(false)

    setAlert({
      type: 'success',
      message: `${reservationPayload.listing.unitId} reserved successfully in mock mode.`,
    })
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate('/bailenProject/listings')}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98]"
              aria-label="Back to listings"
            >
              <FiArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Listing Details
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                {mockListing.unit_id}
              </h1>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {mockListing.project_name} • {mockListing.listing_status}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Mock route id: {listingId || 'sample'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">TCP</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {mockListing.tcp}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">Balance</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {mockListing.balance}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-emerald-700">Status</p>
              <p className="mt-1 text-sm font-black text-emerald-800">
                {mockListing.listing_status}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowReserveModal(true)}
              className="inline-flex min-h-[68px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
            >
              <FiUserCheck className="h-4 w-4" />
              Reserve
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.key

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition active:scale-[0.98] ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </section>

      {activeTab === 'unit' ? (
        <UnitStatus listing={mockListing} />
      ) : null}

      {activeTab === 'client' ? (
        <ClientProfile client={mockClient} />
      ) : null}

      {activeTab === 'payments' ? (
        <PaymentsSOA listing={paymentListing} soaRows={mockSoaRows} />
      ) : null}

      {activeTab === 'documents' ? (
        <Documents documents={mockDocuments} />
      ) : null}

      {activeTab === 'printouts' ? (
        <Printouts
          listing={mockListing}
          client={mockClient}
          soaRows={mockSoaRows}
          documents={mockDocuments}
        />
      ) : null}

      {showReserveModal ? (
        <ReserveListingModal
          listing={mockListing}
          client={mockClient}
          onClose={() => setShowReserveModal(false)}
          onReserve={handleReserveListing}
        />
      ) : null}
    </main>
  )
}

export default ListingProfile