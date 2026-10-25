import React from 'react'

// The same five details are used for seller Proof of Income and Network Profit acknowledgments.
export const todayInManila = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

export const emptyReleaseReceipt = () => ({
  bankName: '', accountNumber: '', receiptDate: todayInManila(), referenceNumber: '', witnessName: '',
})

export const validateReleaseReceipt = (details, releaseDate, paymentMethod = 'bank_transfer') => {
  const method = String(paymentMethod || '').toLowerCase()
  const cash = method === 'cash'
  const bank = String(details?.bankName || '').trim()
  const account = String(details?.accountNumber || '').trim()
  const date = String(details?.receiptDate || '')
  const reference = String(details?.referenceNumber || '').trim()
  const witness = String(details?.witnessName || '').trim()
  if (!cash && (!bank || !account)) return 'Complete Bank / Provider and Account No. for this payment method.'
  if (!reference || !witness) return 'Complete Receipt / Reference No. and Witness Name.'
  if (bank.length > 150 || account.length > 100 || reference.length > 120 || witness.length > 255) return 'One or more receipt details exceed the allowed length.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`))) return 'Choose a valid receipt date.'
  if (date > todayInManila()) return 'Receipt date cannot be in the future.'
  if (releaseDate && date < releaseDate) return 'Receipt date cannot be earlier than the actual release date.'
  return ''
}

const inputClass = 'mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'
export default function ReleaseReceiptFields({ value, onChange, disabled = false, releaseDate, title = 'Receipt Details', paymentMethod = 'bank_transfer' }) {
  const cash = paymentMethod === 'cash'
  const bankLabel = paymentMethod === 'check' ? 'Issuing Bank' : 'Bank / Payment Provider'
  const accountLabel = paymentMethod === 'check' ? 'Account No. on Check' : 'Account No. / Wallet No.'
  const referenceLabel = cash ? 'Cash Receipt / Voucher No.' : paymentMethod === 'check' ? 'Check No. / Reference No.' : 'Reference No.'
  const set = (key, next) => onChange({ ...value, [key]: next })
  const field = (label, key, placeholder, length) => <label className="block text-xs font-black uppercase text-slate-600" key={key}>{label}
    <input className={inputClass} type="text" required maxLength={length} placeholder={placeholder} disabled={disabled}
      value={value[key]} onChange={(event) => set(key, event.target.value)} />
  </label>
  return <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
    <h4 className="text-sm font-black text-blue-950">{title}</h4>
    <p className="mt-1 text-xs font-semibold text-slate-600">Recorded with this milestone at release. The document remains available in Accredited Sellers for printing and signed-copy management.</p>
    {cash && <p className="mt-2 text-xs font-semibold text-slate-600">Cash release: bank and account details are not applicable. Enter the actual cash receipt or voucher number.</p>}
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {!cash && field(bankLabel, 'bankName', paymentMethod === 'check' ? 'Issuing bank' : 'BPI / BDO / GCash', 150)}
      {!cash && field(accountLabel, 'accountNumber', paymentMethod === 'check' ? 'Account number on check' : 'Receiving account or wallet number', 100)}
      <label className="block text-xs font-black uppercase text-slate-600">Receipt Date
        <input className={inputClass} type="date" required disabled={disabled} value={value.receiptDate}
          min={releaseDate || undefined} max={todayInManila()} onChange={(event) => set('receiptDate', event.target.value)}/>
      </label>
      {field(referenceLabel, 'referenceNumber', cash ? 'Enter the actual cash receipt or voucher number' : paymentMethod === 'check' ? 'Check number / payment reference' : 'Transfer / transaction reference', 120)}
      {field('Witness Name', 'witnessName', 'Printed witness name', 255)}
    </div>
  </section>
}


