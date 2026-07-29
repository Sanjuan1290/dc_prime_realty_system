import BlogCard from '../components/BlogCard'
import PageHero from '../components/PageHero'
import usePageMeta from '../hooks/usePageMeta'
import { blogs } from '../data/blogs'

const Blog = () => {
  usePageMeta({ title: 'Property Guides and Blog | D&C Prime Realty', description: 'Read property buying, location and tripping guides from D&C Prime Realty.' })
  return <><PageHero eyebrow="Blog" title="Property guides for informed buyers" description="Read practical articles about property visits, location comparison and the checks to make before reserving a lot." image="/website/images/bailen/site-road.jpg" /><section className="px-5 py-20 lg:px-8 lg:py-24"><div className="mx-auto grid max-w-[1440px] gap-6 md:grid-cols-2 lg:grid-cols-3">{blogs.map((blog) => <BlogCard key={blog.slug} blog={blog} />)}</div></section></>
}
export default Blog
