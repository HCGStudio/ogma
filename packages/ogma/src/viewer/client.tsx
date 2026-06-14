import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { runtimeConfig } from 'virtual:ogma-config';
import { review } from 'virtual:ogma-design';
import { OgmaReviewApp } from './OgmaReviewApp.js';
import './styles.css';

const root = document.getElementById('ogma-root');

if (!root) {
  throw new Error('Ogma could not find #ogma-root.');
}

createRoot(root).render(
  <StrictMode>
    <OgmaReviewApp config={runtimeConfig} review={review} />
  </StrictMode>
);
