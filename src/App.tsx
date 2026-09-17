import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { useAppStore } from './store/useAppStore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './core/firebase';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAppStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const user = useAppStore(s => s.user);
  const setUser = useAppStore(s => s.setUser);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          name: firebaseUser.displayName || 'Utente Universitario',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || '',
        });
      } else {
        setUser(null);
      }
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, [setUser]);

  if (isInitializing) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <span>Caricamento...</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/home" replace /> : <Login />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? "/home" : "/login"} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
