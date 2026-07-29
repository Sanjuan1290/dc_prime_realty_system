import { Link } from 'react-router-dom'
import usePageMeta from '../hooks/usePageMeta'
const NotFound = () => { usePageMeta({ title: 'Page not found | D&C Prime Realty', description: 'The requested page could not be found.' }); return <section className="px-5 py-28 text-center"><p className="text-[12px] font-black uppercase tracking-[0.2em] text-[#9d7007]">404</p><h1 className="mt-4 text-[48px] font-black tracking-[-0.05em]">Page not found</h1><p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-[#6b6251]">The page may have moved or the address may be incorrect.</p><Link to="/" className="website-button-dark mt-8">Return home</Link></section> }
export default NotFound
