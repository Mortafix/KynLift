import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-500.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import App from './App';
import './styles.css';
import { updatePageMetadata } from './lib/seo';

// Older iOS releases expose Home Screen mode only through navigator.standalone.
document.documentElement.classList.toggle('ios-standalone', (navigator as Navigator & { standalone?: boolean }).standalone === true);
updatePageMetadata(location.pathname);
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
