import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerBuiltins } from '../../runtime/index';
import { App } from './App';
import './styles.css';

registerBuiltins();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
