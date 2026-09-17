import { useAppStore } from '../store/useAppStore';
import { signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { clearState } from './persistence';

/**
 * Authentication methods using Firebase.
 */
export const authService = {
  loginWithGoogle: async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    const loggedUser = {
      name: user.displayName || 'Utente Universitario',
      email: user.email || '',
      photoURL: user.photoURL || '',
    };

    useAppStore.getState().setUser(loggedUser);
    return loggedUser;
  },

  logout: async () => {
    await firebaseSignOut(auth);
    useAppStore.getState().setUser(null);
    // Don't clear data — user may want it when re-logging
  },

  logoutAndClear: async () => {
    await firebaseSignOut(auth);
    useAppStore.getState().setUser(null);
    clearState();
  },
};
