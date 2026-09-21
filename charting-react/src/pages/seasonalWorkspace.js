const STORAGE_KEY = "seasonalChartsWorkspace";

export function readWorkspace(isValidConfig) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.version !== 1 || !Array.isArray(stored.tabs)) return null;
    if (stored.tabs.length === 0) return { tabs: [], activeTab: null };
    const ids = new Set();
    const tabs = stored.tabs.filter((tab) => {
      if (!tab || typeof tab.id !== "string" || !tab.id || ids.has(tab.id) ||
          !["Long Term Charts", "History", "Calculator"].includes(tab.program) ||
          !isValidConfig(tab.config)) return false;
      ids.add(tab.id);
      return true;
    });
    const activeTab = tabs.find((tab) => tab.id === stored.activeTabId) ?? tabs.at(-1);
    return activeTab ? { tabs, activeTab } : null;
  } catch {
    return null;
  }
}

export function saveWorkspace(tabs, activeTabId) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tabs, activeTabId }));
  } catch {
    // Charts remain usable when browser storage is unavailable or full.
  }
}
