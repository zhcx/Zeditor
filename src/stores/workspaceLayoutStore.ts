import { create } from 'zustand';

export type SplitOrientation = 'horizontal' | 'vertical';
interface WorkspaceLayoutState {
  enabled: boolean;
  secondaryTabId: string | null;
  orientation: SplitOrientation;
  ratio: number;
  enableSplit: (tabId: string) => void;
  disableSplit: () => void;
  toggleSplit: (tabId: string) => void;
  setSecondaryTab: (tabId: string) => void;
  setOrientation: (orientation: SplitOrientation) => void;
  setRatio: (ratio: number) => void;
}

const STORAGE_KEY = 'zeditor.workspace-layout.v1';
function loadLayout(): Pick<WorkspaceLayoutState, 'enabled' | 'secondaryTabId' | 'orientation' | 'ratio'> {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (value && typeof value === 'object') return {
      enabled: Boolean(value.enabled),
      secondaryTabId: typeof value.secondaryTabId === 'string' ? value.secondaryTabId : null,
      orientation: value.orientation === 'vertical' ? 'vertical' : 'horizontal',
      ratio: typeof value.ratio === 'number' ? Math.min(0.75, Math.max(0.25, value.ratio)) : 0.5,
    };
  } catch { /* 本地布局损坏时回退默认值 */ }
  return { enabled: false, secondaryTabId: null, orientation: 'horizontal', ratio: 0.5 };
}

export const useWorkspaceLayoutStore = create<WorkspaceLayoutState>((set, get) => ({
  ...loadLayout(),
  enableSplit: tabId => set({ enabled: true, secondaryTabId: tabId }),
  disableSplit: () => set({ enabled: false }),
  toggleSplit: tabId => set({ enabled: !get().enabled, secondaryTabId: tabId }),
  setSecondaryTab: tabId => set({ secondaryTabId: tabId }),
  setOrientation: orientation => set({ orientation }),
  setRatio: ratio => set({ ratio: Math.min(0.75, Math.max(0.25, ratio)) }),
}));

useWorkspaceLayoutStore.subscribe((state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      enabled: state.enabled,
      secondaryTabId: state.secondaryTabId,
      orientation: state.orientation,
      ratio: state.ratio,
    }));
  } catch { /* 隐私模式或配额不足时保留内存布局 */ }
});
