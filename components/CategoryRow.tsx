'use client';

import type { Category } from '../types';

interface CategoryRowProps {
  cat: Category;
  indent: boolean;
  hasChildren: boolean;
  categoryList: Category[];
  possibleParents: Category[];
  categoryRenameId: string | null;
  categoryRenameValue: string;
  savingCategory: boolean;
  setCategoryRenameId: (id: string | null) => void;
  setCategoryRenameValue: (value: string) => void;
  onMove: (cat: Category, direction: 'up' | 'down') => void;
  onRename: (id: string, oldName: string) => void;
  onDelete: (id: string, name: string) => void;
  onChangeParent: (id: string, newParentId: string | null) => void;
}

export default function CategoryRow({
  cat,
  indent,
  hasChildren,
  categoryList,
  possibleParents,
  categoryRenameId,
  categoryRenameValue,
  savingCategory,
  setCategoryRenameId,
  setCategoryRenameValue,
  onMove,
  onRename,
  onDelete,
  onChangeParent,
}: CategoryRowProps) {
  const siblings = categoryList
    .filter((c) => (c.parent_id || null) === (cat.parent_id || null))
    .sort((a, b) => a.sort_order - b.sort_order);
  const index = siblings.findIndex((c) => c.id === cat.id);
  const isRenaming = categoryRenameId === cat.id;

  return (
    <div
      className={`bg-slate-800/50 border border-slate-700 rounded-lg p-2 flex flex-wrap items-center gap-2 ${
        indent ? 'ml-5' : ''
      }`}
    >
      <div className="flex flex-col">
        <button
          type="button"
          disabled={index <= 0 || savingCategory}
          onClick={() => onMove(cat, 'up')}
          className="text-slate-400 hover:text-cyan-400 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-[10px] leading-none"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={index === -1 || index === siblings.length - 1 || savingCategory}
          onClick={() => onMove(cat, 'down')}
          className="text-slate-400 hover:text-cyan-400 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer text-[10px] leading-none"
        >
          ▼
        </button>
      </div>

      {isRenaming ? (
        <input
          type="text"
          autoFocus
          value={categoryRenameValue}
          onChange={(e) => setCategoryRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRename(cat.id, cat.name);
            if (e.key === 'Escape') setCategoryRenameId(null);
          }}
          className="flex-1 min-w-[80px] bg-slate-950 border border-cyan-500 rounded p-1.5 text-xs text-white focus:outline-none"
        />
      ) : (
        <span className="flex-1 min-w-[80px] text-xs text-slate-200">
          {indent ? '↳ ' : ''}
          {cat.name}
        </span>
      )}

      {hasChildren ? (
        <span className="text-[10px] text-slate-500 italic">has subcategories</span>
      ) : (
        <select
          value={cat.parent_id || ''}
          disabled={savingCategory}
          onChange={(e) => onChangeParent(cat.id, e.target.value || null)}
          title="Move under a parent category"
          className="bg-slate-950 border border-slate-700 rounded text-[10px] text-slate-300 px-1 py-1 max-w-[110px] focus:outline-none focus:border-cyan-500"
        >
          <option value="">Top level</option>
          {possibleParents
            .filter((p) => p.id !== cat.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                Under: {p.name}
              </option>
            ))}
        </select>
      )}

      {isRenaming ? (
        <>
          <button
            type="button"
            disabled={savingCategory}
            onClick={() => onRename(cat.id, cat.name)}
            className="text-emerald-400 hover:underline cursor-pointer text-[11px]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setCategoryRenameId(null)}
            className="text-slate-400 hover:underline cursor-pointer text-[11px]"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setCategoryRenameId(cat.id);
              setCategoryRenameValue(cat.name);
            }}
            className="text-cyan-400 hover:underline cursor-pointer text-[11px]"
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => onDelete(cat.id, cat.name)}
            className="text-rose-400 hover:underline cursor-pointer text-[11px]"
          >
            Delete
          </button>
        </>
      )}
    </div>
  );
}