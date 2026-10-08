import { create } from 'zustand';
import { MeetingSource, MeetingStatus } from '../types/meeting';

export type CalendarViewMode = 'today' | 'week' | 'upcoming' | 'past';

interface MeetingStoreState {
  viewMode: CalendarViewMode;
  selectedSource: MeetingSource | 'all';
  searchQuery: string;
  selectedDate: string; // ISO string of selected day in calendar view
  isSyncing: boolean;
  lastSyncedTimestamp: string | null;

  // Actions
  setViewMode: (mode: CalendarViewMode) => void;
  setSelectedSource: (source: MeetingSource | 'all') => void;
  setSearchQuery: (query: string) => void;
  setSelectedDate: (dateIso: string) => void;
  setIsSyncing: (isSyncing: boolean) => void;
  setLastSyncedTimestamp: (timestamp: string) => void;
}

export const useMeetingStore = create<MeetingStoreState>((set) => ({
  viewMode: 'today',
  selectedSource: 'all',
  searchQuery: '',
  selectedDate: new Date().toISOString(),
  isSyncing: false,
  lastSyncedTimestamp: null,

  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedSource: (selectedSource) => set({ selectedSource }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  setLastSyncedTimestamp: (lastSyncedTimestamp) => set({ lastSyncedTimestamp }),
}));
