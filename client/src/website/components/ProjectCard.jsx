import { FiArrowRight, FiCalendar, FiCheck, FiCheckCircle, FiClock, FiHeart, FiMapPin, FiSquare } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useProjectPreferences } from '../context/ProjectPreferencesContext'

const ProjectCard = ({ project, compareSelected = false, onCompare }) => {
  const comingSoon = project.status === 'coming_soon'
  const { isSaved, toggleSaved } = useProjectPreferences()
  const saved = isSaved(project.slug)

  return (
    <article className="group overflow-hidden rounded-[20px] border border-[#ded9ce] bg-white shadow-[0_12px_38px_rgba(44,36,20,0.07)]">
      <div className="relative h-[235px] overflow-hidden sm:h-[270px]">
        <img src={project.coverImage} alt={`${project.name} in ${project.location}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
        <span className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] shadow ${comingSoon ? 'text-[#a66a16]' : 'text-[#356447]'}`}>
          {comingSoon ? <FiClock /> : <FiCheckCircle />} {project.statusLabel}
        </span>
        <button type="button" onClick={() => toggleSaved(project.slug)} className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition ${saved ? 'border-[#d5b255] bg-[#f4d77f] text-[#17130a]' : 'border-white/35 bg-black/25 text-white hover:bg-black/45'}`} aria-label={saved ? `Remove ${project.name} from saved projects` : `Save ${project.name}`} title={saved ? 'Saved' : 'Save project'}>
          <FiHeart className={saved ? 'fill-current' : ''} />
        </button>
        <div className="absolute bottom-4 left-4 right-4 text-white">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-[#ead58e]"><FiMapPin /> {project.location}</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <img src={project.logo} alt={`${project.name} logo`} className="h-12 w-full object-contain object-left" />
        <div className="mt-4 flex flex-wrap gap-2">
          {project.features?.slice(0, 3).map((feature) => <span key={feature} className="rounded-full bg-[#f4f1ea] px-2.5 py-1 text-[10px] font-semibold text-[#69645c]">{feature}</span>)}
        </div>
        <p className="mt-4 line-clamp-3 text-[13px] leading-6 text-[#666158]">{project.overview}</p>
        {onCompare ? <button type="button" onClick={() => onCompare(project.slug)} className={`mt-4 inline-flex items-center gap-2 text-[12px] font-semibold ${compareSelected ? 'text-[#356447]' : 'text-[#806014] hover:underline'}`}>{compareSelected ? <FiCheck /> : <FiSquare />} {compareSelected ? 'Added to comparison' : 'Add to comparison'}</button> : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link to={`/properties/${project.slug}`} className="website-button-dark flex-1">View project <FiArrowRight /></Link>
          {!comingSoon ? <Link to={`/properties/${project.slug}#book-tripping`} className="website-button-light flex-1"><FiCalendar /> Book a Tripping</Link> : null}
        </div>
      </div>
    </article>
  )
}

export default ProjectCard

