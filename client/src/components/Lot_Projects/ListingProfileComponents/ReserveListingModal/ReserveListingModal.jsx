import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiLoader,
  FiUserCheck,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import ReserveClientProfileModal from './ReserveClientProfileModal'
import ReserveDocumentChecklistModal from './ReserveDocumentChecklistModal'
import ReservePaymentTermsModal from './ReservePaymentTermsModal'
import { reserveSteps } from './reserveData'
import { getInitialClientForm, getPaymentCalculations } from './reserveUtils'
import { getListingPricingForMode } from '../../../../utils/listingPricing.js'
import { StepPill } from './ReserveShared'
import { getBuyerProfileValidationError } from '../../../../utils/buyerProfileValidation'
import { useFetch as fetchApi } from '../../../../utils/useFetch'

const todayISO = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

const shiftIsoYears = (value, years) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(Date.UTC(year + years, month - 1, day)).toISOString().slice(0, 10)
}

const normalizeLibraryDocument = (document) => ({
  ...document,
  id: Number(document.document_id || document.id),
  document_id: Number(document.document_id || document.id),
  name: document.name || document.document_name,
  description: document.description || document.document_description || 'No description',
  requirement: document.requirement || (document.document_is_required ? 'required' : 'optional'),
  status: document.status || document.document_status || 'active',
})

const normalizeAgent = (agent = {}) => ({
  ...agent,
  id: Number(agent.accreditedSellerId || agent.accredited_seller_id || agent.id),
  accredited_seller_id: Number(agent.accreditedSellerId || agent.accredited_seller_id || agent.id),
  name: agent.name || 'Unnamed sales agent',
  role: agent.role || 'Agent',
  roleValue: agent.roleValue || agent.role_value || 'agent',
  directRate: Number(agent.directRate ?? agent.rateValue ?? agent.rate ?? 0),
  rateValue: Number(agent.directRate ?? agent.rateValue ?? agent.rate ?? 0),
  groupName: agent.groupName || agent.group_name || '-',
  reportsUnderName: agent.reportsUnderName || agent.reports_under_name || '-',
  isSystemDummy: Boolean(agent.isSystemDummy ?? agent.is_system_dummy),
  ownerName: agent.ownerName || agent.owner_name || null,
})

const ReserveListingModal = ({
  listing,
  project,
  client,
  documentLibrary: documentLibraryProp = [],
  projectDefaultDocuments: projectDefaultDocumentsProp = [],
  documentTemplates = [],
  templateDocuments = [],
  isLoadingDocuments = false,
  mode = 'manual',
  buyerFormSubmissionId = null,
  submissionMeta = null,
  onClose,
  onReserve,
}) => {
  const [activeStep, setActiveStep] = useState(1)
  const [clientForm, setClientForm] = useState(() => getInitialClientForm(client))
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [searchDocument, setSearchDocument] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [agentSearch, setAgentSearch] = useState('')
  const [debouncedAgentSearch, setDebouncedAgentSearch] = useState('')
  const [selectedAgentSnapshot, setSelectedAgentSnapshot] = useState(null)
  const [alert, setAlert] = useState(null)
  const [invalidClientField, setInvalidClientField] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [paymentForm, setPaymentForm] = useState({
    sellerId: '',
    modeOfPayment: 'installment',
    reservationFee: String(listing?.reservationFee || '50000'),
    startingDate: todayISO(),
    firstDueDate: todayISO(),
    isHistoricalEntry: false,
    legalMiscFee: 'include_in_monthly',
    legalMiscFeeMode: 'include_in_monthly',
    legalMiscFeeRate: String(
      listing?.lmfRate ??
      listing?.legalMiscRate ??
      listing?.lot_project_listing_lmf_rate ??
      0
    ),
    legalMiscFeeAmount: String(listing?.lmfAmount || listing?.legalMiscFeeAmount || 0),
    downpaymentPercentageMode: '30',
    customDownpaymentPercentage: '',
    downpaymentTermsMode: 'spot_cash',
    customDownpaymentTerms: '',
    reservationFeeTreatment: 'separate',
    saleDiscountPercentage: '0',
    dpDiscountPercentage: '0',
    monthlyTermsMode: '36',
    customMonthlyTerms: '',
    interestRate: String(
      listing?.annualInterestRate ??
      listing?.annual_interest_rate ??
      0
    ),
    dailyPenaltyRate: '0.1',
    penaltyGraceDays: '1',
  })

  const contractPricing = useMemo(
    () => getListingPricingForMode(
      listing,
      paymentForm.modeOfPayment,
      Number(paymentForm.saleDiscountPercentage || 0),
      paymentForm.legalMiscFeeRate
    ),
    [
      listing,
      paymentForm.modeOfPayment,
      paymentForm.saleDiscountPercentage,
      paymentForm.legalMiscFeeRate,
    ]
  )
  const tcp = contractPricing.tcp
  const projectSlug = project?.slug || project?.lot_project_slug || listing?.project_slug || ''
  const listingLookup = listing?.id || listing?.listing_id || listing?.lot_project_listing_id || listing?.unit_id || listing?.unitCode || ''

  const documentLibrary = useMemo(
    () => documentLibraryProp.map(normalizeLibraryDocument).filter((document) => document.id),
    [documentLibraryProp]
  )

  const projectDefaultDocuments = useMemo(
    () => projectDefaultDocumentsProp.map(normalizeLibraryDocument).filter((document) => document.id),
    [projectDefaultDocumentsProp]
  )

  const activeDocumentTemplates = useMemo(
    () => (documentTemplates || []).filter((template) => template.template_status !== 'inactive'),
    [documentTemplates]
  )

  // Delay agent searches slightly so typing does not issue one request per key.
  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedAgentSearch(agentSearch.trim()), 300)
    return () => window.clearTimeout(timeoutId)
  }, [agentSearch])

  const agentsQuery = useQuery({
    queryKey: ['reservation-agents', projectSlug, debouncedAgentSearch],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' })
      if (debouncedAgentSearch) params.set('search', debouncedAgentSearch)
      return fetchApi(`/projects/lot-projects/${projectSlug}/reservation-agents?${params.toString()}`)
    },
    enabled: Boolean(projectSlug && activeStep === 3),
    staleTime: 30_000,
  })

  const fetchedAgents = useMemo(
    () => (agentsQuery.data?.data || []).map(normalizeAgent).filter((agent) => agent.id),
    [agentsQuery.data]
  )

  const selectedAgent = useMemo(() => (
    fetchedAgents.find((agent) => String(agent.id) === String(paymentForm.sellerId))
    || selectedAgentSnapshot
    || null
  ), [fetchedAgents, paymentForm.sellerId, selectedAgentSnapshot])


  const effectivePaymentForm = useMemo(
    () => ({
      ...paymentForm,
      legalMiscFeeAmount: String(contractPricing.lmfAmount || 0),
    }),
    [paymentForm, contractPricing.lmfAmount]
  )

  const previewQuery = useQuery({
    queryKey: ['commission-preview', projectSlug, String(listingLookup), String(paymentForm.sellerId), paymentForm.modeOfPayment, paymentForm.saleDiscountPercentage],
    queryFn: () => {
      const params = new URLSearchParams({
        listingId: String(listingLookup),
        agentId: String(paymentForm.sellerId),
        modeOfPayment: paymentForm.modeOfPayment,
        saleDiscountPercentage: String(paymentForm.saleDiscountPercentage || 0),
      })
      return fetchApi(`/projects/lot-projects/${projectSlug}/commission-preview?${params.toString()}`)
    },
    enabled: Boolean(projectSlug && listingLookup && paymentForm.sellerId && activeStep === 3),
    retry: false,
  })

  const commissionPreview = previewQuery.data?.data || null
  const hasSecondBuyer = clientForm.buyerType === 'spouses' || clientForm.buyerType === 'and_account'

  const filteredDocuments = useMemo(() => {
    const keyword = searchDocument.trim().toLowerCase()
    const selectedTemplateDocumentIds = selectedTemplateId
      ? new Set(
          templateDocuments
            .filter((document) => String(document.template_id) === String(selectedTemplateId))
            .map((document) => Number(document.document_id))
        )
      : null

    return documentLibrary.filter((document) => {
      const documentId = Number(document.document_id || document.id)
      if (selectedTemplateDocumentIds && !selectedTemplateDocumentIds.has(documentId)) return false
      if (!keyword) return true

      return `${document.name || ''} ${document.description || ''}`
        .toLowerCase()
        .includes(keyword)
    })
  }, [documentLibrary, searchDocument, selectedTemplateId, templateDocuments])

  const updatePaymentField = (key, value) => {
    // Clear the old hierarchy immediately when another agent is selected.
    if (key === 'sellerId' && String(value) !== String(paymentForm.sellerId)) {
      setSelectedAgentSnapshot(fetchedAgents.find((agent) => String(agent.id) === String(value)) || null)
    }

    setPaymentForm((current) => ({ ...current, [key]: value }))
    if (alert?.type === 'error') setAlert(null)
  }

  const updateBuyerType = (buyerType) => {
    setInvalidClientField('')
    setClientForm((current) => ({
      ...current,
      buyerType,
      secondBuyerRole: buyerType === 'spouses' ? 'spouse' : 'co_owner',
    }))
    setAlert({
      type: 'info',
      message: buyerType === 'single'
        ? 'Single buyer selected. Second buyer form hidden.'
        : 'Second buyer form shown for the Offer to Buy printout.',
    })
  }

  const handleClientFieldChange = (fieldKey) => {
    if (invalidClientField === fieldKey) setInvalidClientField('')
  }

  const isDocumentAdded = (documentId) => selectedDocuments.some(
    (item) => Number(item.document_id || item.id) === Number(documentId)
  )

  const addDocument = (document) => {
    const documentId = Number(document.document_id || document.id)
    if (isDocumentAdded(documentId)) {
      setAlert({ type: 'info', message: 'Document is already added.' })
      return
    }

    setSelectedDocuments((current) => [...current, {
      ...document,
      id: documentId,
      document_id: documentId,
      requirement: document.requirement || 'required',
      status: 'active',
    }])
    setAlert({ type: 'success', message: `${document.name} added to the reservation checklist.` })
  }

  const mergeSelectedDocuments = (documents = []) => {
    setSelectedDocuments((current) => {
      const existingIds = new Set(current.map((document) => Number(document.document_id || document.id)))
      const additions = documents
        .map(normalizeLibraryDocument)
        .filter((document) => document.id && !existingIds.has(Number(document.id)))
      return [...current, ...additions]
    })
  }

  const removeDocument = (documentId) => {
    setSelectedDocuments((current) => current.filter(
      (document) => Number(document.document_id || document.id) !== Number(documentId)
    ))
    setAlert({ type: 'warning', message: 'Document removed from the reservation checklist.' })
  }

  const loadProjectDefaults = () => {
    if (isLoadingDocuments) {
      setAlert({ type: 'loading', message: 'Loading project default documents...' })
      return
    }
    if (!projectDefaultDocuments.length) {
      setAlert({ type: 'warning', message: 'This project has no default documents configured.' })
      return
    }

    mergeSelectedDocuments(projectDefaultDocuments)
    setAlert({ type: 'success', message: 'Project default documents loaded.' })
  }

  const validateClientStep = () => {
    const validationError = getBuyerProfileValidationError(clientForm)
    if (validationError) {
      setInvalidClientField(validationError.field)
      setAlert({ type: 'error', message: validationError.message })
      return false
    }
    setInvalidClientField('')
    return true
  }

  const validatePaymentStep = () => {
    if (!paymentForm.sellerId || !selectedAgent) {
      setAlert({ type: 'error', message: 'Select an active sales agent for this reservation.' })
      return false
    }
    if (String(selectedAgent.roleValue).toLowerCase() !== 'agent') {
      setAlert({ type: 'error', message: 'Only active sales agents can be assigned to a reservation.' })
      return false
    }
    if (Number(selectedAgent.directRate || 0) <= 0) {
      setAlert({ type: 'error', message: 'The selected agent does not have an active sales commission rate for this project.' })
      return false
    }
    if (previewQuery.isLoading || previewQuery.isFetching) {
      setAlert({ type: 'loading', message: 'Calculating the commission hierarchy...' })
      return false
    }
    if (previewQuery.isError || !commissionPreview) {
      setAlert({ type: 'error', message: previewQuery.error?.message || 'The commission hierarchy could not be loaded.' })
      return false
    }
    if (!commissionPreview.isValid) {
      setAlert({ type: 'error', message: 'The selected agent hierarchy has an invalid commission allocation.' })
      return false
    }
    if (!paymentForm.reservationFee || Number(paymentForm.reservationFee) <= 0) {
      setAlert({ type: 'error', message: 'Reservation fee is required.' })
      return false
    }

    const today = todayISO()
    const historicalMinimum = shiftIsoYears(today, -1)
    const startingDate = String(paymentForm.startingDate || '')
    const firstDueDate = String(paymentForm.firstDueDate || '')
    const isHistoricalEntry = Boolean(paymentForm.isHistoricalEntry)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startingDate)) {
      setAlert({ type: 'error', message: 'Starting Date is required.' })
      return false
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) {
      setAlert({ type: 'error', message: 'First Due Date is required.' })
      return false
    }

    if (isHistoricalEntry) {
      if (startingDate < historicalMinimum || startingDate > today) {
        setAlert({ type: 'error', message: `Historical Starting Date must be from ${historicalMinimum} through ${today}.` })
        return false
      }
      if (firstDueDate > today) {
        setAlert({ type: 'error', message: 'Historical First Due Date cannot be after today.' })
        return false
      }
    } else {
      if (startingDate < today) {
        setAlert({ type: 'error', message: 'Starting Date must be today or a future date.' })
        return false
      }
      if (firstDueDate < today) {
        setAlert({ type: 'error', message: 'First Due Date must be today or a future date.' })
        return false
      }
    }

    if (firstDueDate < startingDate) {
      setAlert({ type: 'error', message: 'First Due Date cannot be before the Starting Date.' })
      return false
    }

    const isCash = String(paymentForm.modeOfPayment || '').toLowerCase() === 'cash'
    const saleDiscountPercentage = Number(paymentForm.saleDiscountPercentage || 0)
    if (!Number.isFinite(saleDiscountPercentage) || saleDiscountPercentage < 0 || saleDiscountPercentage > 100) {
      setAlert({ type: 'error', message: 'Sale discount percentage must be between 0 and 100.' })
      return false
    }
    const legalMiscFeeRate = Number(paymentForm.legalMiscFeeRate)
    if (
      String(paymentForm.legalMiscFeeRate ?? '').trim() === '' ||
      !Number.isFinite(legalMiscFeeRate) ||
      legalMiscFeeRate < 0 ||
      legalMiscFeeRate > 100
    ) {
      setAlert({ type: 'error', message: 'LMF rate must be between 0 and 100.' })
      return false
    }
    const interestRate = Number(paymentForm.interestRate)
    if (
      !isCash && (
        String(paymentForm.interestRate ?? '').trim() === '' ||
        !Number.isFinite(interestRate) ||
        interestRate < 0 ||
        interestRate > 100
      )
    ) {
      setAlert({ type: 'error', message: 'Interest rate must be between 0 and 100.' })
      return false
    }
    const dpDiscountPercentage = Number(paymentForm.dpDiscountPercentage || 0)
    if (!Number.isFinite(dpDiscountPercentage) || dpDiscountPercentage < 0 || dpDiscountPercentage > 100) {
      setAlert({ type: 'error', message: 'Downpayment discount percentage must be between 0 and 100.' })
      return false
    }
    if (!isCash && paymentForm.downpaymentPercentageMode === 'custom') {
      const rawValue = String(paymentForm.customDownpaymentPercentage ?? '').trim()
      const value = Number(rawValue)
      if (rawValue === '' || !Number.isFinite(value) || value < 0 || value > 100) {
        setAlert({ type: 'error', message: 'Custom downpayment percentage must be between 0 and 100.' })
        return false
      }
    }
    if (!isCash && paymentForm.downpaymentTermsMode === 'custom' && Number(paymentForm.customDownpaymentTerms || 0) <= 0) {
      setAlert({ type: 'error', message: 'Custom downpayment terms are required.' })
      return false
    }
    if (!isCash && paymentForm.monthlyTermsMode === 'custom' && Number(paymentForm.customMonthlyTerms || 0) <= 0) {
      setAlert({ type: 'error', message: 'Custom monthly terms are required.' })
      return false
    }

    const dailyPenaltyRateRaw = String(paymentForm.dailyPenaltyRate ?? '').trim()
    const dailyPenaltyRate = Number(dailyPenaltyRateRaw)
    if (dailyPenaltyRateRaw === '' || !Number.isFinite(dailyPenaltyRate) || dailyPenaltyRate < 0 || dailyPenaltyRate > 100) {
      setAlert({ type: 'error', message: 'Daily penalty rate must be between 0 and 100.' })
      return false
    }
    const graceDays = Number(paymentForm.penaltyGraceDays)
    if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 31) {
      setAlert({ type: 'error', message: 'Penalty grace period must be between 0 and 31 days.' })
      return false
    }
    return true
  }

  const goNext = () => {
    if (activeStep === 1 && !validateClientStep()) return
    setActiveStep((current) => Math.min(current + 1, 3))
    setAlert({ type: 'success', message: `${reserveSteps[activeStep - 1].title} saved in this reservation draft.` })
  }

  const goBack = () => {
    setActiveStep((current) => Math.max(current - 1, 1))
    setAlert(null)
  }

  const handleReserve = async () => {
    if (!validateClientStep()) {
      setActiveStep(1)
      return
    }
    if (!validatePaymentStep()) {
      setActiveStep(3)
      return
    }

    const paymentCalculations = getPaymentCalculations(tcp, effectivePaymentForm)

    // New reservations always use distributed commission generation. A
    // non-agent direct sale is represented by that seller's system agent.
    const payload = {
      listing,
      buyerFormSubmissionId: buyerFormSubmissionId || undefined,
      clientProfile: { ...clientForm, profileStatus: 'complete' },
      documents: selectedDocuments,
      reservation: {
        status: 'reserved',
        seller: selectedAgent,
        modeOfPayment: paymentForm.modeOfPayment,
        paymentTerms: {
          ...effectivePaymentForm,
          sellerId: selectedAgent.id,
          legalMiscFeeMode: effectivePaymentForm.legalMiscFeeMode || effectivePaymentForm.legalMiscFee,
          legalMiscFeeRate: Number(effectivePaymentForm.legalMiscFeeRate || 0),
          legalMiscFeeAmount: effectivePaymentForm.legalMiscFeeAmount,
          interestRate: Number.isFinite(Number(effectivePaymentForm.interestRate))
            ? Number(effectivePaymentForm.interestRate)
            : 0,
          tcp,
          selectedPricing: contractPricing,
          saleDiscountPercentage: Number(paymentForm.saleDiscountPercentage || 0),
          downpaymentPercentage: paymentCalculations.downpaymentPercentage,
          downpaymentTerms: paymentCalculations.downpaymentTerms,
          monthlyTerms: paymentCalculations.monthlyTerms,
          reservationFeeTreatment: paymentCalculations.reservationFeeTreatment,
          reservationFeeAppliedToDownpayment: paymentCalculations.reservationFeeAppliedToDownpayment,
          preview: paymentCalculations.preview,
        },
      },
    }

    setIsSaving(true)
    setAlert({
      type: 'loading',
      message: mode === 'submission-review'
        ? 'Approving the buyer form and creating the reservation...'
        : 'Saving the reservation and commission records...',
    })

    try {
      await onReserve?.({
        listing: { unitId: listing?.unit_id || listing?.unitCode || 'Selected Unit' },
        ...payload,
      })
      setAlert({ type: 'success', message: 'Reservation created successfully.' })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to reserve the listing.' })
    } finally {
      setIsSaving(false)
    }
  }

  const reservationBlocked = isSaving || previewQuery.isLoading || previewQuery.isFetching || !commissionPreview?.isValid

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-0 sm:p-4">
      <div
        className="flex h-dvh w-full max-w-7xl flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl sm:h-[94vh] sm:rounded-xl"
        aria-busy={isSaving || agentsQuery.isFetching || previewQuery.isFetching}
      >
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black text-slate-950">{mode === 'submission-review' ? 'Review Buyer Form & Reserve' : 'Reserve Listing'}</h2>
            <p className="truncate text-xs font-semibold text-slate-500">
              {listing?.unit_id || listing?.unitCode || 'Selected Unit'} · {project?.name || listing?.project_name || listing?.projectName || 'Selected Project'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close reserve listing modal"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-4"><div className="flex gap-3 overflow-x-auto">{reserveSteps.map((step) => <StepPill key={step.id} step={step} activeStep={activeStep} completed={activeStep > step.id} />)}</div></div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mb-4" /> : null}

          {mode === 'submission-review' && submissionMeta ? <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900"><p className="font-black">Buyer-submitted information is prefilled below.</p><p className="mt-1 text-xs">Review and correct the profile, then complete the document checklist and payment terms before approval.</p></div> : null}

          {activeStep === 1 ? <ReserveClientProfileModal clientForm={clientForm} setClientForm={setClientForm} hasSecondBuyer={hasSecondBuyer} updateBuyerType={updateBuyerType} invalidField={invalidClientField} onFieldChange={handleClientFieldChange} title={mode === 'submission-review' ? 'Submitted Buyer Profile' : 'Client Profile'} description={mode === 'submission-review' ? 'Review the information submitted by the buyer. Admin corrections will be saved with the final reservation.' : undefined} /> : null}

          {activeStep === 2 ? <ReserveDocumentChecklistModal filteredDocuments={filteredDocuments} searchDocument={searchDocument} setSearchDocument={setSearchDocument} selectedDocuments={selectedDocuments} isSaving={isSaving} isLoadingDefaults={isLoadingDocuments} deletingDocId={null} isDocumentAdded={isDocumentAdded} addDocument={addDocument} removeDocument={removeDocument} loadProjectDefaults={loadProjectDefaults} documentTemplates={activeDocumentTemplates} selectedTemplateId={selectedTemplateId} setSelectedTemplateId={setSelectedTemplateId} /> : null}

          {activeStep === 3 ? <ReservePaymentTermsModal listing={listing} project={project} tcp={tcp} contractPricing={contractPricing} paymentForm={effectivePaymentForm} updatePaymentField={updatePaymentField} agents={fetchedAgents} selectedAgent={selectedAgent} agentSearch={agentSearch} setAgentSearch={setAgentSearch} isLoadingAgents={agentsQuery.isLoading || agentsQuery.isFetching} agentsError={!projectSlug ? 'Project information is missing.' : agentsQuery.isError ? agentsQuery.error?.message || 'Failed to load sales agents.' : null} commissionPreview={commissionPreview} isLoadingPreview={previewQuery.isLoading || previewQuery.isFetching} previewError={previewQuery.isError ? previewQuery.error?.message || 'Failed to load the commission hierarchy.' : null} /> : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500"><FiAlertCircle className="h-4 w-4" /><span>Step {activeStep} of {reserveSteps.length}</span></div>
          <div className="grid gap-2 sm:flex sm:justify-end">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
            {activeStep > 1 ? <button type="button" onClick={goBack} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"><FiChevronLeft className="h-4 w-4" />Back</button> : null}
            {activeStep < 3 ? <button type="button" onClick={goNext} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">Next<FiChevronRight className="h-4 w-4" /></button> : <button type="button" onClick={handleReserve} disabled={reservationBlocked} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">{isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiUserCheck className="h-4 w-4" />}{isSaving ? (mode === 'submission-review' ? 'Approving...' : 'Reserving...') : previewQuery.isFetching ? 'Calculating...' : (mode === 'submission-review' ? 'Approve & Reserve Unit' : 'Reserve Listing')}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReserveListingModal



