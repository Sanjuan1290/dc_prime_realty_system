import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiClock, FiSave, FiSearch, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../utils/useFetch'

const inputClass =
  'h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50'

const normalizeTime = (value) =>
  value ? String(value).slice(0, 5) : ''

const getEmployeeLabel = (employee) => {
  if (!employee) return ''

  return `${employee.full_name || ''} · ${employee.employee_code || ''}${employee.barcode_code ? ` · ${employee.barcode_code}` : ''}`
}

const AttendanceCorrectionModal = ({
  record,
  employees = [],
  defaultDate,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(record?.employee_attendance_id)

  const queryClient = useQueryClient()

  const [notice, setNotice] = useState(null)

  const [form, setForm] = useState({
    employee_id: String(record?.employee_id || ''),
    attendance_date:
      record?.attendance_date?.slice?.(0, 10) ||
      defaultDate ||
      '',
    actual_time_in: normalizeTime(record?.actual_time_in),
    actual_time_out: normalizeTime(record?.actual_time_out),
    reason: '',
  })

  const initialEmployee = useMemo(
    () =>
      employees.find(
        (item) =>
          Number(item.employee_id) ===
          Number(record?.employee_id)
      ) || null,
    [employees, record?.employee_id]
  )

  const [employeeSearch, setEmployeeSearch] = useState(
    isEdit ? getEmployeeLabel(initialEmployee) : ''
  )

  const [showEmployeeResults, setShowEmployeeResults] =
    useState(false)

  const employee = useMemo(
    () =>
      employees.find(
        (item) =>
          Number(item.employee_id) ===
          Number(form.employee_id)
      ) || null,
    [employees, form.employee_id]
  )

  const filteredEmployees = useMemo(() => {
    const keyword = employeeSearch.trim().toLowerCase()

    const results = employees.filter((item) => {
      if (!keyword) return true

      const fullName = String(
        item.full_name || ''
      ).toLowerCase()

      const employeeCode = String(item.employee_code || '').toLowerCase()
      const attendanceBarcode = String(item.barcode_code || '').toLowerCase()

      return (
        fullName.includes(keyword) ||
        employeeCode.includes(keyword) ||
        attendanceBarcode.includes(keyword)
      )
    })

    return results.slice(0, 10)
  }, [employees, employeeSearch])

  const update = (field, value) => {
    setNotice(null)

    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const selectEmployee = (selectedEmployee) => {
    setNotice(null)

    setForm((current) => ({
      ...current,
      employee_id: String(selectedEmployee.employee_id),
    }))

    setEmployeeSearch(
      getEmployeeLabel(selectedEmployee)
    )

    setShowEmployeeResults(false)
  }

  const changeEmployeeSearch = (value) => {
    setNotice(null)
    setEmployeeSearch(value)
    setShowEmployeeResults(true)

    /*
     * Clear the selected employee whenever the admin types
     * again so an old employee cannot accidentally be saved.
     */
    setForm((current) => ({
      ...current,
      employee_id: '',
    }))
  }

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? useFetchPut(
            `/attendance/${record.employee_attendance_id}/correction`,
            {
              actual_time_in:
                form.actual_time_in || null,

              actual_time_out:
                form.actual_time_out || null,

              reason: form.reason,
            },
            {
              confirmationHandled: 'compact',
            }
          )
        : useFetchPost(
            '/attendance/manual',
            {
              employee_id: Number(form.employee_id),
              attendance_date: form.attendance_date,

              actual_time_in:
                form.actual_time_in || null,

              actual_time_out:
                form.actual_time_out || null,

              reason: form.reason,
            },
            {
              confirmationHandled: 'compact',
            }
          ),

    onMutate: () =>
      setNotice({
        type: 'loading',

        message: isEdit
          ? 'Saving attendance correction...'
          : 'Adding manual attendance...',
      }),

    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ['attendance'],
      })

      onSaved?.(
        result?.message || 'Attendance saved.'
      )

      onClose?.()
    },

    onError: (error) =>
      setNotice({
        type: 'error',

        message:
          error?.message ||
          'Failed to save attendance.',
      }),
  })

  const submit = (event) => {
    event.preventDefault()

    if (
      !isEdit &&
      (!form.employee_id || !form.attendance_date)
    ) {
      setNotice({
        type: 'warning',
        message:
          'Select an employee and attendance date.',
      })

      return
    }

    if (!form.reason.trim()) {
      setNotice({
        type: 'warning',
        message:
          'Enter a reason for this manual attendance change.',
      })

      return
    }

    if (!isEdit && !form.actual_time_in) {
      setNotice({
        type: 'warning',

        message:
          'Time In is required for manual attendance. Use Company Event when exact times are intentionally not recorded.',
      })

      return
    }

    if (
      isEdit &&
      !record?.attendance_event_id &&
      !form.actual_time_in
    ) {
      setNotice({
        type: 'warning',

        message:
          'Time In is required for non-event attendance records.',
      })

      return
    }

    if (
      !form.actual_time_in &&
      form.actual_time_out
    ) {
      setNotice({
        type: 'warning',

        message:
          'Time Out cannot be saved without a Time In.',
      })

      return
    }

    if (
      form.actual_time_in &&
      form.actual_time_out &&
      form.actual_time_out < form.actual_time_in
    ) {
      setNotice({
        type: 'warning',

        message:
          'Time Out cannot be earlier than Time In.',
      })

      return
    }

    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full max-w-xl overflow-visible rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between rounded-t-3xl border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <FiClock />
            </span>

            <div>
              <h3 className="font-black text-slate-950">
                {isEdit
                  ? 'Correct Attendance'
                  : 'Add Manual Attendance'}
              </h3>

              <p className="text-xs font-semibold text-slate-500">
                Manual changes are recorded in the audit trail.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <FiX />
          </button>
        </header>

        <div className="grid gap-4 p-5">
          {notice ? (
            <StatusAlert
              type={notice.type}
              message={notice.message}
            />
          ) : null}

          {isEdit ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-black text-slate-950">
                {record.full_name}
              </p>

              <p className="text-sm font-semibold text-slate-500">
                {record.employee_code} ·{' '}
                {String(
                  record.attendance_date
                ).slice(0, 10)}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* SEARCHABLE EMPLOYEE */}
              <label className="relative grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  Employee *
                </span>

                <div className="relative">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    autoComplete="off"
                    value={employeeSearch}
                    onChange={(event) =>
                      changeEmployeeSearch(
                        event.target.value
                      )
                    }
                    onFocus={() =>
                      setShowEmployeeResults(true)
                    }
                    onBlur={() => {
                      /*
                       * Small delay allows the employee option
                       * click to finish before closing.
                       */
                      setTimeout(
                        () =>
                          setShowEmployeeResults(false),
                        150
                      )
                    }}
                    placeholder="Search name, employee code, or attendance barcode..."
                    className={`${inputClass} w-full pl-10`}
                  />
                </div>

                {showEmployeeResults ? (
                  <div className="absolute left-0 right-0 top-[76px] z-[100] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {filteredEmployees.length ? (
                      filteredEmployees.map((item) => (
                        <button
                          key={item.employee_id}
                          type="button"
                          onMouseDown={(event) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            selectEmployee(item)
                          }
                          className="flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-blue-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {item.full_name}
                            </p>

                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {item.department || 'No Department'}
                              {' · '}
                              {item.employment_label ||
                                String(
                                  item.employment_type ||
                                    ''
                                ).replace(
                                  '_',
                                  ' '
                                )}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs font-black text-blue-700">
                            {item.employee_code}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-5 text-center">
                        <p className="text-sm font-black text-slate-700">
                          No employee found
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Search using the employee name or barcode code.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </label>

              {/* DATE */}
              <label className="grid gap-2">
                <span className="text-sm font-black text-slate-700">
                  Date *
                </span>

                <input
                  type="date"
                  className={inputClass}
                  value={form.attendance_date}
                  onChange={(event) =>
                    update(
                      'attendance_date',
                      event.target.value
                    )
                  }
                />
              </label>
            </div>
          )}

          {!isEdit && employee ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {employee.full_name}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {employee.department}
                    {' · '}
                    {employee.employment_label ||
                      String(
                        employee.employment_type || ''
                      ).replace('_', ' ')}
                  </p>
                </div>

                <span className="rounded-lg bg-white px-3 py-2 font-mono text-xs font-black text-blue-700">
                  {employee.employee_code}
                </span>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-700">
                Time In
              </span>

              <input
                type="time"
                step="60"
                className={inputClass}
                value={form.actual_time_in}
                onChange={(event) =>
                  update(
                    'actual_time_in',
                    event.target.value
                  )
                }
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-700">
                Time Out
              </span>

              <input
                type="time"
                step="60"
                className={inputClass}
                value={form.actual_time_out}
                onChange={(event) =>
                  update(
                    'actual_time_out',
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-black text-slate-700">
              Reason *
            </span>

            <textarea
              rows={3}
              className="rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              value={form.reason}
              onChange={(event) =>
                update(
                  'reason',
                  event.target.value
                )
              }
              placeholder="Example: Employee forgot to time out after leaving the office."
            />
          </label>
        </div>

        <footer className="flex flex-col-reverse gap-3 rounded-b-3xl border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-60"
          >
            <FiSave />

            {mutation.isPending
              ? 'Saving...'
              : 'Save Attendance'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export default AttendanceCorrectionModal
