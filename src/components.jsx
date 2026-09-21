import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { normalizeText } from './data'

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

export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Selecione ou digite para buscar...',
  disabled = false,
  className = '',
  emptyText = 'Nenhuma opção encontrada',
  id,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value))
  }, [options, value])

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption ? selectedOption.label : '')
    }
  }, [selectedOption, isOpen])

  const filteredOptions = useMemo(() => {
    if (!query.trim() || !isOpen) {
      return options
    }
    const norm = normalizeText(query)
    return options.filter((opt) => {
      if (opt.isNew) return true
      const labelNorm = normalizeText(opt.label || '')
      const subNorm = normalizeText(opt.subtitle || '')
      return labelNorm.includes(norm) || subNorm.includes(norm)
    })
  }, [options, query, isOpen])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
        setQuery(selectedOption ? selectedOption.label : '')
      }
    }
    if (isOpen) {
      document.addEventListener('pointerdown', handlePointerDown)
    }
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, selectedOption])

  const handleSelect = (opt) => {
    if (opt.disabled) return
    onChange(opt.value)
    setQuery(opt.label)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (event) => {
    if (disabled) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(0)
      } else {
        setHighlightedIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : 0))
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(filteredOptions.length - 1)
      } else {
        setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1))
      }
    } else if (event.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        event.preventDefault()
        handleSelect(filteredOptions[highlightedIndex])
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
      setQuery(selectedOption ? selectedOption.label : '')
      inputRef.current?.blur()
    }
  }

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.searchable-select-option')
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  return (
    <div
      ref={containerRef}
      className={`searchable-select ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
    >
      <div className="searchable-select-control">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          disabled={disabled}
          placeholder={placeholder}
          value={isOpen ? query : (selectedOption?.label || '')}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
            setHighlightedIndex(-1)
          }}
          onFocus={(e) => {
            if (!disabled) {
              setIsOpen(true)
              e.target.select()
            }
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="searchable-select-indicators">
          {isOpen && query && (
            <button
              type="button"
              tabIndex={-1}
              className="searchable-select-clear"
              aria-label="Limpar busca"
              onClick={(e) => {
                e.stopPropagation()
                setQuery('')
                inputRef.current?.focus()
              }}
            >
              <X size={13} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            className="searchable-select-arrow"
            aria-label="Alternar opções"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) {
                if (isOpen) {
                  setIsOpen(false)
                  setQuery(selectedOption ? selectedOption.label : '')
                } else {
                  setIsOpen(true)
                  inputRef.current?.focus()
                }
              }
            }}
          >
            <ChevronDown size={15} />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="searchable-select-popover" onPointerDown={(e) => e.stopPropagation()}>
          <div ref={listRef} className="searchable-select-list" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-empty">{emptyText}</div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value)
                const isHighlighted = index === highlightedIndex
                return (
                  <button
                    key={`${opt.value}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    className={`searchable-select-option ${isSelected ? 'selected' : ''} ${
                      isHighlighted ? 'highlighted' : ''
                    } ${opt.isNew ? 'is-new-option' : ''}`}
                    onClick={() => handleSelect(opt)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="searchable-select-option-main">
                      <span className="searchable-select-option-label">
                        {opt.isNew && <Plus size={13} className="new-opt-icon" />}
                        {opt.label}
                      </span>
                      {opt.subtitle && (
                        <span className="searchable-select-option-subtitle">{opt.subtitle}</span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="searchable-select-check" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

