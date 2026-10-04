import { useEffect, useMemo, useState } from 'react'
import { FiAlertCircle, FiCheckCircle, FiClock, FiFileText, FiLoader, FiMapPin } from 'react-icons/fi'
import { useParams } from 'react-router-dom'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReserveClientProfileModal from '../../components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveClientProfileModal'
import { getInitialClientForm } from '../../components/Lot_Projects/ListingProfileComponents/ReserveListingModal/reserveUtils'
import { getBuyerProfileValidationError } from '../../utils/buyerProfileValidation'
import { requestApi } from '../../utils/apiClient'
import { getDoubleCheckNotice } from '../../utils/doubleCheck'

const BRAND_LOGO = '/website/images/brand/dc-prime-email-logo.png'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date)
}

const BuyerForm = () => {
  const { token } = useParams()
  const [formInfo, setFormInfo] = useState(null)
  const [clientForm, setClientForm] = useState(() => getInitialClientForm())
  const [invalidField, setInvalidField] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [notice, setNotice] = useState({ type: 'loading', message: 'Loading buyer form...' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setNotice({ type: 'loading', message: 'Loading buyer form...' })
      try {
        const data = await requestApi(`/public/buyer-forms/${encodeURIComponent(token || '')}`, {
          headers: { Accept: 'application/json' },
          redirectOnUnavailable: false,
        })
        if (cancelled) return
        if (data.data?.alreadySubmitted) {
          setSubmitted(data.data)
          setNotice(null)
          return
        }
        setFormInfo(data.data)
        setNotice(null)
      } catch (error) {
        if (!cancelled) setNotice({ type: 'error', message: error.message || 'This buyer form could not be loaded.' })
      }
    }

    load()
    return () => { cancelled = true }
  }, [token])

  const hasSecondBuyer = clientForm.buyerType === 'spouses' || clientForm.buyerType === 'and_account'
  const unitSummary = useMemo(() => formInfo ? [
    { label: 'Unit', value: formInfo.unitId },
    { label: 'Area', value: `${Number(formInfo.areaSqm || 0).toLocaleString('en-PH')} sqm` },
  ] : [], [formInfo])

  const updateBuyerType = (buyerType) => {
    setInvalidField('')
    setClientForm((current) => ({
      ...current,
      buyerType,
      secondBuyerRole: buyerType === 'spouses' ? 'spouse' : 'co_owner',
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const validationError = getBuyerProfileValidationError(clientForm)
    if (validationError) {
      setInvalidField(validationError.field)
      setNotice({ type: 'error', message: validationError.message })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (!privacyConsent) {
      setNotice({ type: 'error', message: 'Privacy consent is required.' })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setInvalidField('')
    setIsSubmitting(true)
    setNotice({ type: 'loading', message: 'Preparing your final review...' })

    try {
      const data = await requestApi(`/public/buyer-forms/${encodeURIComponent(token || '')}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientProfile: clientForm, privacyConsent, website }),
        redirectOnUnavailable: false,
        doubleCheck: {
          type: 'buyer-form',
          variant: 'submission',
          data: { clientProfile: clientForm, privacyConsent },
          title: 'Review Buyer Information',
          confirmLabel: 'Confirm & Submit Buyer Information',
          description: 'Nothing has been submitted yet. Double-check the buyer profile and privacy consent before sending it to D&C Prime Realty.',
        },
      })
      setSubmitted(data.data || { unitId: formInfo?.unitId })
      setNotice(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setNotice(getDoubleCheckNotice(error, 'Your buyer information could not be submitted.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="dc-buyer-form-theme min-h-screen bg-[#f5f3ee] px-4 py-10 sm:py-16">
        <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-[#ded8c9] bg-white shadow-[0_18px_50px_rgba(17,19,24,0.10)]">
          <div className="border-b-[3px] border-[#c99a22] bg-[#05070d] px-6 py-7 text-center">
            <img
              src={BRAND_LOGO}
              alt="D&C Prime Realty"
              className="mx-auto h-auto w-[230px] sm:w-[270px]"
            />
          </div>

          <div className="p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fbf7ea] text-[#9a741d]">
              <FiCheckCircle className="h-8 w-8" />
            </div>

            <p className="mt-6 text-[11px] font-black uppercase tracking-[0.18em] text-[#9a741d]">
              Submission Received
            </p>

            <h1 className="mt-2 text-2xl font-black text-[#17130a]">
              Buyer information submitted
            </h1>

            <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-6 text-[#716b5f]">
              Your information for Unit{' '}
              <strong className="text-[#17130a]">
                {submitted.unitId || formInfo?.unitId || '-'}
              </strong>{' '}
              was received. The unit is temporarily held while D&C Prime Realty reviews the document checklist and payment terms.
            </p>

            <div className="mt-6 rounded-2xl border border-[#e5d49e] bg-[#fbf7ea] px-5 py-4 text-left">
              <p className="text-xs font-black uppercase tracking-wide text-[#8b6a1b]">
                What happens next
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#5f5748]">
                This is not the final reservation confirmation. D&C Prime Realty will review your information and contact you regarding the document checklist, payment terms, and final reservation confirmation.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="dc-buyer-form-theme min-h-screen bg-[#f5f3ee] px-3 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-3xl border border-[#ded8c9] bg-white shadow-[0_12px_40px_rgba(17,19,24,0.08)]">
          <div className="relative overflow-hidden bg-[#05070d] px-6 py-7 text-white sm:px-8 sm:py-8">
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[#c99a22]" />

            <div className="relative">
              <img
                src={BRAND_LOGO}
                alt="D&C Prime Realty"
                className="h-auto w-[230px] sm:w-[290px]"
              />

              <div className="mt-7">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#d8b85a]">
                  Buyer Information & Reservation Review
                </p>

                <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Buyer Information Form
                </h1>

                <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[#d0cec8]">
                  Complete the Client Profile information used for the Offer to Buy. Document requirements and payment terms will be reviewed by D&C Prime Realty after submission.
                </p>
              </div>
            </div>
          </div>

          {formInfo ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-7">
              <div className="rounded-2xl border border-[#e5d49e] bg-[#fbf7ea] p-5 sm:col-span-2 lg:col-span-1">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#8b6a1b]">
                  <FiMapPin /> Project
                </p>
                <p className="mt-2 text-base font-black text-[#17130a]">{formInfo.projectName}</p>
                <p className="mt-1 text-xs font-semibold text-[#716b5f]">{formInfo.projectLocation || 'Project location'}</p>
              </div>

              {unitSummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#e4ded0] bg-[#faf9f6] p-5">
                  <p className="text-[11px] font-black uppercase tracking-wide text-[#8b8375]">{item.label}</p>
                  <p className="mt-2 text-base font-black text-[#17130a]">{item.value}</p>
                </div>
              ))}

              <div className="rounded-2xl border border-[#e5d49e] bg-[#fffaf0] p-5 sm:col-span-2 lg:col-span-3">
                <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[#8b6a1b]">
                  <FiClock /> Link Expiry
                </p>
                <p className="mt-1.5 text-sm font-bold text-[#5f4b1c]">
                  Please submit your information before {formatDateTime(formInfo.expiresAt)}.
                </p>
              </div>
            </div>
          ) : null}
        </header>

        {notice ? <StatusAlert type={notice.type} message={notice.message} /> : null}

        {formInfo ? (
          <form onSubmit={submit} className="space-y-5">
            <ReserveClientProfileModal
              clientForm={clientForm}
              setClientForm={setClientForm}
              hasSecondBuyer={hasSecondBuyer}
              updateBuyerType={updateBuyerType}
              invalidField={invalidField}
              onFieldChange={(field) => {
                if (invalidField === field) setInvalidField('')
                if (notice?.type === 'error') setNotice(null)
              }}
              title="Buyer Profile"
              description="Enter your personal and work or business information. Fields marked * are required."
              stepLabel="Public form"
            />

            <section className="rounded-2xl border border-[#e4ded0] bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fbf7ea] text-[#8b6a1b]">
                  <FiFileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-[#17130a]">Privacy Consent</h2>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#716b5f]">
                    Your information will be used to review this property purchase and prepare the Offer to Buy and Buyer Profile records. It will not complete payment terms or the final reservation by itself.
                  </p>
                </div>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#e4ded0] bg-[#faf9f6] p-4 transition hover:border-[#d8c06a] hover:bg-[#fbf7ea]">
                <input
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(event) => setPrivacyConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#c99a22]"
                />
                <span className="text-sm font-semibold leading-6 text-[#514d44]">
                  I confirm that the information I entered is correct and I consent to D&C Prime Realty processing it for this property inquiry and reservation review.
                </span>
              </label>

              <label className="hidden" aria-hidden="true">
                Website
                <input tabIndex="-1" autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
              </label>

              <div className="mt-5 flex flex-col gap-4 border-t border-[#ece7dc] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex max-w-3xl items-start gap-2 text-xs font-semibold leading-5 text-[#716b5f]">
                  <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a741d]" />
                  After submission, the unit will be temporarily held for admin review. You will still need final payment terms and reservation confirmation.
                </p>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#c99a22] px-7 text-sm font-black text-[#05070d] shadow-lg shadow-[#c99a22]/20 transition hover:bg-[#b8891f] focus:outline-none focus:ring-4 focus:ring-[#c99a22]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheckCircle className="h-4 w-4" />}
                  {isSubmitting ? 'Opening Review...' : 'Proceed to Final Review'}
                </button>
              </div>
            </section>
          </form>
        ) : null}

        <footer className="pb-4 pt-1 text-center text-[11px] font-semibold text-[#8b8375]">
          D&C Prime Realty · Buyer Information & Reservation Review
        </footer>
      </div>
    </main>
  )
}

export default BuyerForm
