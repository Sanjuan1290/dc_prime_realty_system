import {useEffect,useId,useRef} from 'react';
import {createPortal} from 'react-dom';
import {FiAlertCircle,FiAlertTriangle,FiCheckCircle,FiInfo,FiLoader,FiX} from 'react-icons/fi';

export function Spinner({label}){return <><FiLoader className="spinner" aria-hidden="true"/>{label&&<span>{label}</span>}</>}
export function Notice({type='info',title,children,onDismiss}){
  const Icon={success:FiCheckCircle,warning:FiAlertTriangle,error:FiAlertCircle,info:FiInfo}[type]||FiInfo;
  return <div className={`notice ${type}`} role={type==='error'?'alert':'status'}><Icon aria-hidden="true"/><div className="notice-content">{title&&<strong>{title}</strong>}{children&&<div>{children}</div>}</div>{onDismiss&&<button type="button" className="icon-button" aria-label="Dismiss message" onClick={onDismiss}><FiX aria-hidden="true"/></button>}</div>;
}
export function Dialog({title,description,children,onClose,busy=false,danger=false,label,wide=false}){
  const titleId=useId(),descriptionId=useId(),ref=useRef(null),state=useRef({onClose,busy});
  state.current={onClose,busy};
  useEffect(()=>{
    const before=document.activeElement,overflow=document.body.style.overflow,node=ref.current;
    document.body.style.overflow='hidden';node?.querySelector('[data-dialog-close]')?.focus();
    const handle=event=>{
      if(event.key==='Escape'){event.preventDefault();if(!state.current.busy)state.current.onClose?.();return}
      if(event.key!=='Tab')return;
      const focusable=[...node.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length),first=focusable[0],last=focusable.at(-1);
      if(!focusable.length){event.preventDefault();node.focus();return}
      if(!node.contains(document.activeElement)||(event.shiftKey&&document.activeElement===first)){event.preventDefault();(event.shiftKey?last:first).focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',handle);
    return ()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',handle);before?.focus?.()};
  },[]);
  return createPortal(<div className="modal-overlay" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)onClose?.()}}><section ref={ref} tabIndex={-1} className={`modal ${danger?'modal-danger':''} ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={label?undefined:titleId} aria-describedby={description?descriptionId:undefined} aria-busy={busy}><header className="dialog-header"><div>{title&&<h2 id={titleId}>{title}</h2>}{description&&<p id={descriptionId}>{description}</p>}</div><button className="icon-button" type="button" data-dialog-close disabled={busy} aria-label="Close dialog" onClick={onClose}><FiX aria-hidden="true"/></button></header>{children}</section></div>,document.body);
}
