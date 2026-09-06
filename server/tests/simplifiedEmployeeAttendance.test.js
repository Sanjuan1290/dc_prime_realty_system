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

test('simplified employee module uses barcode, department and three employment types without salary or schedule form fields', () => {
  const modal = read('client/src/components/System/employeeComponents/EmployeeModal.jsx');
  const controller = read('server/controllers/System/Employees/EmployeesSimple.controller.js');
  assert.match(modal, /Barcode Code/);
  assert.match(modal, /Scan Barcode/);
  assert.match(modal, /Select Department/);
  assert.match(modal, /Full Time/);
  assert.match(modal, /Probationary/);
  assert.match(modal, /Part Time/);
  assert.doesNotMatch(modal, /Monthly Salary|Work Days|Shift Start|Cash Advance/);
  assert.match(controller, /employee_code/);
  assert.doesNotMatch(controller, /monthly_salary/);
});

test('attendance scanner enforces time-in before time-out and supports automatic timeout', () => {
  const controller = read('server/controllers/System/Employees/AttendanceSimple.controller.js');
  const job = read('server/jobs/attendanceAutoTimeout.job.js');
  assert.match(controller, /Time Out not allowed\. No Time In record was found/);
  assert.match(controller, /already timed in today/);
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
  assert.match(page, /Company Event/);
  assert.match(page, /Manual Attendance/);
  assert.match(eventModal, /Select All Active/);
  assert.match(eventModal, /Attendance Record Only/);
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
