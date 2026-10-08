import { create } from 'zustand';

interface AlarmStoreState {
  isConfiguringAlarm: boolean;
  activeMeetingId: string | null;
  selectedOffsets: number[];

  // Actions
  openAlarmConfig: (meetingId: string, currentOffsets: number[]) => void;
  closeAlarmConfig: () => void;
  toggleOffset: (offset: number) => void;
  setOffsets: (offsets: number[]) => void;
}

export const useAlarmStore = create<AlarmStoreState>((set) => ({
  isConfiguringAlarm: false,
  activeMeetingId: null,
  selectedOffsets: [15],

  openAlarmConfig: (meetingId, currentOffsets) =>
    set({
      isConfiguringAlarm: true,
      activeMeetingId: meetingId,
      selectedOffsets: currentOffsets.length > 0 ? currentOffsets : [15],
    }),

  closeAlarmConfig: () =>
    set({
      isConfiguringAlarm: false,
      activeMeetingId: null,
    }),

  toggleOffset: (offset) =>
    set((state) => {
      const exists = state.selectedOffsets.includes(offset);
      const updated = exists
        ? state.selectedOffsets.filter((o) => o !== offset)
        : [...state.selectedOffsets, offset].sort((a, b) => a - b);
      return { selectedOffsets: updated };
    }),

  setOffsets: (selectedOffsets) => set({ selectedOffsets }),
}));
