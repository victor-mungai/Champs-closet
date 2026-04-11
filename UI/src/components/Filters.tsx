import { Filter, Search } from 'lucide-react';

const Filters = ({
  categories,
  selectedCategory,
  onCategoryChange,
  tags,
  selectedTags,
  onToggleTag,
  search,
  onSearch,
}: {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  tags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  search: string;
  onSearch: (value: string) => void;
}) => (
  <aside className="w-full lg:w-64 shrink-0 space-y-8">
    <div>
      <div className="relative mb-6">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-surface-container-low pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <h3 className="font-medium mb-4 flex items-center gap-2"><Filter className="w-4 h-4" /> Categories</h3>
      <ul className="space-y-3 text-sm text-on-surface-variant">
        {categories.map((cat) => (
          <li key={cat}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="category"
                className="border-outline-variant text-primary focus:ring-primary"
                checked={selectedCategory === cat}
                onChange={() => onCategoryChange(cat)}
              />
              {cat}
            </label>
          </li>
        ))}
      </ul>
    </div>
    <div>
      <h3 className="font-medium mb-4">Style Profile</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            onClick={() => onToggleTag(tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              selectedTags.includes(tag) ? 'bg-primary text-on-primary' : 'bg-surface-container-low hover:bg-surface-container-high'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  </aside>
);

export default Filters;
