import { useState } from 'react'
import { FiArrowLeft, FiClock, FiCopy, FiMapPin, FiPrinter, FiShare2 } from 'react-icons/fi'
import { Link, useParams } from 'react-router-dom'
import BlogCard from '../components/BlogCard'
import usePageMeta from '../hooks/usePageMeta'
import { blogs, getBlogBySlug } from '../data/blogs'
import { copyText } from '../utils/share'

const BlogDetails = () => {
  const { blogSlug } = useParams()
  const blog = getBlogBySlug(blogSlug)
  const [copied, setCopied] = useState(false)
  const related = blog ? blogs.filter((item) => item.slug !== blog.slug).slice(0, 2) : []

  const schema = blog ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: blog.title,
    description: blog.metaDescription,
    image: blog.image,
    datePublished: blog.publishedAt,
    dateModified: blog.updatedAt,
    author: { '@type': 'Organization', name: 'D&C Prime Realty' },
    publisher: { '@type': 'Organization', name: 'D&C Prime Realty' },
  } : null

  usePageMeta({ title: blog ? `${blog.title} | D&C Prime Realty` : 'Article not found | D&C Prime Realty', description: blog?.metaDescription || '', image: blog?.image, type: 'article', schema })

  if (!blog) return <div className="mx-auto max-w-3xl px-5 py-20 text-center"><h1 className="text-[34px]">Article not found</h1><Link to="/blog" className="website-button-dark mt-6">Return to blog</Link></div>

  const shareArticle = async () => {
    const data = { title: blog.title, text: blog.excerpt, url: window.location.href }
    if (navigator.share) {
      try { await navigator.share(data); return } catch { /* sharing cancelled */ }
    }
    await copyText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <article>
      <header className="relative isolate overflow-hidden bg-[#17130a] px-5 py-14 text-white lg:px-8 lg:py-18">
        <img src={blog.image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-[0.28]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17130a] via-[#17130a]/92 to-[#17130a]/55" />
        <div className="mx-auto max-w-[920px]">
          <Link to="/blog" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#dfbd62]"><FiArrowLeft /> Back to blog</Link>
          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.18em] text-[#dfbd62]">{blog.category}</p>
          <h1 className="mt-4 text-[34px] leading-[1.18] sm:text-[42px] xl:text-[48px]">{blog.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] text-[#d8d1c4]"><span>{blog.date}</span><span className="flex items-center gap-2"><FiClock /> {blog.readingTime}</span><span className="flex items-center gap-2"><FiMapPin /> {blog.relatedProject}</span></div>
          <div className="mt-6 flex flex-wrap gap-2 print:hidden"><button type="button" onClick={shareArticle} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-[12px] font-semibold text-white hover:bg-white/20">{copied ? <FiCopy /> : <FiShare2 />} {copied ? 'Link copied' : 'Share article'}</button><button type="button" onClick={() => window.print()} className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-[12px] font-semibold text-white hover:bg-white/20"><FiPrinter /> Print article</button></div>
        </div>
      </header>
      <div className="website-prose mx-auto max-w-[760px] px-5 py-12 lg:py-16">
        <p className="!mt-0 !text-[17px] !font-medium !leading-8 !text-[#49463f]">{blog.excerpt}</p>
        {blog.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
        <div className="mt-12 rounded-[18px] border border-[#ded9ce] bg-[#f1ede3] p-6"><h2 className="!mt-0 !text-[22px]">Ready to visit a project?</h2><p className="!mt-3 !text-[13px] !leading-6">View the available Bailen and Maragondon projects and prepare your tripping request.</p><div className="mt-5 flex flex-wrap gap-2"><Link to="/properties#book-tripping" className="website-button-dark">Book a Tripping</Link><Link to="/visit-checklist" className="website-button-light">Visit checklist</Link></div></div>
      </div>
      <section className="border-t border-[#e5dfd5] bg-white px-5 py-12 lg:px-8 print:hidden"><div className="mx-auto max-w-[1000px]"><h2 className="text-[27px]">Related articles</h2><div className="mt-6 grid gap-5 md:grid-cols-2">{related.map((item) => <BlogCard key={item.slug} blog={item} />)}</div></div></section>
    </article>
  )
}

export default BlogDetails
