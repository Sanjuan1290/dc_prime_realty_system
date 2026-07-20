import { useEffect, useMemo, useState } from 'react'
import { FiAlertCircle, FiCheckCircle, FiClock, FiFileText, FiLoader, FiMapPin } from 'react-icons/fi'
import { useParams } from 'react-router-dom'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReserveClientProfileModal from '../../components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveClientProfileModal'
import { getInitialClientForm, money } from '../../components/Lot_Projects/ListingProfileComponents/ReserveListingModal/reserveUtils'
import { getBuyerProfileValidationError } from '../../utils/buyerProfileValidation'

const apiUrl = (path) => `${import.meta.env.VITE_API_URL}${path}`

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
        const response = await fetch(apiUrl(`/public/buyer-forms/${encodeURIComponent(token || '')}`), {
          headers: { Accept: 'application/json' },
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || 'This buyer form could not be loaded.')
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
    { label: 'TCP', value: money(formInfo.tcp) },
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
    setNotice({ type: 'loading', message: 'Submitting your buyer information...' })

    try {
      const response = await fetch(apiUrl(`/public/buyer-forms/${encodeURIComponent(token || '')}/submit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientProfile: clientForm, privacyConsent, website }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (data.field) setInvalidField(data.field)
        throw new Error(data.message || 'Your buyer information could not be submitted.')
      }
      setSubmitted(data.data || { unitId: formInfo?.unitId })
      setNotice(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'Your buyer information could not be submitted.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <FiCheckCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-950">Buyer information submitted</h1>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            Your information for Unit {submitted.unitId || formInfo?.unitId || '-'} was received. The unit is temporarily held while D&C Prime Realty reviews the document checklist and payment terms.
          </p>
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">
            This is not the final reservation confirmation. D&C Prime Realty will contact you after admin review.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-6 sm:px-5 sm:py-10">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">D&C Prime Realty</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Buyer Information Form</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-300">
              Complete the Client Profile information used for the Offer to Buy. Document requirements and payment terms will be reviewed by the admin later.
            </p>
          </div>

          {formInfo ? (
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-7">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:col-span-2 lg:col-span-1">
                <p className="flex items-center gap-2 text-xs font-black uppercase text-blue-700"><FiMapPin /> Project</p>
                <p className="mt-2 text-base font-black text-slate-950">{formInfo.projectName}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{formInfo.projectLocation || 'Project location'}</p>
              </div>
              {unitSummary.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">{item.label}</p>
                  <p className="mt-2 text-base font-black text-slate-950">{item.value}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:col-span-2 lg:col-span-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase text-amber-800"><FiClock /> Link expiry</p>
                <p className="mt-1 text-sm font-semibold text-amber-900">Submit before {formatDateTime(formInfo.expiresAt)}.</p>
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

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <FiFileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-950">Privacy consent</h2>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                    Your information will be used to review this property purchase and prepare the Offer to Buy and Buyer Profile records. It will not complete payment terms or the final reservation by itself.
                  </p>
                </div>
              </div>

              <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <input type="checkbox" checked={privacyConsent} onChange={(event) => setPrivacyConsent(event.target.checked)} className="mt-0.5 h-4 w-4" />
                <span className="text-sm font-semibold leading-6 text-slate-700">
                  I confirm that the information I entered is correct and I consent to D&C Prime Realty processing it for this property inquiry and reservation review.
                </span>
              </label>

              <label className="hidden" aria-hidden="true">
                Website
                <input tabIndex="-1" autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
              </label>

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2 text-xs font-semibold leading-5 text-slate-500">
                  <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  After submission, the unit will be temporarily held for admin review. You will still need final payment terms and reservation confirmation.
                </p>
                <button type="submit" disabled={isSubmitting} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiCheckCircle className="h-4 w-4" />}
                  {isSubmitting ? 'Submitting...' : 'Review & Submit Information'}
                </button>
              </div>
            </section>
          </form>
        ) : null}
      </div>
    </main>
  )
}

export default BuyerForm


