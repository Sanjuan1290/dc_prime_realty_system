import { FiSettings } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
const Settings = () => <main className="flex flex-col gap-6"><PageHeader title="Bailen Settings" description="Project settings will be added after the main listing, payments, documents, and commission workflow." icon={FiSettings} /><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-slate-950">No notification settings yet</h2><p className="mt-2 text-sm font-semibold text-slate-500">Notifications are intentionally left out for now.</p></section></main>
export default Settings
