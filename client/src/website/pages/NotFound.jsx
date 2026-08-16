import { Link } from 'react-router-dom'
import usePageMeta from '../hooks/usePageMeta'

const NotFound = () => {
  usePageMeta({ title: 'Page not found | D&C Prime Realty', description: 'The requested page could not be found.' })
  return <div className="mx-auto max-w-[720px] px-5 py-20 text-center"><img src="/website/images/brand/dc-prime-mark.svg" alt="" className="mx-auto h-20 w-20" /><p className="mt-6 text-[11px] font-bold uppercase tracking-[0.18em] text-[#806014]">404</p><h1 className="mt-3 text-[34px]">Page not found</h1><p className="mt-4 text-[14px] leading-7 text-[#6d6960]">The page may have moved or the address may be incorrect.</p><Link to="/" className="website-button-dark mt-6">Return home</Link></div>
}

export default NotFound
