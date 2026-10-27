import { Link, useLocation } from 'react-router-dom'
import { FiCalendar, FiMessageCircle } from 'react-icons/fi'

// Visible on small screens only; hidden on contact and booking forms to avoid duplicate primary actions.
export default function MobileBookingBar(){
 const { pathname }=useLocation()
 if(pathname==='/book-tripping'||pathname==='/contact-us') return null
 return <nav className="dc-mobile-actions" aria-label="Quick contact actions">
  <Link className="dc-mobile-actions-book" to="/book-tripping"><FiCalendar aria-hidden="true"/> Book a Tripping</Link>
  <Link className="dc-mobile-actions-contact" to="/contact-us"><FiMessageCircle aria-hidden="true"/> Contact</Link>
 </nav>
}
