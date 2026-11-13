import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Brand fonts from the mood board, bundled so they work offline:
// Poppins for headings, Nunito for body text and numbers.
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';

// The Assignment 2 template stylesheet, unchanged, then the few additions React needs.
import './styles/styles.css';
import './styles/app.css';

import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
