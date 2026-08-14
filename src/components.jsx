import { X } from 'lucide-react'

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="modal-header">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button className="icon-button" onClick={onClose} aria-label="Fechar"><X size={20} /></button>
      </header>
      <div className="modal-body">{children}</div>
    </section>
  </div>
}

export function Empty({ icon: Icon, title, text, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={26} /></span><h3>{title}</h3><p>{text}</p>{action}</div>
}

export function Field({ label, children, hint }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function Toast({ message, onClose }) {
  if (!message) return null
  return <button className="toast" onClick={onClose}>{message}</button>
}
