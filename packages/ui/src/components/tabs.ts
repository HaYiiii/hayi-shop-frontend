import { TabsCount, TabsList, TabsPanel, TabsRoot, TabsTab } from "./tabs.client.js";

/**
 * Switch between sibling groups on one screen. Control `value` from the URL
 * (`?status=PENDING`) so the selected tab can be deep-linked.
 */
export const Tabs = { Root: TabsRoot, List: TabsList, Tab: TabsTab, Count: TabsCount, Panel: TabsPanel };
