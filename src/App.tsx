import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Login } from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        {/* Placeholder per le impostazioni */}
        <Route path="/settings" element={<div className="p-8 text-center"><h1 className="text-2xl text-gradient">Impostazioni (In Arrivo)</h1></div>} />
        
        {/* Redirect di default al login se non autenticato (attualmente reindirizza per comodità) */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
