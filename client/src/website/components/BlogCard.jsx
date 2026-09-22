import { FiArrowRight, FiClock } from 'react-icons/fi'
import { Link } from 'react-router-dom'

const BlogCard = ({ blog }) => (
  <article className="group overflow-hidden rounded-[18px] border border-[#ded9ce] bg-white">
    <Link to={`/blog/${blog.slug}`} className="block aspect-[16/9] overflow-hidden">
      <img src={blog.image} alt={blog.imageAlt || blog.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
    </Link>
    <div className="p-5">
      <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#806014]">
        <span>{blog.category}</span>
        <span className="flex items-center gap-1 text-[#777168]"><FiClock /> {blog.readingTime}</span>
      </div>
      <h3 className="mt-3 text-[19px] leading-[1.35] text-[#1b1813]"><Link to={`/blog/${blog.slug}`}>{blog.title}</Link></h3>
      <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-[#666158]">{blog.excerpt}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#ece7de] pt-4">
        <span className="text-[11px] text-[#817b72]">{blog.date}</span>
        <Link to={`/blog/${blog.slug}`} className="inline-flex items-center gap-1 text-[12px] font-bold text-[#806014]">Read article <FiArrowRight /></Link>
      </div>
    </div>
  </article>
)

export default BlogCard


