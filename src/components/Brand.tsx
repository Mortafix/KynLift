export function Mark({ className = '' }: { className?: string }) {
  return <svg className={className} width="40" height="36" viewBox="100 120 333 272" fill="currentColor" aria-hidden="true"><path d="M108 130h52v104l88-104h65L207 254l108 128h-67L160 277v105h-52z" /><path d="M310 130h52v200h61v52H310z" /></svg>;
}

export function Brand() {
  return <span className="brand"><Mark /><span>Kynlift</span></span>;
}
