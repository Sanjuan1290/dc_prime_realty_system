import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin and Super Admin creation uses server-generated emailed credentials', () => {
  const controller = read('server/controllers/System/users.controllers.js');
  const modal = read('client/src/components/System/userComponents/CreateUserModal.jsx');
  assert.match(controller, /generateTemporaryPassword/);
  assert.match(controller, /crypto\.randomInt/);
  assert.match(controller, /sendTemporaryLoginCredentials/);
  assert.match(controller, /must_change_password/);
  assert.match(controller, /auth_version = COALESCE\(auth_version, 0\) \+ 1/);
  assert.match(controller, /existing password and sessions were left unchanged/i);
  assert.doesNotMatch(modal, /value=\{form\.password\}/);
  assert.match(modal, /Secure Login Setup/);
});

test('simplified employee module generates department barcodes and keeps only the required employment fields', () => {
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx');
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  assert.match(modal, /Next: Generate Barcode/);
  assert.match(modal, /Code128Barcode/);
  assert.match(modal, /generated from the selected department/);
  assert.doesNotMatch(modal, /BarcodeScanner|Scan Employee Barcode|Scan Barcode/);
  assert.match(modal, /Select Department/);
  assert.match(modal, /Full Time/);
  assert.match(modal, /Probationary/);
  assert.match(modal, /Part Time/);
  assert.doesNotMatch(modal, /Monthly Salary|Work Days|Shift Start|Cash Advance/);
  assert.match(controller, /employee_barcode_sequences/);
  assert.match(controller, /allocateEmployeeBarcode/);
  assert.match(controller, /MAX_DEPARTMENT_BARCODE_NUMBER = 999/);
  assert.doesNotMatch(controller, /monthly_salary/);
});

test('attendance scanner enforces time-in before time-out and supports automatic timeout', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js');
  const job = read('server/jobs/attendanceAutoTimeout.job.js');
  assert.match(controller, /No Time In record was found/);
  assert.match(controller, /TIME_IN_REQUIRED/);
  assert.match(controller, /already timed in today/);
  assert.match(controller, /ALREADY_TIMED_IN/);
  assert.match(controller, /ALREADY_TIMED_OUT/);
  assert.match(controller, /already timed out today/);
  assert.match(controller, /time_in_source = 'barcode'/);
  assert.match(controller, /time_out_source = 'barcode'/);
  assert.match(job, /time_out_source = 'automatic'/);
  assert.match(job, /attendance_default_time_out|defaultTimeOut/);
  assert.match(job, /a\.actual_time_in <= \?/);
  assert.match(controller, /Time Out cannot be earlier than Time In/);
});

test('attendance supports admin corrections, day classification and company events', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js');
  const page = read('client/src/pages/System/Attendance.jsx');
  const eventModal = read('client/src/components/System/employeeComponents/AttendanceEventModal.jsx');
  assert.match(controller, /employee_attendance_corrections/);
  assert.match(controller, /A reason is required when correcting attendance/);
  assert.match(controller, /attendance_day_settings/);
  assert.match(controller, /double_pay/);
  assert.match(controller, /attendance_events/);
  assert.match(controller, /getAttendanceCalendar/);
  assert.match(page, /Attendance Calendar/);
  assert.match(page, /Date Details/);
  assert.match(page, /Company Event/);
  assert.match(page, /Manual Attendance/);
  assert.doesNotMatch(page, /Company Events ·/);
  assert.doesNotMatch(page, />Add Event</);
  assert.match(eventModal, /Select All Active/);
  assert.match(eventModal, /Attendance Record Only/);
});


test('employee barcode rendering and attendance camera scanning remain separate with a local Code 128 fallback', () => {
  const barcode = read('client/src/components/System/employeeComponents/Code128Barcode.jsx');
  const scanner = read('client/src/components/System/employeeComponents/BarcodeScanner.jsx');
  const attendance = read('client/src/pages/System/Attendance.jsx');
  const employees = read('client/src/pages/System/Employees.jsx');
  assert.match(barcode, /buildCode128Geometry/);
  assert.match(barcode, /Print Barcode/);
  assert.match(scanner, /getUserMedia/);
  assert.match(scanner, /decodeCode128FromImageData/);
  assert.match(scanner, /built-in Code 128 scanner/);
  assert.match(attendance, /Scan with Camera/);
  assert.match(attendance, /<BarcodeScanner/);
  assert.doesNotMatch(employees, /BarcodeScanner/);
});

test('Super Admin receives real Employees and Attendance routes while cash advances and house-lot UI are hidden', () => {
  const app = read('client/src/App.jsx');
  const layout = read('client/src/layout/SystemLayout.jsx');
  const projects = read('client/src/pages/System/Projects.jsx');
  const dashboard = read('client/src/pages/System/Dashboard.jsx');
  assert.match(app, /path="employees" element=\{<Employees \/>\}/);
  assert.match(app, /path="attendance" element=\{<Attendance \/>\}/);
  assert.doesNotMatch(app, /path="cash-advances"/);
  assert.doesNotMatch(layout, /Cash Advances/);
  assert.doesNotMatch(layout, /House & Lot Projects/);
  assert.doesNotMatch(projects, /Add House & Lot Project/);
  assert.doesNotMatch(dashboard, /label: 'House & Lot Projects'/);
});
