import { useEffect } from 'react'

const getLabel = (control) => {
  const wrapped = control.closest('label')
  if (wrapped) return wrapped
  if (control.id) return document.querySelector(`label[for="${CSS.escape(control.id)}"]`)
  return null
}

const getLabelAnchor = (label, control) => {
  const candidates = Array.from(label.children || []).filter((node) =>
    ['SPAN', 'P'].includes(node.tagName)
    && !node.classList.contains('dc-input-example')
    && !node.querySelector('input,select,textarea,button')
  )
  if (candidates.length) return candidates[0]
  if (control.parentNode === label) return null
  return label
}

const decorate = () => {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.dc-input-example[data-dc-generated="true"]').forEach((node) => {
    const ownerId = node.getAttribute('data-dc-owner')
    const owner = ownerId ? document.querySelector(`[data-dc-example-id="${CSS.escape(ownerId)}"]`) : null
    const ownerType = String(owner?.type || 'text').toLowerCase()
    const eligibleType = owner?.tagName === 'TEXTAREA' || (owner?.tagName === 'INPUT' && ['text', 'number'].includes(ownerType))
    const hasExample = Boolean(String(owner?.getAttribute?.('data-example') || '').trim())
    if (!owner || !eligibleType || owner.disabled || owner.readOnly || !hasExample) node.remove()
  })

  document.querySelectorAll('input[data-example], textarea[data-example]').forEach((control, index) => {
    if (control.disabled || control.readOnly) return
    const type = String(control.type || 'text').toLowerCase()
    if (control.tagName === 'INPUT' && !['text', 'number'].includes(type)) return
    const example = String(control.getAttribute('data-example') || '').trim()
    if (!example) return
    const label = getLabel(control)
    if (!label) return

    let ownerId = control.getAttribute('data-dc-example-id')
    if (!ownerId) {
      ownerId = `dc-example-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
      control.setAttribute('data-dc-example-id', ownerId)
    }
    const existing = label.querySelector(`.dc-input-example[data-dc-owner="${CSS.escape(ownerId)}"]`)
    if (existing) {
      existing.textContent = `ex. ${example}`
      return
    }

    const helper = document.createElement('span')
    helper.className = 'dc-input-example ml-2'
    helper.setAttribute('data-dc-generated', 'true')
    helper.setAttribute('data-dc-owner', ownerId)
    helper.setAttribute('aria-hidden', 'true')
    helper.textContent = `ex. ${example}`
    const anchor = getLabelAnchor(label, control)
    if (anchor && anchor !== label) anchor.appendChild(helper)
    else if (control.parentNode === label) label.insertBefore(helper, control)
    else label.appendChild(helper)
  })
}

const InputExampleDecorator = () => {
  useEffect(() => {
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(decorate)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-example', 'disabled', 'readonly'] })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
  return null
}

export default InputExampleDecorator
