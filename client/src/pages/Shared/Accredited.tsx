import PageHeader from "../../components/Shared/PageHeader"
import { FaUserPlus } from "react-icons/fa";

const Accredited = () => {
  return (
    <main className="flex flex-col gap-6">
      <PageHeader 
        title={"Accredited Sellers"} 
        description={'Read-only seller directory. Rates are managed by Seller Groups in User Management.'}
        icon={FaUserPlus}/>
    </main>
  )
}

export default Accredited