import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiArrowLeft,
  FiCreditCard,
  FiClock,
  FiFileText,
  FiHome,
  FiLink,
  FiPrinter,
  FiPauseCircle,
  FiRefreshCw,
  FiUnlock,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi'
import { useNavigate, useParams } from 'react-router-dom'

import StatusAlert from '../../components/Shared/StatusAlert'
import TabErrorBoundary from '../../components/Shared/TabErrorBoundary'
import UnitStatus from '../../components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus'
import ClientProfile from '../../components/Lot_Projects/ListingProfileComponents/ClientProfile/ClientProfile'
import PaymentsSOA from '../../components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA'
import Documents from '../../components/Lot_Projects/ListingProfileComponents/Documents/Documents'
import Printouts from '../../components/Lot_Projects/ListingProfileComponents/Printouts/Printouts'
import AccountHistoryPanel from '../../components/Lot_Projects/ListingProfileComponents/AccountHistory/AccountHistoryPanel'
import ReserveListingModal from '../../components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal'
import BuyerFormLinkModal from '../../components/Lot_Projects/ListingProfileComponents/BuyerForm/BuyerFormLinkModal'
import BuyerFormStatusBanner from '../../components/Lot_Projects/ListingProfileComponents/BuyerForm/BuyerFormStatusBanner'
import { useFetch, useFetchPatch, useFetchPost, useFetchPut } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'

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
  { key: 'accounts', label: 'Account History', icon: FiClock },
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


const HoldListingModal = ({ listing, isSaving, onClose, onSubmit }) => {
  const [clientName, setClientName] = useState(listing?.heldForName || '')
  const [note, setNote] = useState(listing?.holdNote || '')

  const submit = (event) => {
    event.preventDefault()
    if (!clientName.trim()) return
    onSubmit?.({ clientName: clientName.trim(), note: note.trim() })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Hold Listing</h3>
            <p className="text-sm font-semibold text-slate-500">Temporarily hold {listing?.unit_id || listing?.unitCode || 'this unit'} for a client.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60">
            ×
          </button>
        </div>

        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-black text-slate-700">Client Name <span className="text-red-500">*</span></span>
            <input value={clientName} onChange={(event) => setClientName(event.target.value)} disabled={isSaving} placeholder="Enter client name" className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-black text-slate-700">Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={isSaving} rows={4} placeholder="Optional hold note" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving || !clientName.trim()} className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-600 px-5 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300">
            {isSaving ? 'Saving...' : 'Hold Listing'}
          </button>
        </div>
      </form>
    </div>
  )
}

const ListingProfile = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { projectSlug, listingId } = useParams()
  const { data: currentUserData } = useCurrentUser()
  const canRecalculateCommission = ['super_admin', 'admin'].includes(currentUserData?.user?.role)

  const [activeTab, setActiveTab] = useState('unit')
  const [showReserveModal, setShowReserveModal] = useState(false)
  const [reserveMode, setReserveMode] = useState('manual')
  const [showBuyerFormLinkModal, setShowBuyerFormLinkModal] = useState(false)
  const [generatedBuyerFormUrl, setGeneratedBuyerFormUrl] = useState('')
  const [buyerFormNotice, setBuyerFormNotice] = useState(null)
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [alert, setAlert] = useState(null)

  const profileQuery = useQuery({
    queryKey: ['lot-listing-profile', projectSlug, listingId],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings/${listingId}`),
    enabled: Boolean(projectSlug && listingId),
    retry: false,
  })

  const buyerFormStateQuery = useQuery({
    queryKey: ['lot-buyer-form-state', projectSlug, listingId],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings/${listingId}/buyer-form`),
    enabled: Boolean(projectSlug && listingId),
    retry: false,
    refetchOnWindowFocus: true,
  })

  const profile = profileQuery.data?.data || {}
  const project = profile.project || {}
  const listing = profile.listing || emptyListing
  const client = profile.client || {}
  const soaRows = profile.soaRows || []
  const payments = profile.payments || []
  const documents = profile.documents || []
  const profileBuyerForm = profile.buyerForm || {}
  const buyerForm = buyerFormStateQuery.isSuccess
    ? { ...profileBuyerForm, ...(buyerFormStateQuery.data?.data || {}) }
    : profileBuyerForm
  const pendingBuyerFormSubmission = buyerForm.pendingSubmission || null
  const currentBuyerFormLink = buyerForm.currentLink || null

  const reserveDocumentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: () => useFetch('/documents/getDocuments'),
    enabled: showReserveModal || activeTab === 'documents',
    staleTime: 1000 * 60 * 5,
  })

  const reserveTemplatesQuery = useQuery({
    queryKey: ['document-templates'],
    queryFn: () => useFetch('/documents/getTemplates'),
    enabled: showReserveModal || activeTab === 'documents',
    staleTime: 1000 * 60 * 5,
  })

  const documentTemplates = reserveTemplatesQuery.data?.templates || []
  const templateDocuments = reserveTemplatesQuery.data?.template_documents || []

  const documentLibrary = useMemo(
    () =>
      (reserveDocumentsQuery.data?.documents || []).map((document) => ({
        id: document.document_id,
        document_id: document.document_id,
        name: document.document_name,
        description: document.document_description || 'No description',
        requirement: document.document_is_required ? 'required' : 'optional',
        status: document.document_status || 'active',
      })),
    [reserveDocumentsQuery.data]
  )

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
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to update listing.' })
    },
  })


  // Rebuilds only unreleased commission rows using the seller's current hierarchy.
  const recalculateCommissionMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/recalculate-commission`,
        payload
      ),
    onMutate: () => {
      setAlert({
        type: 'loading',
        message: `Recalculating the commission hierarchy for ${listing.unit_id || listing.unitCode || 'this unit'}...`,
      })
    },
    onSuccess: (result) => {
      setAlert({
        type: 'success',
        message: result?.message || 'Commission hierarchy recalculated successfully.',
      })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      setAlert({
        type: 'error',
        message: error?.message || 'Failed to recalculate the unit commission.',
      })
    },
  })

  const reserveListingMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/reserve`, payload),
    onMutate: (payload) => {
      setAlert({ type: 'loading', message: `Reserving ${payload?.clientProfile?.buyerName || 'listing'}...` })
    },
    onSuccess: (result) => {
      setShowReserveModal(false)
      setAlert({ type: 'success', message: result?.message || 'Reservation saved successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to reserve listing.' })
    },
  })

  const createBuyerFormLinkMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/buyer-form-links`, payload),
    onMutate: () => {
      setBuyerFormNotice({ type: 'loading', message: 'Generating a secure buyer form link...' })
      setGeneratedBuyerFormUrl('')
    },
    onSuccess: (result) => {
      setGeneratedBuyerFormUrl(result?.data?.publicUrl || '')
      setBuyerFormNotice({ type: 'success', message: result?.message || 'Buyer form link created.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
    },
    onError: (error) => {
      setBuyerFormNotice({ type: 'error', message: error?.message || 'Failed to generate buyer form link.' })
    },
  })

  const revokeBuyerFormLinkMutation = useMutation({
    mutationFn: (link) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/buyer-form-links/${link.id}/revoke`,
        {}
      ),
    onMutate: () => setBuyerFormNotice({ type: 'loading', message: 'Revoking buyer form link...' }),
    onSuccess: (result) => {
      setGeneratedBuyerFormUrl('')
      setBuyerFormNotice({ type: 'success', message: result?.message || 'Buyer form link revoked.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
    },
    onError: (error) => setBuyerFormNotice({ type: 'error', message: error?.message || 'Failed to revoke buyer form link.' }),
  })

  const rejectBuyerFormSubmissionMutation = useMutation({
    mutationFn: ({ submission, reason }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/buyer-form-submissions/${submission.id}/reject`,
        { reason }
      ),
    onMutate: () => setAlert({ type: 'loading', message: 'Rejecting buyer form submission...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Buyer form submission rejected.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Failed to reject buyer form submission.' }),
  })

  const holdListingMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPatch(`/projects/lot-projects/${projectSlug}/listings/${listingId}/hold`, payload),
    onMutate: (payload) => {
      setAlert({ type: 'loading', message: `Holding unit for ${payload.clientName || 'client'}...` })
    },
    onSuccess: (result) => {
      setShowHoldModal(false)
      setAlert({ type: 'success', message: result?.message || 'Listing held successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to hold listing.' })
    },
  })

  const unholdListingMutation = useMutation({
    mutationFn: () =>
      useFetchPatch(`/projects/lot-projects/${projectSlug}/listings/${listingId}/unhold`, {}),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Returning listing to available...' })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Listing returned to available.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to unhold listing.' })
    },
  })

  const uploadDocumentMutation = useMutation({
    mutationFn: ({ document, payload }) =>
      useFetchPut(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/documents/${document.id}/upload`,
        payload
      ),
    onMutate: ({ document }) => {
      setAlert({ type: 'loading', message: `Uploading ${document?.name || 'document'}...` })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Document uploaded successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to upload document.' })
    },
  })

  const approveDocumentMutation = useMutation({
    mutationFn: (document) =>
      useFetchPatch(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/documents/${document.id}/approve`,
        {}
      ),
    onMutate: (document) => {
      setAlert({ type: 'loading', message: `Approving ${document?.name || 'document'}...` })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Document approved successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to approve document.' })
    },
  })

  const clearDocumentMutation = useMutation({
    mutationFn: (document) =>
      useFetchPatch(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/documents/${document.id}/clear`,
        {}
      ),
    onMutate: (document) => {
      setAlert({ type: 'loading', message: `Clearing ${document?.name || 'document'}...` })
    },
    onSuccess: (result) => {
      setAlert({ type: 'warning', message: result?.message || 'Document cleared successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to clear document.' })
    },
  })

  const updateDocumentRequirementsMutation = useMutation({
    mutationFn: (nextDocuments) =>
      useFetchPut(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/document-requirements`,
        { documents: nextDocuments }
      ),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Saving document requirements...' })
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Document requirements updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to update document requirements.' })
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
      queryClient.invalidateQueries({ queryKey: ['lot-buyer-form-state', projectSlug, listingId] })
      queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
    },
    onError: (error) => {
      setAlert({ type: 'error', message: error?.message || 'Failed to update buyer profile.' })
    },
  })

  const handleReserveListing = (reservationPayload) => reserveListingMutation.mutateAsync(reservationPayload)

  const openManualReservation = () => {
    setReserveMode('manual')
    setShowReserveModal(true)
  }

  const reviewBuyerFormSubmission = () => {
    if (!pendingBuyerFormSubmission) return
    setReserveMode('submission-review')
    setShowReserveModal(true)
  }

  const rejectBuyerFormSubmission = (submission) => {
    const reason = window.prompt('Reason for rejecting this buyer form submission:', 'Buyer information requires correction.')
    if (reason === null) return
    if (!window.confirm(`Reject ${submission?.buyerName || 'this buyer'} and return the unit to available?`)) return
    rejectBuyerFormSubmissionMutation.mutate({ submission, reason: reason.trim() })
  }

  const handleRefresh = () => {
    profileQuery.refetch()
    buyerFormStateQuery.refetch()
  }

  const isHeld = listing.rawStatus === 'hold' || listing.listing_status === 'Hold'
  const canHold = listing.rawStatus === 'available' || listing.listing_status === 'Available'
  const canReserve = listing.rawStatus === 'available' || listing.listing_status === 'Available'
  const isBuyerFormHold = Boolean(isHeld && pendingBuyerFormSubmission)
  const canManageBuyerForm = Boolean(canReserve && !buyerForm.migrationRequired)
  const hasActiveBuyerFormLink = ['active', 'opened'].includes(String(currentBuyerFormLink?.status || '').toLowerCase())
  const canManageDocuments = Boolean(listing.hasClientProfile && listing.canEditBuyerProfile)

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

      {buyerForm.migrationRequired ? (
        <StatusAlert type="warning" message={buyerForm.message || 'Run the buyer form database migration before using form links.'} />
      ) : null}

      <BuyerFormStatusBanner
        submission={pendingBuyerFormSubmission}
        onReview={reviewBuyerFormSubmission}
        onReject={rejectBuyerFormSubmission}
        isSaving={rejectBuyerFormSubmissionMutation.isPending}
      />

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

                {listing.rawStatus === 'hold' && listing.heldForName ? (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs font-black text-amber-700">
                      Held for: {listing.heldForName}
                    </p>

                    {listing.holdNote ? (
                      <p className="mt-1 text-xs font-semibold text-amber-800">
                        Reason: {listing.holdNote}
                      </p>
                    ) : null}
                  </div>
                ) : null}

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Database route id: {listingId || '-'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
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
              {listing.rawStatus === 'hold' && listing.heldForName ? (
                <p className="mt-1 text-xs font-black text-amber-700">Held for: {listing.heldForName}</p>
              ) : null}
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
              onClick={() => {
                if (isBuyerFormHold) return
                if (isHeld) {
                  if (window.confirm('Unhold this listing and return it to available?')) {
                    unholdListingMutation.mutate()
                  }
                  return
                }

                setShowHoldModal(true)
              }}
              disabled={
                profileQuery.isLoading ||
                holdListingMutation.isPending ||
                unholdListingMutation.isPending ||
                (!canHold && !isHeld) ||
                isBuyerFormHold
              }
              className={`inline-flex min-h-[68px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98] ${
                isHeld
                  ? 'bg-slate-700 hover:bg-slate-800'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {isHeld ? <FiUnlock className="h-4 w-4" /> : <FiPauseCircle className="h-4 w-4" />}
              {isBuyerFormHold ? 'Buyer Form Hold' : isHeld ? 'Unhold' : 'Hold'}
            </button>

            <button
              type="button"
              onClick={() => {
                setGeneratedBuyerFormUrl('')
                setBuyerFormNotice(null)
                setShowBuyerFormLinkModal(true)
              }}
              disabled={!canManageBuyerForm || profileQuery.isLoading}
              className="inline-flex min-h-[68px] items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
            >
              <FiLink className="h-4 w-4" />
              {hasActiveBuyerFormLink ? 'Manage Form Link' : 'Send Buyer Form'}
            </button>

            <button
              type="button"
              onClick={isBuyerFormHold ? reviewBuyerFormSubmission : openManualReservation}
              disabled={(!canReserve && !isBuyerFormHold) || profileQuery.isLoading}
              className="inline-flex min-h-[68px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
            >
              <FiUserCheck className="h-4 w-4" />
              {isBuyerFormHold ? 'Review Form' : 'Reserve'}
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

      <TabErrorBoundary resetKey={`${activeTab}-${projectSlug}-${listingId}`}>
      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'unit' ? (
        <UnitStatus
          listing={listing}
          project={project}
          onSave={(payload) => updateListingMutation.mutateAsync(payload)}
          canRecalculateCommission={canRecalculateCommission}
          onRecalculateCommission={(payload) => recalculateCommissionMutation.mutateAsync(payload)}
          isSaving={updateListingMutation.isPending}
          isRecalculatingCommission={recalculateCommissionMutation.isPending}
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
        <Documents
          documents={documents}
          canManage={canManageDocuments}
          canEditRequirements={Boolean(listing.id || listing.routeId || listingId)}
          projectSlug={projectSlug}
          listingId={listingId}
          project={project}
          listing={listing}
          client={client}
          libraryDocuments={documentLibrary}
          projectDefaultDocuments={project.defaultDocuments || []}
          onUploadDocument={(document, payload) => uploadDocumentMutation.mutateAsync({ document, payload })}
          onApproveDocument={(document) => approveDocumentMutation.mutateAsync(document)}
          onClearDocument={(document) => clearDocumentMutation.mutateAsync(document)}
          onSaveRequirements={(nextDocuments) => updateDocumentRequirementsMutation.mutateAsync(nextDocuments)}
          isSaving={
            uploadDocumentMutation.isPending ||
            approveDocumentMutation.isPending ||
            clearDocumentMutation.isPending
          }
          isSavingRequirements={updateDocumentRequirementsMutation.isPending}
        />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'accounts' ? (
        <AccountHistoryPanel
          projectSlug={projectSlug}
          listingId={listingId}
          isSuperAdmin={['super_admin', 'admin'].includes(currentUserData?.user?.role)}
        />
      ) : null}

      {!profileQuery.isLoading && !profileQuery.isError && activeTab === 'printouts' ? (
        <Printouts
          projectSlug={projectSlug}
          project={project}
          listing={listing}
          client={client}
          soaRows={soaRows}
          payments={payments}
          documents={documents}
        />
      ) : null}
      </TabErrorBoundary>

      {showHoldModal ? (
        <HoldListingModal
          listing={listing}
          isSaving={holdListingMutation.isPending}
          onClose={() => setShowHoldModal(false)}
          onSubmit={(payload) => holdListingMutation.mutateAsync(payload)}
        />
      ) : null}

      {showReserveModal ? (
        <ReserveListingModal
          listing={listing}
          client={reserveMode === 'submission-review' ? pendingBuyerFormSubmission?.submittedPayload || {} : client}
          mode={reserveMode}
          buyerFormSubmissionId={reserveMode === 'submission-review' ? pendingBuyerFormSubmission?.id : null}
          submissionMeta={reserveMode === 'submission-review' ? pendingBuyerFormSubmission : null}
          onClose={() => {
            setShowReserveModal(false)
            setReserveMode('manual')
          }}
          project={project}
          documentLibrary={documentLibrary}
          projectDefaultDocuments={project.defaultDocuments || []}
          documentTemplates={documentTemplates}
          templateDocuments={templateDocuments}
          isLoadingDocuments={reserveDocumentsQuery.isLoading || reserveTemplatesQuery.isLoading}
          onReserve={handleReserveListing}
        />
      ) : null}


      {showBuyerFormLinkModal ? (
        <BuyerFormLinkModal
          listing={listing}
          currentLink={currentBuyerFormLink}
          generatedUrl={generatedBuyerFormUrl}
          notice={buyerFormNotice}
          isSaving={createBuyerFormLinkMutation.isPending || revokeBuyerFormLinkMutation.isPending}
          onGenerate={(payload) => createBuyerFormLinkMutation.mutate(payload)}
          onRevoke={(link) => {
            if (window.confirm('Revoke this buyer form link? The buyer will no longer be able to submit it.')) {
              revokeBuyerFormLinkMutation.mutate(link)
            }
          }}
          onClearNotice={() => setBuyerFormNotice(null)}
          onClose={() => {
            setShowBuyerFormLinkModal(false)
            setBuyerFormNotice(null)
            setGeneratedBuyerFormUrl('')
          }}
        />
      ) : null}
    </main>
  )
}

export default ListingProfile
