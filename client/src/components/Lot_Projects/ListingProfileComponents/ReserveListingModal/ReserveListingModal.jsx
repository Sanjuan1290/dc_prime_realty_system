import { useEffect, useMemo, useState } from 'react'
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
import { documentLibrary as fallbackDocumentLibrary, projectDefaultDocuments as fallbackProjectDefaultDocuments, reserveSteps } from './reserveData'
import { getInitialClientForm, getListingTcp, getPaymentCalculations } from './reserveUtils'
import { StepPill } from './ReserveShared'
import { getBuyerProfileValidationError } from '../../../../utils/buyerProfileValidation'

const todayISO = () => new Date().toISOString().slice(0, 10)


const normalizeLibraryDocument = (document) => ({
  ...document,
  id: Number(document.document_id || document.id),
  document_id: Number(document.document_id || document.id),
  name: document.name || document.document_name,
  description: document.description || document.document_description || 'No description',
  requirement: document.requirement || (document.document_is_required ? 'required' : 'required'),
  status: document.status || document.document_status || 'active',
})

const ReserveListingModal = ({
  listing,
  client,
  documentLibrary: documentLibraryProp = [],
  projectDefaultDocuments: projectDefaultDocumentsProp = [],
  sellerOptions = [],
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
  const [alert, setAlert] = useState(null)
  const [invalidClientField, setInvalidClientField] = useState('')
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState(null)

  const [paymentForm, setPaymentForm] = useState({
    sellerId: '',
    modeOfPayment: 'installment',
    saleChannel: 'distributed',

    reservationFee: String(listing?.reservationFee || '50000'),
    startingDate: todayISO(),
    firstDueDate: todayISO(),
    legalMiscFee: 'include_in_monthly',
    legalMiscFeeMode: 'include_in_monthly',
    legalMiscFeeAmount: String(listing?.lmfAmount || listing?.legalMiscFeeAmount || 0),

    downpaymentPercentageMode: '30',
    customDownpaymentPercentage: '',
    downpaymentTermsMode: 'spot_cash',
    customDownpaymentTerms: '',
    reservationFeeTreatment: 'separate',
    dpDiscountPercentage: '0',

    monthlyTermsMode: '36',
    customMonthlyTerms: '',
    interestRate: String(listing?.annualInterestRate || '0'),
    dailyPenaltyRate: '0.1',
    penaltyGraceDays: '1',
  })

  const tcp = useMemo(() => getListingTcp(listing), [listing])

  const documentLibrary = useMemo(() => {
    const source = documentLibraryProp.length ? documentLibraryProp : fallbackDocumentLibrary
    return source.map(normalizeLibraryDocument).filter((document) => document.id)
  }, [documentLibraryProp])

  const projectDefaultDocuments = useMemo(() => {
    const source = projectDefaultDocumentsProp.length ? projectDefaultDocumentsProp : fallbackProjectDefaultDocuments
    return source.map(normalizeLibraryDocument).filter((document) => document.id)
  }, [projectDefaultDocumentsProp])

  const activeDocumentTemplates = useMemo(() => {
    return (documentTemplates || []).filter((template) => template.template_status !== 'inactive')
  }, [documentTemplates])

  const availableSellers = useMemo(() => {
    return (sellerOptions || [])
      .map((seller) => ({
        ...seller,
        id: Number(seller.accredited_seller_id || seller.id),
        name: seller.name || 'Unnamed Seller',
        role: seller.role || 'Seller',
        rate: seller.rate || `${Number(seller.rateValue || 0)}%`,
        rateValue: Number(seller.rateValue ?? String(seller.rate || '0').replace('%', '')) || 0,
        allocation: seller.allocation || 'Saved seller assignment',
      }))
      .filter((seller) => seller.id)
  }, [sellerOptions])

  useEffect(() => {
    if (!paymentForm.sellerId && availableSellers.length) {
      setPaymentForm((current) => ({ ...current, sellerId: String(availableSellers[0].id) }))
    }
  }, [availableSellers, paymentForm.sellerId])

  const hasSecondBuyer = clientForm.buyerType === 'spouses' || clientForm.buyerType === 'and_account'

  const filteredDocuments = useMemo(() => {
    const keyword = searchDocument.trim().toLowerCase()

    if (!keyword) return documentLibrary

    return documentLibrary.filter((document) =>
      String(document.name || '').toLowerCase().includes(keyword)
    )
  }, [documentLibrary, searchDocument])

  const updatePaymentField = (key, value) => {
    setPaymentForm((current) => ({
      ...current,
      [key]: value,
    }))

    if (alert?.type === 'error') {
      setAlert(null)
    }
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
      message:
        buyerType === 'single'
          ? 'Single buyer selected. Second buyer form hidden.'
          : 'Second buyer form shown for the Offer to Buy printout.',
    })
  }

  const handleClientFieldChange = (fieldKey) => {
    if (invalidClientField === fieldKey) {
      setInvalidClientField('')
    }
  }

  const isDocumentAdded = (documentId) => selectedDocuments.some((item) => Number(item.document_id || item.id) === Number(documentId))

  const addDocument = (document) => {
    const documentId = Number(document.document_id || document.id)

    if (isDocumentAdded(documentId)) {
      setAlert({ type: 'info', message: 'Document is already added.' })
      return
    }

    setSelectedDocuments((current) => [
      ...current,
      {
        ...document,
        id: documentId,
        document_id: documentId,
        requirement: document.requirement || 'required',
        status: 'active',
      },
    ])

    setAlert({
      type: 'success',
      message: `${document.name} added to reservation checklist.`,
    })
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

  const loadSelectedTemplate = () => {
    const template = activeDocumentTemplates.find((item) => String(item.template_id) === String(selectedTemplateId))
    if (!template) {
      setAlert({ type: 'error', message: 'Select a template first.' })
      return
    }

    const documents = templateDocuments
      .filter((document) => String(document.template_id) === String(selectedTemplateId))
      .map((document) => ({
        ...document,
        id: document.document_id,
        document_id: document.document_id,
        name: document.document_name,
        description: document.document_description || 'No description',
        requirement: document.document_is_required ? 'required' : 'optional',
        status: document.document_status || 'active',
      }))

    if (!documents.length) {
      setAlert({ type: 'warning', message: 'Selected template has no documents.' })
      return
    }

    mergeSelectedDocuments(documents)
    setAlert({ type: 'success', message: `${template.template_name} documents loaded.` })
  }

  const removeDocument = (documentId) => {
    setDeletingDocId(documentId)
    setAlert({ type: 'loading', message: 'Removing document from checklist...' })

    window.setTimeout(() => {
      setSelectedDocuments((current) => current.filter((document) => Number(document.document_id || document.id) !== Number(documentId)))
      setDeletingDocId(null)
      setAlert({ type: 'warning', message: 'Document removed from reservation checklist.' })
    }, 350)
  }

  const loadProjectDefaults = () => {
    setIsLoadingDefaults(true)
    setAlert({ type: 'loading', message: 'Loading project default documents...' })

    window.setTimeout(() => {
      mergeSelectedDocuments(projectDefaultDocuments)
      setIsLoadingDefaults(false)
      setAlert({ type: 'success', message: 'Project default documents loaded.' })
    }, 600)
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
    if (!availableSellers.length) {
      setAlert({ type: 'error', message: 'No active accredited sellers found for this project.' })
      return false
    }

    if (!paymentForm.sellerId) {
      setAlert({ type: 'error', message: 'Assigned seller / unit manager is required.' })
      return false
    }

    if (!paymentForm.reservationFee || Number(paymentForm.reservationFee) <= 0) {
      setAlert({ type: 'error', message: 'Reservation fee is required.' })
      return false
    }

    const isCash = String(paymentForm.modeOfPayment || '').toLowerCase() === 'cash'

    if (!isCash && paymentForm.downpaymentPercentageMode === 'custom') {
      const rawCustomDownpayment = String(paymentForm.customDownpaymentPercentage ?? '').trim()
      const customDownpaymentPercentage = Number(rawCustomDownpayment)

      if (
        rawCustomDownpayment === '' ||
        !Number.isFinite(customDownpaymentPercentage) ||
        customDownpaymentPercentage < 0 ||
        customDownpaymentPercentage > 100
      ) {
        setAlert({ type: 'error', message: 'Custom downpayment percentage must be between 0 and 100.' })
        return false
      }
    }

    if (!isCash && paymentForm.downpaymentTermsMode === 'custom' && Number(paymentForm.customDownpaymentTerms || 0) <= 0) {
      setAlert({ type: 'error', message: 'Custom downpayment terms is required.' })
      return false
    }

    if (!isCash && paymentForm.monthlyTermsMode === 'custom' && Number(paymentForm.customMonthlyTerms || 0) <= 0) {
      setAlert({ type: 'error', message: 'Custom monthly terms is required.' })
      return false
    }

    const allowedPenaltyRates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5]
    if (!allowedPenaltyRates.includes(Number(paymentForm.dailyPenaltyRate))) {
      setAlert({ type: 'error', message: 'Select a valid daily penalty rate.' })
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
    setAlert({
      type: 'success',
      message: `${reserveSteps[activeStep - 1].title} saved in draft. Continue to the next step.`,
    })
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

    const selectedSeller = availableSellers.find((seller) => String(seller.id) === String(paymentForm.sellerId)) || availableSellers[0] || null
    const paymentCalculations = getPaymentCalculations(tcp, paymentForm)

    const payload = {
      listing,
      buyerFormSubmissionId: buyerFormSubmissionId || undefined,
      clientProfile: {
        ...clientForm,
        profileStatus: 'complete',
      },
      documents: selectedDocuments,
      reservation: {
        status: 'reserved',
        seller: selectedSeller,
        modeOfPayment: paymentForm.modeOfPayment,
        saleChannel: paymentForm.saleChannel,
        paymentTerms: {
          ...paymentForm,
          sellerId: selectedSeller?.id || paymentForm.sellerId,
          legalMiscFeeMode: paymentForm.legalMiscFeeMode || paymentForm.legalMiscFee,
          legalMiscFeeAmount: paymentForm.legalMiscFeeAmount,
          tcp,
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
    setAlert({ type: 'loading', message: mode === 'submission-review' ? 'Approving buyer form and creating reservation...' : 'Saving reservation to database...' })

    try {
      await onReserve?.({
        listing: {
          unitId: listing?.unit_id || listing?.unitCode || 'LA-0000',
        },
        ...payload,
      })
      setAlert({ type: 'success', message: 'Reservation saved successfully.' })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to reserve listing.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">{mode === 'submission-review' ? 'Review Buyer Form & Reserve' : 'Reserve Listing'}</h2>
            <p className="text-xs font-semibold text-slate-500">
              {listing?.unit_id || listing?.unitCode || 'Selected Unit'} · {listing?.project_name || listing?.projectName || 'Bailen Project'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close reserve listing modal"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-4">
          <div className="flex gap-3 overflow-x-auto">
            {reserveSteps.map((step) => (
              <StepPill
                key={step.id}
                step={step}
                activeStep={activeStep}
                completed={activeStep > step.id}
              />
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          {mode === 'submission-review' && submissionMeta ? (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
              <p className="font-black">Buyer-submitted information is prefilled below.</p>
              <p className="mt-1 text-xs">Review and correct the profile, then complete the document checklist and payment terms before approval.</p>
            </div>
          ) : null}

          {activeStep === 1 ? (
            <ReserveClientProfileModal
              clientForm={clientForm}
              setClientForm={setClientForm}
              hasSecondBuyer={hasSecondBuyer}
              updateBuyerType={updateBuyerType}
              invalidField={invalidClientField}
              onFieldChange={handleClientFieldChange}
              title={mode === 'submission-review' ? 'Submitted Buyer Profile' : 'Client Profile'}
              description={mode === 'submission-review' ? 'Review the information submitted by the buyer. Admin corrections will be saved with the final reservation.' : undefined}
            />
          ) : null}

          {activeStep === 2 ? (
            <ReserveDocumentChecklistModal
              filteredDocuments={filteredDocuments}
              searchDocument={searchDocument}
              setSearchDocument={setSearchDocument}
              selectedDocuments={selectedDocuments}
              isSaving={isSaving}
              isLoadingDefaults={isLoadingDefaults || isLoadingDocuments}
              deletingDocId={deletingDocId}
              isDocumentAdded={isDocumentAdded}
              addDocument={addDocument}
              removeDocument={removeDocument}
              loadProjectDefaults={loadProjectDefaults}
              documentTemplates={activeDocumentTemplates}
              selectedTemplateId={selectedTemplateId}
              setSelectedTemplateId={setSelectedTemplateId}
              loadSelectedTemplate={loadSelectedTemplate}
            />
          ) : null}

          {activeStep === 3 ? (
            <ReservePaymentTermsModal
              listing={listing}
              tcp={tcp}
              paymentForm={paymentForm}
              updatePaymentField={updatePaymentField}
              sellerOptions={availableSellers}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
            <FiAlertCircle className="h-4 w-4" />
            <span>
              Step {activeStep} of {reserveSteps.length}
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            {activeStep > 1 ? (
              <button
                type="button"
                onClick={goBack}
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}

            {activeStep < 3 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Next
                <FiChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReserve}
                disabled={isSaving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiUserCheck className="h-4 w-4" />}
                {isSaving ? (mode === 'submission-review' ? 'Approving...' : 'Reserving...') : (mode === 'submission-review' ? 'Approve & Reserve Unit' : 'Reserve Listing')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReserveListingModal


