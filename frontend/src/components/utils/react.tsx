import { Fragment, createElement, useEffect, useRef, useState } from 'react';

/** React component that renders its children client-side only / after first mount */
export const ClientOnly = ({ children }: any) => {
  const hasMounted = useClientOnly();

  if (!hasMounted) {
    return null;
  }

  // eslint-disable-next-line react/no-children-prop
  return createElement(Fragment, { children });
};

/** React hook that returns true if the component has mounted client-side */
export const useClientOnly = () => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return hasMounted;
};

/** Tabs where each panel only mounts on first visit, and the active *position* (not id) is kept when `ids` changes entirely, falling back to the first tab if that position no longer exists */
export function useLazyTabs(ids: string[]) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set());
  const previousIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (ids.length < 1) return;
    if (activeTab != null && ids.includes(activeTab)) {
      previousIdsRef.current = ids;
      return;
    }
    const previousIndex = previousIdsRef.current.indexOf(activeTab ?? '');
    const nextIndex = previousIndex >= 0 && previousIndex < ids.length ? previousIndex : 0;
    previousIdsRef.current = ids;
    setActiveTab(ids[nextIndex]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')]);

  useEffect(() => {
    if (activeTab == null || visitedTabs.has(activeTab)) return;
    setVisitedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab, visitedTabs]);

  return { activeTab, setActiveTab, visitedTabs };
}
