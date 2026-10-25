import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read=(p)=>readFileSync(resolve(root,p),'utf8')
const modal=read('client/src/components/Shared/ActionPanelModal.jsx')
const css=read('client/src/components/Shared/actionPanelMotion.css')
const employee=read('client/src/pages/System/Employees.jsx')
const salary=read('client/src/pages/System/EmployeeSalary.jsx')

test('both action menus share the same accessible, styled dialog', () => {
  assert.match(employee, /<ActionPanelModal[\s\S]*title="Employee Actions"/)
  assert.match(salary, /<ActionPanelModal[\s\S]*title="Salary Actions"/)
  assert.match(modal, /role="dialog" aria-modal="true"/)
  assert.match(modal, /aria-label={ariaLabel \|\| title}/)
  assert.match(modal, /event.key === 'Escape'/)
  assert.match(modal, /event.key !== 'Tab'/)
  assert.match(modal, /closeButton.current\?\.focus\(\)/)
  assert.match(modal, /previousFocus\?\.focus\?\.\(\)/)
})
test('animation has enter and exit states and respects reduced motion', () => {
  assert.match(modal, /dc-action-overlay--out/)
  assert.match(modal, /dc-action-panel--in/)
  assert.match(css, /@keyframes dcActionBackdropIn/)
  assert.match(css, /@keyframes dcActionPanelOut/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(modal, /motion-reduce:transition-none/)
})
test('employee actions retain original permission guards and callbacks', () => {
  for (const action of ['barcode','employment','salary','compensation']) assert.match(employee, new RegExp(`action === '${action}'`))
  assert.match(employee, /canManageCompensation && canCreateEmploymentChange/)
  assert.match(employee, /canViewEmploymentHistory/)
  assert.match(employee, /canViewPayrollHistory/)
  assert.match(employee, /runOtherAction\(action.value, actionsEmployee\)/)
})
test('salary actions retain original status and role protection', () => {
  assert.match(salary, /canRecalculate && actionsPayroll.payroll_status === 'draft'/)
  assert.match(salary, /canFinalize && actionsPayroll.payroll_status === 'draft'/)
  assert.match(salary, /actionsPayroll.payroll_status === 'released' && canPrintReceipt/)
  assert.match(salary, /canViewPayrollHistory/)
  assert.match(salary, /recalcMutation.mutate\(actionsPayroll.employee_payroll_id\)/)
})
test('action cards include explanatory text and visual focus states', () => {
  assert.match(modal, /description/)
  assert.match(modal, /focus-visible:outline/)
  assert.match(modal, /group-hover:translate-x-0.5/)
  assert.match(employee, /Download the barcode image/)
  assert.match(salary, /Review hours and deductions/)
})
