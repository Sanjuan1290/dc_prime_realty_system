import { Link, useParams } from 'react-router-dom'
import { FiArrowLeft, FiArrowUpRight } from 'react-icons/fi'
import { blogs, getBlogBySlug } from '../data/blogs'
import { PageIntro } from '../components/StaticSiteUI'
import { staticProjects } from '../data/staticSite'
import usePageMeta from '../hooks/usePageMeta'
export default function BlogDetails(){
 const {blogSlug}=useParams(), blog=getBlogBySlug(blogSlug)
 usePageMeta({title:blog?`${blog.title} | D&C Prime Realty`:'Article not found | D&C Prime Realty',description:blog?.excerpt||''})
 if(!blog)return <><PageIntro eyebrow="BLOG" title="Article not found."/><div className="dc-container dc-section"><Link className="dc-btn dc-btn-dark" to="/blog">Back to blogs</Link></div></>
 const related=blogs.filter(b=>b.slug!==blog.slug).slice(0,2)
 return <><section className="dc-article-header"><div className="dc-container"><Link className="dc-back-link" to="/blog"><FiArrowLeft/> All articles</Link><p className="dc-eyebrow">{blog.category} · {blog.date}</p><h1>{blog.title}</h1><p>{blog.excerpt}</p></div></section><div className="dc-article-image"><img src={staticProjects[0].gallery[2].src} alt="Maragondon countryside photograph supplied by D&C Prime Realty"/><span>Project photo</span></div><article className="dc-article-body"><p className="dc-article-lead">{blog.excerpt}</p>{(blog.sections||[]).map(s=><section key={s.heading}><h2>{s.heading}</h2>{s.paragraphs?.map(t=><p key={t}>{t}</p>)}</section>)}<div className="dc-article-action"><h3>Thinking about a property in Cavite?</h3><p>Meet our team or arrange a site visit before making your decision.</p><Link className="dc-btn dc-btn-dark" to="/book-tripping">Book a Tripping <FiArrowUpRight/></Link></div></article><section className="dc-container dc-section"><div className="dc-section-heading"><div><p className="dc-eyebrow">KEEP READING</p><h2>Related reading.</h2></div></div><div className="dc-article-related">{related.map(r=><Link to={`/blog/${r.slug}`} key={r.slug}><span>{r.category}</span><h3>{r.title}</h3><FiArrowUpRight/></Link>)}</div></section></>
}

