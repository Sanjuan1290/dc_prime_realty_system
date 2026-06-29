
import { FiGrid, FiPlus } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import ListingRecords from '../../components/Bailen/ListingsComponent/ListingRecords'

const Listings = () => {

    const overview = [
        {
            name: 'All Listings',
            value: 1
        },
        {
            name: 'Available',
            value: 1
        }
        ,
        {
            name: 'Reserved',
            value: 1
        }
        ,
        {
            name: 'Active',
            value: 1
        }
        ,
        {
            name: 'Hold',
            value: 1
        }
        ,
        {
            name: 'Total Value',
            value: 490000
        }
    ]

  return (
    <main className='flex flex-col gap-6'>
        
        <div className='flex justify-between'>
            <PageHeader title={'Listings / Units'} description="Manage live project inventory, lot details, prices, and statuses." icon={FiGrid}/>
        
            <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-fit"
            >
                <FiPlus className="h-4 w-4" />
                Add Project
            </button>
        </div>

        <div className='grid grid-cols-7 gap-3'>
            {
                overview.map(ov => (
                    <div className='border border-gray-400 rounded-lg px-3 py-2 h-32 hover:-translate-y-1 hover:shadow-md shadow-blue-950 duration-150 cursor-pointer   '>
                        <p className='font-semibold text-gray-600'>{ov.name}</p>
                        <h3 className='font-bold text-2xl'>{ov.value}</h3>
                    </div>
                ))
            }
        </div>

        <ListingRecords />
        

    </main>
  )
}

export default Listings