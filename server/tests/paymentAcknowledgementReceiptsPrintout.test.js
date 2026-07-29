import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dirname, '..', '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('listing printouts expose one acknowledgement receipt page per verified payment', () => {
  const printouts = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/Printouts.jsx')
  const listingProfile = read('client/src/pages/Lot_Projects/ListingProfile.jsx')
  const app = read('client/src/App.jsx')
  const receiptPage = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PaymentAcknowledgementReceiptsPrintPage.jsx')

  assert.match(printouts, /title:\s*'Acknowledgement Receipts'/)
  assert.match(printouts, /path:\s*'acknowledgement-receipts'/)
  assert.match(printouts, /payments,\s*documents/)
  assert.match(listingProfile, /<Printouts[\s\S]*project=\{project\}[\s\S]*payments=\{payments\}/)
  assert.match(app, /PaymentAcknowledgementReceiptsPrintPage/)
  assert.match(app, /printouts\/acknowledgement-receipts/)
  assert.match(receiptPage, /verifiedPayments\.map\(\(payment\)/)
  assert.match(receiptPage, /className="print-page[^"]*h-\[297mm\][^"]*w-\[210mm\]/)
  assert.match(receiptPage, /ACKNOWLEDGEMENT RECEIPT/)
  assert.match(receiptPage, /REFERENCE NUMBER/)
  assert.match(receiptPage, /amountToWords\(paymentAmount\)/)
  assert.match(receiptPage, /<p>Broker:<\/p>[\s\S]*&nbsp;[\s\S]*PRC No\. __________________/)
  assert.match(receiptPage, /&nbsp;<\/div>[\s\S]*<p className="mt-2">Witness<\/p>/)
  assert.doesNotMatch(receiptPage, /getBrokerDetails|payment\.verifiedBy/)
})
