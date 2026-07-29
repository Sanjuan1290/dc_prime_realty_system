import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PageHero from '../components/PageHero'
import ProjectCard from '../components/ProjectCard'
import SectionHeading from '../components/SectionHeading'
import TrippingForm from '../components/TrippingForm'
import usePageMeta from '../hooks/usePageMeta'
import { projects } from '../data/projects'

const Properties = () => {
  const [filter, setFilter] = useState('all')
  const location = useLocation()
  usePageMeta({ title: 'Properties in Bailen and Maragondon | D&C Prime Realty', description: 'View the current D&C Prime Realty property projects in Bailen and Maragondon, Cavite.' })

  useEffect(() => {
    if (location.hash === '#book-tripping') setTimeout(() => document.getElementById('book-tripping')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [location.hash])

  const filtered = filter === 'all' ? projects : projects.filter((project) => project.shortName.toLowerCase() === filter)

  return (
    <>
      <PageHero eyebrow="Properties" title="Current property projects in Cavite" description="Explore lot options in Bailen and Maragondon. Open a project to view the gallery, project highlights and tripping form." image="/website/images/bailen/luntiang-aguinaldo-cover.jpg" />
      <section className="px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-wrap gap-3">{[['all','All projects'],['bailen','Bailen'],['maragondon','Maragondon']].map(([value,label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-5 py-3 text-[13px] font-black transition ${filter === value ? 'bg-[#17130a] text-white' : 'border border-[#dfd2b4] bg-white text-[#5f5542] hover:border-[#b58a22]'}`}>{label}</button>)}</div>
          <div className="mt-9 grid gap-7 lg:grid-cols-2">{filtered.map((project) => <ProjectCard key={project.slug} project={project} />)}</div>
        </div>
      </section>
      <section className="bg-[#f4efe2] px-5 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <SectionHeading eyebrow="Book a Tripping" title="Choose a project and preferred visit date" description="Regular site visits are unavailable on Tuesday and Thursday. The current form is a frontend preview and still requires direct confirmation." />
          <TrippingForm />
        </div>
      </section>
    </>
  )
}

export default Properties
