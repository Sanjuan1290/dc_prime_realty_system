import { FiHeart, FiTrash2 } from 'react-icons/fi'
import PageHero from '../components/PageHero'
import ProjectCard from '../components/ProjectCard'
import usePageMeta from '../hooks/usePageMeta'
import { projects } from '../data/projects'
import { useProjectPreferences } from '../context/ProjectPreferencesContext'

const SavedProjects = () => {
  const { savedSlugs, clearSaved } = useProjectPreferences()
  const savedProjects = savedSlugs.map((slug) => projects.find((project) => project.slug === slug)).filter(Boolean)
  usePageMeta({ title: 'Saved Projects | D&C Prime Realty', description: 'Review the D&C Prime Realty projects saved in this browser.' })

  return (
    <>
      <PageHero eyebrow="Saved Projects" title="Projects saved in this browser" description="Saved projects stay on this device and do not require an account." image="/website/images/maragondon/prime-enclave-cover.jpg" />
      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          {savedProjects.length ? <><div className="mb-6 flex justify-end"><button type="button" onClick={clearSaved} className="website-button-light"><FiTrash2 /> Clear saved projects</button></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{savedProjects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div></> : <div className="rounded-[18px] border border-dashed border-[#cfc8bb] bg-white p-10 text-center"><FiHeart className="mx-auto h-8 w-8 text-[#a99f90]" /><h2 className="mt-4 text-[24px]">No saved projects yet</h2><p className="mt-2 text-[13px] text-[#6d6960]">Use the heart button on a project card to keep it here for later.</p></div>}
        </div>
      </section>
    </>
  )
}

export default SavedProjects
