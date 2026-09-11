import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import './select.css';

export interface SelectOption { value: string; label: string; disabled?: boolean }
export interface SelectProps {
  id?: string;
  label?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  leadingIcon?: ReactNode;
}

/** Select-only combobox: focus stays on the trigger while the listbox is open. */
export function Select({ id, label, ariaLabel, value, onChange, options, disabled = false, placeholder = 'Seleziona', className = '', leadingIcon }: SelectProps) {
  const generatedId = useId();
  const controlId = id ?? `select-${generatedId}`;
  const listId = `${controlId}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter((index) => index >= 0);
  const inactive = disabled || !enabled.length;
  const highlighted = enabled.includes(active) ? active : enabled[0];

  function show(index = selected >= 0 && !options[selected].disabled ? selected : enabled[0]) {
    if (inactive) return;
    search.current = { text: '', time: 0 };
    setActive(index); setOpen(true);
  }

  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value); setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    const list = popup.current;
    if (!list || !open || inactive) return;
    const place = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const above = Math.max(48, anchor.top - viewportTop - 12);
      const below = Math.max(48, viewportBottom - anchor.bottom - 12);
      const upward = below < 220 && above > below;
      list.style.width = `${Math.min(Math.max(anchor.width, 220), window.innerWidth - 24)}px`;
      list.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - Math.min(Math.max(anchor.width, 220), window.innerWidth - 24) - 12))}px`;
      list.style.maxHeight = `${Math.min(336, upward ? above : below)}px`;
      list.style.top = upward ? 'auto' : `${anchor.bottom + 6}px`;
      list.style.bottom = upward ? `${window.innerHeight - anchor.top + 6}px` : 'auto';
    };
    place();
    list.showPopover();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      if (list.matches(':popover-open')) list.hidePopover();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, inactive]);

  useLayoutEffect(() => {
    if (!open) return;
    const list = popup.current;
    const item = list?.querySelector<HTMLElement>(`[data-index="${highlighted}"]`);
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  }, [open, highlighted]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: Event) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (inactive || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (event.key === 'Tab') { if (open) { const option = options[highlighted]; if (option) onChange(option.value); setOpen(false); } return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); if (open) choose(highlighted); else show(); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const edge = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)! : null;
      if (!open) show(edge ?? (selected >= 0 ? selected : event.key === 'ArrowUp' ? enabled.at(-1)! : enabled[0]));
      else setActive(edge ?? enabled[Math.max(0, Math.min(enabled.length - 1, enabled.indexOf(highlighted) + (event.key === 'ArrowDown' ? 1 : -1)))]);
      return;
    }
    if (event.key.length !== 1 || event.altKey) return;
    event.preventDefault();
    const now = Date.now();
    const typed = `${now - search.current.time < 700 ? search.current.text : ''}${event.key.toLocaleLowerCase('it-IT')}`;
    const query = [...typed].every((letter) => letter === typed[0]) ? typed[0] : typed;
    search.current = { text: typed, time: now };
    const initial = open ? highlighted : selected;
    const ordered = query.length === 1 ? [...enabled.filter((index) => index > initial), ...enabled.filter((index) => index <= initial)] : enabled;
    const match = ordered.find((index) => options[index].label.toLocaleLowerCase('it-IT').startsWith(query));
    if (!open) { setOpen(true); setActive(match ?? (selected >= 0 ? selected : enabled[0])); }
    else if (match !== undefined) setActive(match);
  }

  return <div ref={root} className={`custom-select ${className}`}>
    {label && <span id={`${controlId}-label`} className="custom-select-label">{leadingIcon && <span aria-hidden="true">{leadingIcon}</span>}{label}</span>}
    <button ref={trigger} id={controlId} type="button" role="combobox" className="custom-select-trigger" aria-label={ariaLabel} aria-labelledby={!ariaLabel && label ? `${controlId}-label` : undefined} aria-expanded={open && !inactive} aria-controls={listId} aria-haspopup="listbox" aria-activedescendant={open && !inactive ? `${listId}-${highlighted}` : undefined} disabled={inactive} onClick={() => open ? setOpen(false) : show()} onKeyDown={keyDown}>
      <span>{selected >= 0 ? options[selected].label : placeholder}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    <div ref={popup} id={listId} role="listbox" popover="manual" className="custom-select-options" aria-label={ariaLabel ?? label}>
      {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option" aria-selected={value === option.value} aria-disabled={option.disabled || undefined} data-index={index} data-active={index === highlighted} className="custom-select-option" onPointerMove={() => { if (!option.disabled) setActive(index); }} onPointerDown={(event) => event.preventDefault()} onClick={() => choose(index)}><span>{option.label}</span>{value === option.value && <Check size={18} aria-hidden="true" />}</div>)}
    </div>
  </div>;
}
