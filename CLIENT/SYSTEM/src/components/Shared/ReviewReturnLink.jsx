import { Link } from 'react-router-dom'
import { FiArrowLeft } from 'react-icons/fi'
import { reviewReturnPath } from '../../utils/reviewRecordNavigation'

// Visible after dismissing View Record so auditors can freely inspect the page.
export default function ReviewReturnLink({ role, reviewId }) {
  const to = reviewReturnPath(role, reviewId)
  return to ? <Link to={to} className="inline-flex w-fit items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"><FiArrowLeft />Back to Review</Link> : null
}

