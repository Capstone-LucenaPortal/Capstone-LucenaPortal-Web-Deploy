"use client";

// src/portals/admin/components/ui/tabs.tsx
import { KeyboardEvent, useId, useRef } from "react";

interface TabItem {
  label: string;
  /** Optional per-tab count, rendered as "Label (count)". */
  count?: number;
}

interface TabsProps {
  // Backward-compatible: existing callers pass a plain string[]; a caller
  // that wants per-tab counts can pass TabItem[] instead. Tabs are matched
  // against `active` by their `label`, same as the old string-array shape.
  tabs: string[] | TabItem[];
  active: string;
  onChange: (tab: string) => void;
}

function normalizeTabs(tabs: string[] | TabItem[]): TabItem[] {
  return tabs.map((tab) => (typeof tab === "string" ? { label: tab } : tab));
}

// Real ARIA tablist, "automatic activation" pattern (WAI-ARIA Authoring
// Practices' simple tabs example): arrow keys move focus among tabs AND
// activate the newly focused tab immediately, rather than requiring a
// separate Enter/Space to commit selection. That matches how this component
// already behaved on click (activation is instant, no async panel content to
// debounce), so it's the least surprising choice here. Home/End jump to the
// first/last tab. Only the active tab sits in the natural Tab order
// (roving tabindex) — every inactive tab is tabIndex={-1} and reachable only
// via the arrow keys once the tablist has focus.
export function Tabs({ tabs, active, onChange }: TabsProps) {
  const items = normalizeTabs(tabs);
  const baseId = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusAndActivate(index: number) {
    const target = items[index];
    if (!target) return;
    onChange(target.label);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        focusAndActivate((index + 1) % items.length);
        break;
      case "ArrowLeft":
        event.preventDefault();
        focusAndActivate((index - 1 + items.length) % items.length);
        break;
      case "Home":
        event.preventDefault();
        focusAndActivate(0);
        break;
      case "End":
        event.preventDefault();
        focusAndActivate(items.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div role="tablist" className="flex gap-2 border-b border-gray-200 px-4">
      {items.map((item, index) => {
        const isActive = item.label === active;
        // NOTE: no caller currently renders a matching `role="tabpanel"`
        // element with this id — see Tabs.tsx's panel-linking note in the
        // task report. aria-controls is still wired up so a caller that adds
        // a panel gets the association for free, and screen readers that
        // don't resolve the id simply ignore the attribute.
        const panelId = `${baseId}-panel-${index}`;
        return (
          <button
            key={item.label}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`${baseId}-tab-${index}`}
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.label)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`rounded-none px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-900 focus-visible:ring-offset-2 ${
              isActive ? "bg-blue-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {item.count === undefined ? item.label : `${item.label} (${item.count})`}
          </button>
        );
      })}
    </div>
  );
}
