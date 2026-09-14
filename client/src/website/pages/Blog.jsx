import { useMemo, useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import BlogCard from '../components/BlogCard'
import PageHero from '../components/PageHero'
import usePageMeta from '../hooks/usePageMeta'
import { blogs } from '../data/blogs'

const Blog = () => {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const categories = useMemo(() => ['All', ...new Set(blogs.map((blog) => blog.category))], [])
  const filtered = useMemo(() => blogs.filter((blog) => {
    const matchesCategory = category === 'All' || blog.category === category
    const term = query.trim().toLowerCase()
    const matchesQuery = !term || [blog.title, blog.excerpt, blog.category, blog.relatedProject].join(' ').toLowerCase().includes(term)
    return matchesCategory && matchesQuery
  }), [category, query])

  usePageMeta({ title: 'Property Guides and Blog | D&C Prime Realty', description: 'Search property buying, location and tripping guides from D&C Prime Realty.' })

  return (
    <>
      <PageHero eyebrow="Blog" title="Property guides for informed buyers" description="Search practical articles about property visits, location comparison and checks to make before reserving a lot." image="/website/images/bailen/site-road.jpg" />
      <section className="px-5 py-14 lg:px-8 lg:py-18">
        <div className="mx-auto max-w-[1240px]">
          <div className="rounded-[16px] border border-[#ded9ce] bg-white p-4">
            <label className="relative block"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#806014]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="website-input pl-11" placeholder="Search buyer guides, locations or tripping tips" /></label>
            <div className="mt-3 flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-[12px] font-semibold ${category === item ? 'bg-[#17130a] text-white' : 'border border-[#ded9ce] bg-white text-[#666158] hover:border-[#a98225]'}`}>{item}</button>)}</div>
          </div>
          <p className="mt-5 text-[12px] text-[#6d6960]">{filtered.length} article{filtered.length === 1 ? '' : 's'} found</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{filtered.map((blog) => <BlogCard key={blog.slug} blog={blog} />)}</div>
          {!filtered.length ? <div className="mt-6 rounded-[16px] border border-dashed border-[#cfc8bb] bg-white p-10 text-center"><h2 className="text-[22px]">No matching articles</h2><button type="button" onClick={() => { setQuery(''); setCategory('All') }} className="website-button-dark mt-5">Reset search</button></div> : null}
        </div>
      </section>
    </>
  )
}

export default Blog
