import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X, Lightbulb } from 'lucide-react'

interface HelpButtonProps {
  title: string
  description: string
  tips?: string[]
  align?: 'left' | 'right'
}

interface PopoverPos {
  top: number
  left?: number
  right?: number
}

export function HelpButton({ title, description, tips, align = 'right' }: HelpButtonProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<PopoverPos>({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  /* Position the popover using fixed coords so it escapes overflow:hidden parents */
  function calcPos() {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const popoverW = 288 // w-72
    const gap = 8

    const top = r.bottom + gap

    if (align === 'left') {
      // open to the LEFT — right-align with button
      const right = window.innerWidth - r.right
      setPos({ top, right })
    } else {
      // open to the RIGHT — left-align with button, clamp so it doesn't overflow viewport
      const left = Math.min(r.left, window.innerWidth - popoverW - 12)
      setPos({ top, left })
    }
  }

  function toggle() {
    if (!open) calcPos()
    setOpen(v => !v)
  }

  /* Close on outside click */
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  /* Close on Escape */
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  /* Reposition on scroll / resize */
  useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', calcPos, true)
    window.addEventListener('resize', calcPos)
    return () => {
      window.removeEventListener('scroll', calcPos, true)
      window.removeEventListener('resize', calcPos)
    }
  }, [open])

  const popover = open ? (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: pos.top,
        ...(pos.left  !== undefined ? { left:  pos.left  } : {}),
        ...(pos.right !== undefined ? { right: pos.right } : {}),
        zIndex: 9999,
        width: 288,
      }}
      className="bg-slate-800 border border-slate-700/80 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <Lightbulb size={13} className="text-amber-400" />
          <span className="text-sm font-semibold text-slate-100">{title}</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-300 transition-colors"
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        {tips && tips.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                <span className="text-blue-400 mt-px flex-shrink-0">→</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
        aria-label={`About ${title}`}
      >
        <HelpCircle size={14} />
      </button>

      {createPortal(popover, document.body)}
    </>
  )
}
