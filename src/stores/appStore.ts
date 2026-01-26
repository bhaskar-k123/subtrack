import { create } from 'zustand';
import { getSetting, setSetting } from '@/lib/db/settings';

interface AppState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Currency
  currency: string;
  setCurrency: (currency: string) => void;
  
  // Date format
  dateFormat: string;
  setDateFormat: (format: string) => void;
  
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Initialize from database
  initialize: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'dark',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  sidebarCollapsed: false,
  isLoading: true,
  
  setTheme: async (theme) => {
    set({ theme });
    await setSetting('theme', theme);
    applyTheme(theme);
  },
  
  setCurrency: async (currency) => {
    set({ currency });
    await setSetting('currency', currency);
  },
  
  setDateFormat: async (dateFormat) => {
    set({ dateFormat });
    await setSetting('dateFormat', dateFormat);
  },
  
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  initialize: async () => {
    try {
      const [theme, currency, dateFormat] = await Promise.all([
        getSetting<'light' | 'dark' | 'system'>('theme'),
        getSetting<string>('currency'),
        getSetting<string>('dateFormat'),
      ]);
      
      set({
        theme: theme || 'dark',
        currency: currency || 'USD',
        dateFormat: dateFormat || 'MM/DD/YYYY',
        isLoading: false,
      });
      
      applyTheme(theme || 'dark');
    } catch (error) {
      console.error('Failed to initialize app state:', error);
      set({ isLoading: false });
    }
  },
}));

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('light', !prefersDark);
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('light', theme === 'light');
    root.classList.toggle('dark', theme === 'dark');
  }
}
