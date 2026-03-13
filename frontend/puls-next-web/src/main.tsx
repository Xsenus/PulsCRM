import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { AuthProvider } from './app/AuthContext';
import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
