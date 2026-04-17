import { create } from 'zustand';

interface AppState {
  currentFamilyGroupId: string | null;
  setCurrentFamilyGroupId: (id: string | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentFamilyGroupId: null,
  setCurrentFamilyGroupId: (id) => set({ currentFamilyGroupId: id }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
