import { FiArrowRight, FiClock } from 'react-icons/fi'
import { Link } from 'react-router-dom'

const BlogCard = ({ blog }) => (
  <article className="group overflow-hidden rounded-[24px] border border-[#e8dec8] bg-white shadow-[0_18px_55px_rgba(93,69,14,0.07)]">
    <Link to={`/blog/${blog.slug}`} className="block h-[220px] overflow-hidden"><img src={blog.image} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" /></Link>
    <div className="p-6">
      <div className="flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.13em] text-[#9d7007]"><span>{blog.category}</span><span className="flex items-center gap-1 text-[#817765]"><FiClock /> {blog.readingTime}</span></div>
      <h3 className="mt-4 text-[22px] font-black leading-tight tracking-[-0.03em] text-[#1a160d]"><Link to={`/blog/${blog.slug}`} className="hover:text-[#956900]">{blog.title}</Link></h3>
      <p className="mt-3 text-[13px] leading-6 text-[#6a6150]">{blog.excerpt}</p>
      <Link to={`/blog/${blog.slug}`} className="mt-5 inline-flex items-center gap-2 text-[13px] font-black text-[#76550c]">Read article <FiArrowRight className="transition group-hover:translate-x-1" /></Link>
    </div>
  </article>
)

export default BlogCard
