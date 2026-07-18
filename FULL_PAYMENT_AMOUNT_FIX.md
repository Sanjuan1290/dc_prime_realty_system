# Full Payment Amount Fix

## Updated behavior

- Selecting **Full Payment** automatically displays the complete unpaid SOA total in **Amount**.
- The Amount field becomes read-only for Full Payment.
- Full Payment does not require one preferred SOA row.
- The payment is allocated from the oldest unpaid SOA row through the remaining rows until the account is cleared.
- Outstanding interest and penalties already included in the SOA are part of the full-payment total.
- Editing a payment adds the existing payment amount back before calculating the replacement full-payment amount.
- The server rejects a Full Payment request when its amount differs from the refreshed unpaid SOA balance.

## Files changed

- `client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx`
- `client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/paymentAmountUtils.js`
- `server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js`
- `server/controllers/Lot_Projects/_shared/lotProject.shared.js`
- `server/tests/fullPaymentAmount.test.js`

## Validation

- Server tests: 94 passed.
- Full Payment regression tests: 4 passed.
- Changed client files: ESLint passed.
- Client production build: passed.
- Changed server files: syntax checks passed.

No database migration is required.
