# Print All Acknowledgement Receipts

## Behaviour

The Income Range tab still lists released commission income using each stage's actual release date.

`Print All Receipts` now prints the existing **Acknowledgement Receipt for Fund Release** document repeatedly:

- One generated receipt per A4 portrait page.
- The same payee, description, date, total, signature, witness, and reference details used by the single receipt print page.
- All matching pages are opened in one print window and can be saved as one PDF.
- Released income entries without a generated receipt remain visible in the range list but are excluded from Print All. A warning shows the excluded count.

## Matching rule

A generated receipt is included when at least one released commission entry in the loaded date range points to that receipt. Voided receipts are excluded.

## Database

No database migration is required.

## Validation

- Changed client files passed ESLint.
- Client production build passed.
- Server regression suite passed: 90 tests.
- Static wiring checks confirmed the range page imports and repeats the single-receipt layout.

