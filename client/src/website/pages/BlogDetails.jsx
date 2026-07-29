import { FiArrowLeft, FiClock } from 'react-icons/fi'
import { Link, useParams } from 'react-router-dom'
import usePageMeta from '../hooks/usePageMeta'
import { getBlogBySlug } from '../data/blogs'

const BlogDetails = () => {
  const { blogSlug } = useParams()
  const blog = getBlogBySlug(blogSlug)
  usePageMeta({ title: blog ? `${blog.title} | D&C Prime Realty` : 'Article not found | D&C Prime Realty', description: blog?.metaDescription || '', image: blog?.image, type: 'article' })
  if (!blog) return <div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-[40px] font-black">Article not found</h1><Link to="/blog" className="website-button-dark mt-7">Return to blog</Link></div>
  return <article><header className="relative isolate overflow-hidden bg-[#17130a] px-5 py-20 text-white lg:px-8 lg:py-28"><img src={blog.image} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30" /><div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#17130a] via-[#17130a]/90 to-[#17130a]/55" /><div className="mx-auto max-w-[1000px]"><Link to="/blog" className="inline-flex items-center gap-2 text-[13px] font-black text-[#e7be48]"><FiArrowLeft /> Back to blog</Link><p className="mt-10 text-[12px] font-black uppercase tracking-[0.2em] text-[#e7be48]">{blog.category}</p><h1 className="mt-4 text-[44px] font-black leading-[1.04] tracking-[-0.045em] sm:text-[62px]">{blog.title}</h1><div className="mt-6 flex flex-wrap items-center gap-4 text-[13px] font-semibold text-[#ddd4c2]"><span>{blog.date}</span><span className="flex items-center gap-2"><FiClock /> {blog.readingTime}</span></div></div></header><div className="mx-auto max-w-[860px] px-5 py-16 lg:py-20"><p className="text-[19px] font-semibold leading-9 text-[#4d4537]">{blog.excerpt}</p>{blog.sections.map((section) => <section key={section.heading} className="mt-12"><h2 className="text-[30px] font-black tracking-[-0.035em] text-[#1b170d]">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-5 text-[16px] leading-8 text-[#625a4b]">{paragraph}</p>)}</section>)}<div className="mt-14 rounded-[24px] bg-[#f4efe2] p-7"><h2 className="text-[22px] font-black">Ready to visit a project?</h2><p className="mt-3 text-[14px] leading-7 text-[#665e4e]">View the current Bailen and Maragondon projects and request a preferred tripping schedule.</p><Link to="/properties#book-tripping" className="website-button-dark mt-6">Book a Tripping</Link></div></div></article>
}
export default BlogDetails
