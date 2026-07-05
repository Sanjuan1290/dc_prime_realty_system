import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowLeft,
  FiCreditCard,
  FiFileText,
  FiHome,
  FiLoader,
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
import { useFetch, useFetchDelete, useFetchPatch, useFetchPost, useFetchPut } from '../../utils/useFetch'

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

const ListingProfile = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { projectSlug, listingId } = useParams()

  const [activeTab, setActiveTab] = useState('unit')
  const [showReserveModal, setShowReserveModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const queryKey = ['lot-listing-profile', projectSlug, listingId]

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings/${listingId}`),
    enabled: Boolean(projectSlug && listingId),
  })

  const profileData = data?.data || {}
  const project = profileData.project || {}
  const listing = profileData.listing || {}
  const client = profileData.client || {}
  const soaRows = profileData.soaRows || []
  const payments = profileData.payments || []
  const documents = profileData.documents || []

  const paymentListing = useMemo(
    () => ({
      ...listing,
      tcp: listing.tcpAmount || listing.tcp,
      balance: listing.balanceAmount ?? listing.balance,
    }),
    [listing]
  )

  const refreshProfile = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ['lot-project-dashboard', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['lot-project-listings', projectSlug] })
  }

  const unitMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(`/projects/lot-projects/${projectSlug}/listings/${listingId}/status`, payload),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving unit and status changes...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Unit and status saved successfully.' })
      refreshProfile()
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to save unit details.' }),
  })

  const clientMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(`/projects/lot-projects/${projectSlug}/listings/${listingId}/client-profile`, payload),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving client profile...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Client profile saved successfully.' })
      refreshProfile()
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to save client profile.' }),
  })

  const paymentMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/payments`, payload),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving payment and updating SOA...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Payment saved successfully.' })
      refreshProfile()
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to save payment.' }),
  })

  const uploadDocumentMutation = useMutation({
    mutationFn: ({ documentId, payload }) =>
      useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/documents/${documentId}/upload`, payload),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving uploaded document...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Document uploaded successfully.' })
      refreshProfile()
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to upload document.' }),
  })

  const documentStatusMutation = useMutation({
    mutationFn: ({ documentId, status }) =>
      useFetchPatch(`/projects/lot-projects/${projectSlug}/listings/${listingId}/documents/${documentId}/status`, { status }),
    onMutate: ({ status }) => setAlert({ type: 'loading', message: `Marking document as ${status}...` }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Document status updated.' })
      refreshProfile()
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to update document status.' }),
  })

  const clearDocumentMutation = useMutation({
    mutationFn: (documentId) =>
      useFetchDelete(`/projects/lot-projects/${projectSlug}/listings/${listingId}/documents/${documentId}/upload`),
    onMutate: () => setAlert({ type: 'loading', message: 'Clearing document upload...' }),
    onSuccess: (result) => {
      setAlert({ type: 'warning', message: result?.message || 'Document cleared.' })
      refreshProfile()
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError?.message || 'Failed to clear document.' }),
  })

  const handleReserveListing = () => {
    setShowReserveModal(false)
    setAlert({ type: 'info', message: 'Reservation flow will refresh this listing after saving.' })
    refreshProfile()
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}

      {isLoading ? <StatusAlert type="loading" message="Loading listing profile..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing listing profile..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load listing profile.'} /> : null}

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
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Listing Details
              </p>

              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                {isLoading ? <FiLoader className="h-7 w-7 animate-spin text-slate-300" /> : listing.unit_id || listingId}
              </h1>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                {listing.project_name || project.name || 'Lot Project'} • {listing.listing_status || 'Loading'}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Route ID: {listingId || '-'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">TCP</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {listing.tcp || money(listing.tcpAmount)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-black uppercase text-slate-500">Balance</p>
              <p className="mt-1 text-sm font-black text-slate-950">
                {listing.balance || money(listing.balanceAmount)}
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
              onClick={() => setShowReserveModal(true)}
              disabled={listing.rawStatus !== 'available'}
              className="inline-flex min-h-[68px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300"
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
        <UnitStatus
          listing={listing}
          isSaving={unitMutation.isPending}
          onSave={(payload) => unitMutation.mutateAsync(payload)}
        />
      ) : null}

      {activeTab === 'client' ? (
        <ClientProfile
          client={client}
          isSaving={clientMutation.isPending}
          onSave={(payload) => clientMutation.mutateAsync(payload)}
        />
      ) : null}

      {activeTab === 'payments' ? (
        <PaymentsSOA
          listing={paymentListing}
          soaRows={soaRows}
          payments={payments}
          isSaving={paymentMutation.isPending}
          onSavePayment={(payload) => paymentMutation.mutateAsync(payload)}
        />
      ) : null}

      {activeTab === 'documents' ? (
        <Documents
          documents={documents}
          isUploading={uploadDocumentMutation.isPending}
          isUpdatingStatus={documentStatusMutation.isPending}
          isClearing={clearDocumentMutation.isPending}
          onUpload={(documentId, payload) => uploadDocumentMutation.mutateAsync({ documentId, payload })}
          onMarkStatus={(documentId, status) => documentStatusMutation.mutateAsync({ documentId, status })}
          onClear={(documentId) => clearDocumentMutation.mutateAsync(documentId)}
        />
      ) : null}

      {activeTab === 'printouts' ? (
        <Printouts
          projectSlug={projectSlug}
          listingId={listingId}
          listing={listing}
          client={client}
          soaRows={soaRows}
          documents={documents}
        />
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
