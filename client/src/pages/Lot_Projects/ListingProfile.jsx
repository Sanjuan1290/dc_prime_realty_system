import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowLeft,
  FiCreditCard,
  FiFileText,
  FiHome,
  FiPrinter,
  FiRefreshCw,
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
import { useFetch, useFetchPut } from '../../utils/useFetch'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const tabs = [
  { key: 'unit', label: 'Unit & Status', icon: FiHome },
  { key: 'client', label: 'Client Profile', icon: FiUser },
  { key: 'payments', label: 'Payments / SOA', icon: FiCreditCard },
  { key: 'documents', label: 'Documents', icon: FiFileText },
  { key: 'printouts', label: 'Printouts', icon: FiPrinter },
]

const emptyListing = {
  unit_id: '-',
  unitCode: '-',
  project_name: 'Lot Project',
  listing_status: '-',
  tcp: '₱0.00',
  tcpAmount: 0,
  balance: '₱0.00',
  balanceAmount: 0,
  status: '-',
}

const ListingProfile = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { projectSlug, listingId } = useParams()

  const [activeTab, setActiveTab] = useState('unit')
  const [showReserveModal, setShowReserveModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const profileQuery = useQuery({
    queryKey: ['lot-listing-profile', projectSlug, listingId],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings/${listingId}`),
    enabled: Boolean(projectSlug && listingId),
    retry: false,
  })

  const profile = profileQuery.data?.data || {}
  const project = profile.project || {}
  const listing = profile.listing || emptyListing
  const client = profile.client || {}
  const soaRows = profile.soaRows || []
  const payments = profile.payments || []
  const documents = profile.documents || []

  const paymentListing = useMemo(
    () => ({
      ...listing,
      tcp: listing.tcpAmount ?? listing.tcp ?? 0,
      balance: listing.balanceAmount ?? listing.balance ?? 0,
    }),
    [listing]
  )

  const updateListingMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(`/projects/lot-projects/${projectSlug}/listings/${listingId}`, payload),
    onMutate: (payload) => {
      setAlert({ type: 'loading', message: `Saving ${payload.unitCode || payload.unit_id || 'listing'}...` })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Listing updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to update listing.' })
    },
  })

  const updateClientProfileMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(`/projects/lot-projects/${projectSlug}/listings/${listingId}/client-profile`, payload),
    onMutate: (payload) => {
      setAlert({ type: 'loading', message: `Saving ${payload.buyerName || 'buyer profile'}...` })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Buyer profile updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to update buyer profile.' })
    },
  })

  const handleReserveListing = (reservationPayload) => {
    setShowReserveModal(false)
    setAlert({
      type: 'info',
      message: `${reservationPayload?.listing?.unitId || listing.unit_id} reservation form is still local. Connect the reservation save API next.`,
    })
  }

  const handleRefresh = () => {
    profileQuery.refetch()
  }

  const canReserve = listing.rawStatus === 'available' || listing.listing_status === 'Available'

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}

      {profileQuery.isLoading ? <StatusAlert type="loading" message="Loading listing profile from database..." /> : null}
      {profileQuery.isFetching && !profileQuery.isLoading ? <StatusAlert type="info" message="Refreshing listing profile..." /> : null}
      {profileQuery.isError ? (
        <StatusAlert type="error" message={profileQuery.error?.message || 'Failed to load listing profile.'} />
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate(`/lot-projects/${projectSlug}/listings`)}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98]"
              aria-label="Back to listings"
            >
              <FiArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Listing Details</p>

              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                {listing.unit_id || listing.unitCode || '-'}
              </h1>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {listing.project_name || project.name || 'Lot Project'} • {listing.listing_status || '-'}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Database route id: {listingId || '-'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">TCP</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {typeof listing.tcp === 'string' ? listing.tcp : money(listing.tcpAmount || listing.tcp)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">Balance</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {typeof listing.balance === 'string' ? listing.balance : money(listing.balanceAmount || listing.balance)}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-emerald-700">Status</p>
              <p className="mt-1 text-sm font-black text-emerald-800">
                {listing.listing_status || '-'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={profileQuery.isFetching}
              className="inline-flex min-h-[68px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
            >
              <FiRefreshCw className={`h-4 w-4 ${profileQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setShowReserveModal(true)}
              disabled={!canReserve || profileQuery.isLoading}
              className="inline-flex min-h-[68px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
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

      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'unit' ? (
        <UnitStatus
          listing={listing}
          project={project}
          onSave={(payload) => updateListingMutation.mutateAsync(payload)}
          isSaving={updateListingMutation.isPending}
        />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'client' ? (
        <ClientProfile
          client={client}
          listing={listing}
          onSave={(payload) => updateClientProfileMutation.mutateAsync(payload)}
          isSaving={updateClientProfileMutation.isPending}
        />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'payments' ? (
        <PaymentsSOA listing={paymentListing} soaRows={soaRows} payments={payments} />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'documents' ? (
        <Documents documents={documents} />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'printouts' ? (
        <Printouts listing={listing} client={client} soaRows={soaRows} documents={documents} />
      ) : null}

      {showReserveModal ? (
        <ReserveListingModal
          listing={listing}
          client={client}
          onClose={() => setShowReserveModal(false)}
          onReserve={handleReserveListing}
        />
      ) : null}
    </main>
  )
}

export default ListingProfile
