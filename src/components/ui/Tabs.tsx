/**
 * Accessible Tabs component — WCAG 2.1 SC 4.1.2 compliant.
 *
 * Each tab button has:
 *   - role="tab"
 *   - aria-selected={isActive}
 *   - aria-controls="panel-{id}"
 *   - id="tab-{id}"
 *
 * Each panel has:
 *   - role="tabpanel"
 *   - id="panel-{id}"
 *   - aria-labelledby="tab-{id}"
 *   - tabIndex={0} so it receives focus when activated
 *
 * The tab list handles ArrowLeft / ArrowRight keyboard navigation,
 * cycling focus and activating the adjacent tab.
 */
import React, {
  useEffect, useRef, createContext, useContext, useMemo,
} from 'react';

// ── Context ───────────────────────────────────────────────

interface TabsContextValue {
  activeId: string;
  setActiveId: (id: string) => void;
  ids: string[];
}

const TabsContext = createContext<TabsContextValue>({
  activeId: '',
  setActiveId: () => {},
  ids: [],
});

// ── Root ──────────────────────────────────────────────────

interface TabsProps {
  activeId: string;
  onChange: (id: string) => void;
  ids: string[];
  children: React.ReactNode;
  className?: string;
}

export const Tabs = ({
  activeId, onChange, ids, children, className,
}: TabsProps) => {
  const contextValue = useMemo(
    () => ({ activeId, setActiveId: onChange, ids }),
    [activeId, onChange, ids],
  );
  return (
    <TabsContext.Provider value={contextValue}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

// ── TabList ───────────────────────────────────────────────

interface TabListProps {
  children: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}

export const TabList = ({ children, className, 'aria-label': ariaLabel }: TabListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { ids, setActiveId } = useContext(TabsContext);

  useEffect(() => {
    const el = listRef.current;
    if (!el) { return undefined; }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') { return; }

      const tabs = Array.from(
        el.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      );
      const focusedIdx = tabs.findIndex((t) => t === document.activeElement);
      if (focusedIdx < 0) { return; }

      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (focusedIdx + delta + tabs.length) % tabs.length;
      const nextTab = tabs[nextIdx];
      nextTab.focus();

      // Activate the focused tab (follow-focus pattern)
      const nextId = ids[nextIdx];
      if (nextId !== undefined) {
        setActiveId(nextId);
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [ids, setActiveId]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </div>
  );
};

// ── Tab ───────────────────────────────────────────────────

interface TabProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
}

export const Tab = ({
  id, children, className, activeClassName,
}: TabProps) => {
  const { activeId, setActiveId } = useContext(TabsContext);
  const isActive = activeId === id;

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      tabIndex={isActive ? 0 : -1}
      className={`${className ?? ''}${isActive && activeClassName ? ` ${activeClassName}` : ''}`}
      onClick={() => setActiveId(id)}
    >
      {children}
    </button>
  );
};

// ── TabPanel ──────────────────────────────────────────────

interface TabPanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export const TabPanel = ({ id, children, className }: TabPanelProps) => {
  const { activeId } = useContext(TabsContext);
  const isActive = activeId === id;

  if (!isActive) { return null; }

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
};
