import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiArrowUpRight } from 'react-icons/fi'
import { blogs } from '../data/blogs'
import { PageIntro } from '../components/StaticSiteUI'
import { staticProjects } from '../data/staticSite'
import usePageMeta from '../hooks/usePageMeta'
const cats=['All','Buyer Guide','Location Guide','Property Tripping']
export default function Blog(){
 const [filter,setFilter]=useState('All')
 usePageMeta({title:'Blogs | D&C Prime Realty',description:'Real estate articles, property guides and site-visit tips from D&C Prime Realty.'})
 const visible=filter==='All'?blogs:blogs.filter(b=>b.category===filter)
 return <><PageIntro eyebrow="FROM THE JOURNAL" title="Insights for your next move." description="Guides, project information and practical notes for property buyers." photo/>
 <section className="dc-container dc-section"><div className="dc-filters" role="group" aria-label="Filter blog categories">{cats.map(c=><button type="button" key={c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{c}</button>)}</div><div className="dc-blog-grid dc-blog-page-grid">{visible.map((b,i)=><Link key={b.slug} to={`/blog/${b.slug}`} className="dc-blog-tile"><div className="dc-blog-photo"><img src={i%2===0?staticProjects[0].gallery[1].src:staticProjects[1].gallery[1].src} alt="Cavite project photograph from D&C Prime Realty archive" loading="lazy" decoding="async" width="720" height="440"/><span>Project photo</span></div><div className="dc-blog-meta"><span>{b.category}</span><span>{b.date}</span></div><h3>{b.title}</h3><p>{b.excerpt}</p><span className="dc-text-link">Read article <FiArrowUpRight/></span></Link>)}</div>{visible.length===0&&<p className="dc-empty">No articles in this category yet.</p>}</section></>
}

