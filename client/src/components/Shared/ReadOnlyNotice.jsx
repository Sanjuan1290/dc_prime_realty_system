import { FiEye } from 'react-icons/fi'

const ReadOnlyNotice = ({ message = 'You can view this module, but only a Super Admin can make changes.' }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
    <FiEye className="mt-0.5 h-5 w-5 shrink-0" />
    <p>{message}</p>
  </div>
)

export default ReadOnlyNotice

