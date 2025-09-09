import { useState } from 'react';
import PropTypes from 'prop-types';
import { Search, Loader2 } from 'lucide-react';

const SearchBar = ({ onSearch, loading = false }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !loading) {
      onSearch(query.trim());
    }
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      <div className="relative glass-card p-2">
        <div className="flex items-center">
          <div className="flex-shrink-0 pl-4">
            <Search className="w-6 h-6 text-white text-opacity-70" />
          </div>
          
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Search Docker images (e.g., nginx, node, ubuntu)..."
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white placeholder-opacity-60 px-4 py-3 text-lg"
            disabled={loading}
          />
          
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="flex-shrink-0 glass-button ml-2 mr-2 px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Searching...
              </div>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>
      
      {/* Search suggestions */}
      <div className="mt-4 text-center">
        <p className="text-white text-opacity-60 text-sm mb-2">
          Popular searches:
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {['nginx', 'node', 'ubuntu', 'postgres', 'redis', 'python'].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => !loading && onSearch(suggestion)}
              disabled={loading}
              className="glass px-3 py-1 text-sm text-white text-opacity-80 rounded-full hover:bg-opacity-20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
};

SearchBar.propTypes = {
  onSearch: PropTypes.func.isRequired,
  loading: PropTypes.bool
};

export default SearchBar;
