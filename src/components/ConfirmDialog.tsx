import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmOptions { title?: string; message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }
type AskConfirm = (options: string | ConfirmOptions) => Promise<boolean>;
interface Request { options: ConfirmOptions; resolve: (answer: boolean) => void }
const ConfirmContext = createContext<AskConfirm | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const queue = useRef<Request[]>([]);
  const [request, setRequest] = useState<Request | null>(null);
  const descriptionId = useId();
  const confirm = useCallback<AskConfirm>((options) => new Promise((resolve) => {
    queue.current.push({ options: typeof options === 'string' ? { message: options } : options, resolve });
    setRequest(queue.current[0]);
  }), []);
  const answer = (value: boolean) => {
    queue.current.shift()?.resolve(value);
    setRequest(queue.current[0] ?? null);
  };
  useEffect(() => () => { queue.current.splice(0).forEach((item) => item.resolve(false)); }, []);
  return <ConfirmContext.Provider value={confirm}>{children}
    <Modal open={request !== null} onClose={() => answer(false)} title={request?.options.title ?? 'Conferma'} role="alertdialog" describedBy={descriptionId} className="confirm-dialog">
      <p id={descriptionId} className="confirm-message">{request?.options.message}</p>
      <div className="dialog-actions"><button type="button" className="button button-secondary" autoFocus onClick={() => answer(false)}>{request?.options.cancelLabel ?? 'Annulla'}</button><button type="button" className={`button button-primary${request?.options.danger ? ' dialog-danger' : ''}`} onClick={() => answer(true)}>{request?.options.confirmLabel ?? 'Conferma'}</button></div>
    </Modal>
  </ConfirmContext.Provider>;
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm richiede ConfirmProvider.');
  return confirm;
}
