
type Props = {
    label: string,
    type: string,
    placeholder: string,
}

const InputLabel = ( props: Props) => {
  return (
    <div className="flex flex-col gap-1 ">
        {
            props.label.trim() !== '' && <label className="font-bold text-gray-800 tracking-wider">{props.label}</label>
        }
        <input type={props.type} placeholder={props.placeholder} className="border border-gray-300 rounded-md py-2 px-3 outline-none focus:border-blue-600 focus:shadow-sm focus:shadow-blue-500 duration-150"/>
    </div>
  )
}

export default InputLabel