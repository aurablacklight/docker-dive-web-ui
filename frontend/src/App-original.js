import React, { useState, useEffect } from 'react';
import SearchBar from './components/SearchBar';
import ImageCard from './components/ImageCard';
import InspectionView from './components/InspectionView';
import LoadingSpinner from './components/LoadingSpinner';
import { searchImages, inspectImage } from './services/api';
import { Search, ArrowLeft, AlertCircle } from 'lucide-react';
import './styles/simple.css';

function App() {
  // State management
  const [currentView, setCurrentView] = useState('search'); // 'search' | 'inspect'
  const [images, setImages] = useState([]);
  const [currentImage, setCurrentImage] = useState(null);
  const [layers, setLayers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [popularImages, setPopularImages] = useState([]);

  // Load popular images on component mount
  useEffect(() => {
    loadPopularImages();
  }, []);

  const loadPopularImages = async () => {
    try {
      setSearchLoading(true);
      const popular = await searchImages('nginx', true); // Get popular images
      setPopularImages(popular.slice(0, 8)); // Show top 8
    } catch (err) {
      console.error('Failed to load popular images:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) return;
    
    try {
      setSearchLoading(true);
      setError(null);
      const results = await searchImages(query);
      setImages(results);
    } catch (err) {
      setError('Failed to search images. Please try again.');
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInspect = async (imageName) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentImage(imageName);
      setCurrentView('inspect');
      
      const analysis = await inspectImage(imageName);
      setLayers(analysis.layers || []);
    } catch (err) {
      setError(`Failed to inspect image: ${imageName}. ${err.message}`);
      setCurrentView('search');
      console.error('Inspection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setCurrentView('search');
    setCurrentImage(null);
    setLayers([]);
    setError(null);
  };

  const renderSearchView = () => (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <Search className="w-12 h-12 text-white mr-4" />
            <h1 className="text-5xl font-bold text-white">
              Dive Inspector
            </h1>
          </div>
          <p className="text-xl text-white text-opacity-80 max-w-2xl mx-auto">
            Analyze Docker images layer by layer. Search Docker Hub, pull images, 
            and discover optimization opportunities with beautiful visualizations.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-12">
          <SearchBar onSearch={handleSearch} loading={searchLoading} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="glass-card mb-8 border-red-400 bg-red-500 bg-opacity-20">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-300 mr-3" />
              <p className="text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Search Results */}
        {images.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-white mb-6">
              Search Results
            </h2>
            <div className="image-grid">
              {images.map((image, index) => (
                <ImageCard
                  key={`${image.name}-${index}`}
                  image={image}
                  onInspect={handleInspect}
                />
              ))}
            </div>
          </div>
        )}

        {/* Popular Images */}
        {popularImages.length > 0 && images.length === 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-white mb-6">
              Popular Images
            </h2>
            {searchLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="large" />
              </div>
            ) : (
              <div className="image-grid">
                {popularImages.map((image, index) => (
                  <ImageCard
                    key={`popular-${image.name}-${index}`}
                    image={image}
                    onInspect={handleInspect}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!searchLoading && images.length === 0 && popularImages.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-20 h-20 text-white text-opacity-50 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-white text-opacity-70 mb-3">
              Start Exploring
            </h3>
            <p className="text-white text-opacity-60 max-w-md mx-auto">
              Search for Docker images above to begin analyzing their layers 
              and discovering optimization opportunities.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderInspectionView = () => (
    <div className="min-h-screen">
      {/* Header */}
      <div className="glass bg-opacity-5 border-b border-white border-opacity-20 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={handleBack}
              className="glass-button mr-6 flex items-center hover:bg-opacity-25"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Search
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">
                Analyzing: {currentImage}
              </h1>
              <p className="text-white text-opacity-70">
                Layer-by-layer breakdown and efficiency analysis
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Inspection Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <LoadingSpinner size="large" />
              <p className="text-white text-lg mt-6">
                Pulling and analyzing image...
              </p>
              <p className="text-white text-opacity-70 mt-2">
                This may take a few minutes for large images
              </p>
            </div>
          ) : error ? (
            <div className="glass-card border-red-400 bg-red-500 bg-opacity-20 text-center py-12">
              <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-red-300 mb-2">
                Analysis Failed
              </h3>
              <p className="text-red-300 mb-6">{error}</p>
              <button
                onClick={handleBack}
                className="glass-button border-red-400 text-red-300 hover:bg-red-500 hover:bg-opacity-20"
              >
                Back to Search
              </button>
            </div>
          ) : (
            <InspectionView
              image={currentImage}
              layers={layers}
              onBack={handleBack}
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="App">
      {currentView === 'search' ? renderSearchView() : renderInspectionView()}
    </div>
  );
}

export default App;
