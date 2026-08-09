import { FiCalendar, FiFacebook, FiHeart, FiMail } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { company } from '../data/company'

const MobileActionBar = () => (
  <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#ded9ce] bg-white/95 px-2 py-2 shadow-[0_-8px_30px_rgba(30,24,15,0.10)] backdrop-blur lg:hidden print:hidden">
    <a href={`mailto:${company.email}`} className="flex flex-col items-center gap-1 rounded-lg py-1 text-[10px] font-semibold text-[#4f4a43]"><FiMail className="h-4 w-4" /> Email</a>
    <a href={company.facebookUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 rounded-lg py-1 text-[10px] font-semibold text-[#4f4a43]"><FiFacebook className="h-4 w-4" /> Facebook</a>
    <Link to="/saved-projects" className="flex flex-col items-center gap-1 rounded-lg py-1 text-[10px] font-semibold text-[#4f4a43]"><FiHeart className="h-4 w-4" /> Saved</Link>
    <Link to="/properties#book-tripping" className="flex flex-col items-center gap-1 rounded-lg bg-[#17130a] py-1 text-[10px] font-semibold text-white"><FiCalendar className="h-4 w-4" /> Book Visit</Link>
  </div>
)

export default MobileActionBar

