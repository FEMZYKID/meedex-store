'use client';

interface CategoryFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categories: string[]; // 'All' should be the first entry
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export default function CategoryFilterBar({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterBarProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-6 shadow-lg space-y-3">
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search items by name or SKU code..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 pl-10 pr-16 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-700">
        {categories.map((cat) => {
          const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition cursor-pointer border ${
                isSelected
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}