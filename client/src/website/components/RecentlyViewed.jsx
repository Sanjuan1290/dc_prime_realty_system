import { FiClock, FiMapPin } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { projects } from '../data/projects'
import { useProjectPreferences } from '../context/ProjectPreferencesContext'

const RecentlyViewed = () => {
  const { recentSlugs } = useProjectPreferences()
  const recentProjects = recentSlugs.map((slug) => projects.find((project) => project.slug === slug)).filter(Boolean).slice(0, 3)
  if (!recentProjects.length) return null

  return (
    <div className="rounded-[18px] border border-[#ded9ce] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2"><FiClock className="text-[#806014]" /><h2 className="text-[20px]">Recently viewed</h2></div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {recentProjects.map((project) => <Link key={project.slug} to={`/properties/${project.slug}`} className="flex items-center gap-3 rounded-xl border border-[#e6e0d6] bg-[#faf9f6] p-3 hover:border-[#b99a50]"><img src={project.coverImage} alt="" className="h-14 w-16 rounded-lg object-cover" /><span className="min-w-0"><span className="block truncate text-[12px] font-semibold text-[#2e2a24]">{project.name}</span><span className="mt-1 flex items-center gap-1 truncate text-[10px] text-[#777168]"><FiMapPin /> {project.shortName}</span></span></Link>)}
      </div>
    </div>
  )
}

export default RecentlyViewed
