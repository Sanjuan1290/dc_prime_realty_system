import {useEffect,useRef} from 'react'

// Keep keyboard interaction and background scrolling inside the active modal.
export default function useModalFocus(onClose,{busy=false}={}){
  const dialog=useRef(null),state=useRef({onClose,busy})
  state.current={onClose,busy}
  useEffect(()=>{
    const previous=document.activeElement,overflow=document.body.style.overflow
    const node=dialog.current
    if(!node)return undefined
    const controls=()=>[...node.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(e=>e.getClientRects().length)
    document.body.style.overflow='hidden'
    ;(node.querySelector('[data-dialog-close]')||node).focus({preventScroll:true})
    const keydown=event=>{
      if(event.key==='Escape'){
        event.preventDefault()
        if(!state.current.busy)state.current.onClose?.()
      }
      if(event.key!=='Tab')return
      const items=controls(),first=items[0],last=items.at(-1)
      if(!first){event.preventDefault();node.focus();return}
      if(!node.contains(document.activeElement)||(event.shiftKey&&document.activeElement===first)){
        event.preventDefault();(event.shiftKey?last:first).focus()
      }else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    document.addEventListener('keydown',keydown)
    return ()=>{document.removeEventListener('keydown',keydown);document.body.style.overflow=overflow;previous?.focus?.({preventScroll:true})}
  },[])
  return dialog
}
