import { useEffect, useMemo, useState } from 'react'
import { FiBookOpen, FiHelpCircle, FiMapPin, FiSearch, FiX } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { projects } from '../data/projects'
import { blogs } from '../data/blogs'
import { faqs } from '../data/faqs'

const SiteSearch = ({ open, onClose }) => {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (term.length < 2) return []
    const projectResults = projects.filter((item) => [item.name, item.location, item.overview, item.type].join(' ').toLowerCase().includes(term)).map((item) => ({ type: 'Project', title: item.name, description: item.location, to: `/properties/${item.slug}`, Icon: FiMapPin }))
    const blogResults = blogs.filter((item) => [item.title, item.excerpt, item.category].join(' ').toLowerCase().includes(term)).map((item) => ({ type: 'Article', title: item.title, description: item.category, to: `/blog/${item.slug}`, Icon: FiBookOpen }))
    const faqResults = faqs.filter((item) => [item.question, item.answer].join(' ').toLowerCase().includes(term)).map((item, index) => ({ type: 'FAQ', title: item.question, description: item.answer, to: `/faqs#faq-${index + 1}`, Icon: FiHelpCircle }))
    return [...projectResults, ...blogResults, ...faqResults].slice(0, 10)
  }, [query])

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event) => { if (event.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleKey) }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[85] bg-black/55 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search website">
      <div className="mx-auto max-w-[720px] overflow-hidden rounded-[20px] bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[#e4ded3] p-4">
          <FiSearch className="h-5 w-5 text-[#806014]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none" placeholder="Search projects, articles or questions" />
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[#f4f1ea]" aria-label="Close search"><FiX /></button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-3">
          {query.trim().length < 2 ? <p className="p-5 text-center text-[12px] text-[#6d6960]">Enter at least two characters to search.</p> : results.length ? results.map(({ type, title, description, to, Icon }) => <Link key={`${type}-${title}`} to={to} onClick={onClose} className="flex items-start gap-3 rounded-xl p-3 hover:bg-[#f8f6f0]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3ead3] text-[#806014]"><Icon /></span><span className="min-w-0"><span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#806014]">{type}</span><span className="mt-0.5 block text-[13px] font-semibold text-[#2f2b25]">{title}</span><span className="mt-0.5 block line-clamp-1 text-[11px] text-[#777168]">{description}</span></span></Link>) : <p className="p-5 text-center text-[12px] text-[#6d6960]">No matching content found.</p>}
        </div>
      </div>
    </div>
  )
}

export default SiteSearch
