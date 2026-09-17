import { useAppStore } from '../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock Authentication and Database to simulate Firebase behavior
 * until real keys are provided.
 */
export const mockBackend = {
  loginWithGoogle: async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockUser = {
      name: 'Studente Universitario',
      email: 'studente@universita.edu',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
    };
    
    useAppStore.getState().setUser(mockUser);
    
    // Load some mock data for demonstration
    mockBackend.loadMockData();
    
    return mockUser;
  },
  
  logout: () => {
    useAppStore.getState().setUser(null);
  },

  loadMockData: () => {
    const store = useAppStore.getState();
    
    // Avoid double loading
    if (store.courses.length > 0) return;

    // Add mock courses
    store.addCourse({
      id: uuidv4(),
      name: 'Analisi Matematica I',
      difficulty: 8,
      color: 'var(--accent-danger)',
      defaultStudyPreferences: {
        requiresNotesRevision: true,
        requiresExercises: true,
        estimatedRevisionTimePerLesson: 60
      }
    });

    store.addCourse({
      id: uuidv4(),
      name: 'Fisica Generale',
      difficulty: 7,
      color: 'var(--accent-warning)',
      defaultStudyPreferences: {
        requiresNotesRevision: true,
        requiresExercises: true,
        estimatedRevisionTimePerLesson: 90
      }
    });

    // We can add events and tasks here later, or let the user create them
  }
};
