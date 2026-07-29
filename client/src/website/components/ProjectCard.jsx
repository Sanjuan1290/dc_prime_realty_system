import { FiArrowRight, FiCalendar, FiCheckCircle, FiMapPin } from 'react-icons/fi'
import { Link } from 'react-router-dom'

const ProjectCard = ({ project }) => (
  <article className="group overflow-hidden rounded-[28px] border border-[#e9dfc9] bg-white shadow-[0_24px_70px_rgba(93,69,14,0.09)]">
    <div className="relative h-[290px] overflow-hidden sm:h-[350px]">
      <img src={project.coverImage} alt={`${project.name} in ${project.location}`} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
      <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#27623a] shadow"><FiCheckCircle /> {project.status}</span>
      <div className="absolute bottom-5 left-5 right-5 text-white">
        <p className="flex items-center gap-2 text-[13px] font-bold text-[#f2dd9e]"><FiMapPin /> {project.location}</p>
        <h3 className="mt-2 text-[30px] font-black tracking-[-0.035em]">{project.name}</h3>
      </div>
    </div>
    <div className="p-6 sm:p-7">
      <p className="text-[14px] leading-7 text-[#665d4b]">{project.overview}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to={`/properties/${project.slug}`} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#17130a] px-5 text-[13px] font-black text-white transition hover:bg-[#9a6d05]">View project <FiArrowRight /></Link>
        <Link to={`/properties/${project.slug}#book-tripping`} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#d9bd70] bg-[#fff9e7] px-5 text-[13px] font-black text-[#76550c] transition hover:bg-[#f8e7af]"><FiCalendar /> Book a Tripping</Link>
      </div>
    </div>
  </article>
)

export default ProjectCard
