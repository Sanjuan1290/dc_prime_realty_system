import { FiChevronDown } from 'react-icons/fi'
import { NavLink } from 'react-router-dom'

const NavigationDropdown = ({ item, light = false }) => (
  <div className="group relative" data-navigation-dropdown>
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-3 text-[13px] font-semibold transition ${
        light
          ? 'text-white/90 hover:text-[#f0cf70] group-focus-within:text-[#f0cf70]'
          : 'text-[#322e27] hover:text-[#806014] group-focus-within:text-[#806014]'
      }`}
      aria-haspopup="true"
    >
      {item.label}
      <FiChevronDown className="h-4 w-4 transition group-hover:rotate-180 group-focus-within:rotate-180" />
    </button>
    <div className="invisible absolute left-1/2 top-full z-50 w-[330px] -translate-x-1/2 translate-y-2 rounded-2xl border border-[#ded9ce] bg-white p-2 opacity-0 shadow-[0_18px_55px_rgba(39,32,18,0.14)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
      {item.children.map((child) => (
        <NavLink
          key={child.to}
          to={child.to}
          className={({ isActive }) => `flex items-start gap-3 rounded-xl px-3 py-3 transition ${isActive ? 'bg-[#f6efdc]' : 'hover:bg-[#f8f6f0]'}`}
        >
          {child.logo ? <img src={child.logo} alt="" className="mt-0.5 h-9 w-20 shrink-0 object-contain object-left" /> : null}
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-[#201d18]">{child.label}</span>
            {child.description ? <span className="mt-1 block text-[11px] leading-5 text-[#746f65]">{child.description}</span> : null}
          </span>
        </NavLink>
      ))}
    </div>
  </div>
)

export default NavigationDropdown
