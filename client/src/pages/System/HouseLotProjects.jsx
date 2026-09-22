import { FiHome } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import ReadOnlyNotice from '../../components/Shared/ReadOnlyNotice'

const HouseLotProjects = () => (
  <main className="flex flex-col gap-6">
    <PageHeader title="House & Lot Projects" description="House and lot project workspaces will appear here when the module is added." icon={FiHome} />
    <ReadOnlyNotice message="This module is visible in the Admin Layout, but no House & Lot Project records or database tables exist yet." />
    <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
      <FiHome className="mx-auto h-12 w-12 text-slate-300" />
      <h2 className="mt-4 text-xl font-black text-slate-900">No House & Lot Projects</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">The menu and route are ready. The project type can be connected later without changing the Admin Layout.</p>
    </section>
  </main>
)

export default HouseLotProjects


