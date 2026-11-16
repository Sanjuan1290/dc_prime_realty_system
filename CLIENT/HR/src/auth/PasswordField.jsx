import {useId,useState} from 'react';
import {FiEye,FiEyeOff} from 'react-icons/fi';
export default function PasswordField({label='Password',...props}) {
  const id=useId(),[visible,setVisible]=useState(false);
  return <div className="mt-4"><label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}</label><div className="relative mt-2"><input {...props} id={id} type={visible?'text':'password'} className="w-full rounded-lg border border-slate-300 p-3 pr-12 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(v=>!v)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{visible?<FiEyeOff aria-hidden="true"/>:<FiEye aria-hidden="true"/>}</button></div></div>;
}
