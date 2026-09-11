import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './dialogs.css';

export function Modal({ open, onClose, title, children, className = '', busy = false, role = 'dialog', describedBy }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string; busy?: boolean;
  role?: 'dialog' | 'alertdialog'; describedBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [open]);

  return createPortal(<dialog ref={ref} className={`ui-dialog ${className}`} role={role} aria-labelledby={titleId} aria-describedby={describedBy} aria-busy={busy || undefined}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="ui-dialog-content">
      <header className="ui-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="icon-button" aria-label={`Chiudi ${title.toLocaleLowerCase('it')}`} disabled={busy} onClick={onClose}><X size={20} /></button></header>
      {children}
    </div>
  </dialog>, document.body);
}
