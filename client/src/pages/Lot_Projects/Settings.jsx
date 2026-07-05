import { useState } from 'react'
import { FiEdit2, FiSettings } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import EditSettingsModal from '../../components/Lot_Projects/SettingsComponents/EditSettingsModal/EditSettingsModal'

const initialSettings = {
  releaseDayOne: '7',
  releaseDayTwo: '22',
  reservationContactName: 'D&C Prime Realty',
  reservationContactEmail: 'dcprimerealty@gmail.com',
  reservationContactNumber: '0912-345-6789',
  companyName: 'D&C Prime Realty',
  companyEmail: 'dcprimerealty@gmail.com',
  companyContactNumber: '(046) 866-0616',
}

const InfoItem = ({ label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-1 text-sm font-black text-slate-950">{value || '-'}</p>
  </div>
)

const SettingCard = ({ title, description, children }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div>
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-500">
        {description}
      </p>
    </div>

    <div className="mt-5">{children}</div>
  </section>
)

const Settings = () => {
  const [settings, setSettings] = useState(initialSettings)
  const [showEdit, setShowEdit] = useState(false)
  const [alert, setAlert] = useState(null)

  const handleSaveSettings = (updatedSettings) => {
    setSettings(updatedSettings)
    setShowEdit(false)

    setAlert({
      type: 'success',
      message: 'Settings saved successfully in mock mode.',
    })
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      ) : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Bailen Settings"
          description="Manage commission release days, reservation contact, and company information."
          icon={FiSettings}
        />

        <button
          type="button"
          onClick={() => {
            setShowEdit(true)
            setAlert({
              type: 'info',
              message: 'Edit Settings opened.',
            })
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <FiEdit2 className="h-4 w-4" />
          Edit Settings
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <SettingCard
          title="Commission Release Days"
          description="Allowed days when Super Admin can release eligible commissions."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem
              label="First Release Day"
              value={`${settings.releaseDayOne}th of the month`}
            />
            <InfoItem
              label="Second Release Day"
              value={`${settings.releaseDayTwo}nd of the month`}
            />
          </div>
        </SettingCard>

        <SettingCard
          title="Reservation Contact"
          description="Default assistance contact shown for reservation-related concerns."
        >
          <div className="grid gap-3">
            <InfoItem label="Name" value={settings.reservationContactName} />
            <InfoItem label="Email" value={settings.reservationContactEmail} />
            <InfoItem label="Contact Number" value={settings.reservationContactNumber} />
          </div>
        </SettingCard>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-950">
            Company Information
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Used for printouts, headers, and system identity.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <InfoItem label="Company Name" value={settings.companyName} />
          <InfoItem label="Company Email" value={settings.companyEmail} />
          <InfoItem
            label="Company Contact Number"
            value={settings.companyContactNumber}
          />
        </div>
      </section>

      {showEdit ? (
        <EditSettingsModal
          settings={settings}
          onClose={() => {
            setShowEdit(false)
            setAlert({
              type: 'info',
              message: 'Edit cancelled.',
            })
          }}
          onSave={handleSaveSettings}
        />
      ) : null}
    </main>
  )
}

export default Settings