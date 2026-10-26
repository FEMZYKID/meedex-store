'use client';

import type { useCategoryBrowser } from '../hooks/useCategoryBrowser';
import { otherKey } from '../lib/categorySections';

type Browser = ReturnType<typeof useCategoryBrowser>;

interface Props {
  browser: Browser;
  variant: 'store' | 'dark';
  showSearch?: boolean;
  searchPlaceholder?: string;
}

const STYLES = {
  store: {
    searchBox: '',
    mainRow: 'flex gap-2 overflow-x-auto pb-3 border-b border-gray-200',
    chip: 'px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition',
    active: 'bg-amber-500 text-slate-900 shadow-sm',
    idle: 'bg-white text-gray-700 hover:bg-gray-200 border',
    subRow: 'flex gap-2 overflow-x-auto pt-3 pb-4 mb-2',
    subChip: 'px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition',
    subActive: 'bg-indigo-800 text-white',
    subIdle: 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100',
  },
  dark: {
    searchBox:
      'w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 mb-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500',
    mainRow: 'flex gap-2 overflow-x-auto pb-2',
    chip: 'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition cursor-pointer',
    active: 'bg-cyan-500 text-slate-950 border-cyan-500',
    idle: 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-700',
    subRow: 'flex gap-2 overflow-x-auto pt-1 pb-3',
    subChip: 'px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap border transition cursor-pointer',
    subActive: 'bg-indigo-500 text-white border-indigo-500',
    subIdle: 'bg-slate-900 text-indigo-300 border-indigo-500/30 hover:bg-slate-700',
  },
} as const;

export default function CategoryBrowserBar({
  browser,
  variant,
  showSearch = false,
  searchPlaceholder = 'Search products by name or SKU...',
}: Props) {
  const s = STYLES[variant];
  const { tree, selectedParent, selectedLeaf, activeParent, otherParentIds } = browser;

  return (
    <div>
      {showSearch && (
        <input
          type="text"
          value={browser.search}
          onChange={(e) => browser.setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className={s.searchBox}
        />
      )}

      <div className={s.mainRow}>
        <button
          type="button"
          onClick={browser.selectAll}
          className={`${s.chip} ${!selectedParent ? s.active : s.idle}`}
        >
          All
        </button>
        {tree.map((parent) => (
          <button
            key={parent.id}
            type="button"
            onClick={() => browser.selectParent(parent.id)}
            className={`${s.chip} ${selectedParent === parent.id ? s.active : s.idle}`}
          >
            {parent.name}
          </button>
        ))}
      </div>

      {activeParent && activeParent.children.length > 0 && (
        <div className={s.subRow}>
          <button
            type="button"
            onClick={() => browser.selectLeaf(null)}
            className={`${s.subChip} ${!selectedLeaf ? s.subActive : s.subIdle}`}
          >
            All {activeParent.name}
          </button>
          {activeParent.children.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => browser.selectLeaf(child.id)}
              className={`${s.subChip} ${selectedLeaf === child.id ? s.subActive : s.subIdle}`}
            >
              {child.name}
            </button>
          ))}
          {otherParentIds.has(activeParent.id) && (
            <button
              type="button"
              onClick={() => browser.selectLeaf(otherKey(activeParent.id))}
              className={`${s.subChip} ${
                selectedLeaf === otherKey(activeParent.id) ? s.subActive : s.subIdle
              }`}
            >
              Other {activeParent.name}
            </button>
          )}
        </div>
      )}
    </div>
  );
}