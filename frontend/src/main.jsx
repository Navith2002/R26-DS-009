import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './context/AppContext';
import './styles.css';
import './account.css';
import './bhasha.css';
import { AuthProvider } from './auth/AuthContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
