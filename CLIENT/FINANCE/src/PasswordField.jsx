import {useId,useState} from 'react';
import {FiEye,FiEyeOff} from 'react-icons/fi';
import './passwordFields.css';
export default function PasswordField({label='Password',...props}) {
  const id=useId(),[visible,setVisible]=useState(false);
  return <div className="password-field"><label htmlFor={id}>{label}</label><div className="password-input"><input {...props} id={id} type={visible?'text':'password'}/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?<FiEyeOff aria-hidden="true"/>:<FiEye aria-hidden="true"/>}</button></div></div>;
}
