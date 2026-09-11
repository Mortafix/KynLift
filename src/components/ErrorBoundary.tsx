import { Component, type ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal-error"><h1>Ripartiamo da qui.</h1><p>Non è stato possibile aprire questa schermata. Ricarica Kynlift per riprovare: i dati già salvati restano sul dispositivo.</p><button className="button button-primary" type="button" onClick={() => location.reload()}><RotateCcw size={20} />Ricarica Kynlift</button></main>;
    return this.props.children;
  }
}
