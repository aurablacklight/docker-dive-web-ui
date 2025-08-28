import React, { useState, useEffect } from 'react';
import { inspectImage, searchImages } from './services/api';
import './styles/simple.css';

function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentView, setCurrentView] = useState('search'); // 'search' | 'inspect'
  const [currentImage, setCurrentImage] = useState(null);
  const [inspectionData, setInspectionData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [images, setImages] = useState([]);
  const [expandedLayers, setExpandedLayers] = useState(new Set()); // Track expanded layers
  const [allLayersExpanded, setAllLayersExpanded] = useState(false);

  // Popular images to show by default
  const popularImages = [
    { name: 'nginx', description: 'Official build of Nginx' },
    { name: 'postgres', description: 'Official PostgreSQL database' },
    { name: 'node', description: 'Official Node.js runtime' },
    { name: 'redis', description: 'Official Redis cache' },
    { name: 'mysql', description: 'Official MySQL database' },
    { name: 'mongo', description: 'Official MongoDB database' },
    { name: 'python', description: 'Official Python runtime' },
    { name: 'ubuntu', description: 'Official Ubuntu base image' }
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      const results = await searchImages(searchQuery);
      setImages(results);
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInspect = async (imageName) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentView('inspect');
      setCurrentImage(imageName);
      
      console.log(`Inspecting image: ${imageName}`);
      const result = await inspectImage(imageName);
      console.log('Full inspection result:', result);
      console.log('Analysis data:', result.analysis);
      console.log('Available keys:', Object.keys(result));
      setInspectionData(result);
    } catch (err) {
      setError(`Inspection failed: ${err.message}`);
      console.error('Inspection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const backToSearch = () => {
    setCurrentView('search');
    setCurrentImage(null);
    setInspectionData(null);
    setError(null);
    setExpandedLayers(new Set()); // Reset expanded layers
    setAllLayersExpanded(false);
  };

  // Layer expansion handlers
  const toggleLayer = (layerId) => {
    const newExpanded = new Set(expandedLayers);
    if (newExpanded.has(layerId)) {
      newExpanded.delete(layerId);
    } else {
      newExpanded.add(layerId);
    }
    setExpandedLayers(newExpanded);
  };

  const toggleAllLayers = () => {
    if (allLayersExpanded) {
      // Collapse all
      setExpandedLayers(new Set());
      setAllLayersExpanded(false);
    } else {
      // Expand all
      const allLayerIds = new Set();
      inspectionData?.analysis?.layers?.forEach((layer, index) => {
        allLayerIds.add(layer.id || index);
      });
      setExpandedLayers(allLayerIds);
      setAllLayersExpanded(true);
    }
  };

  if (currentView === 'inspect') {
    return (
      <div className="app-container">
        <header className="app-header">
          <button onClick={backToSearch} className="back-button">
            ← Back to Search
          </button>
          <h1 className="app-title">Analyzing: {currentImage}</h1>
          <p className="app-subtitle">Layer-by-layer breakdown and efficiency analysis</p>
        </header>
        
        {loading && (
          <div className="loading-screen">
            <div className="spinner"></div>
            <p>Analyzing image layers...</p>
          </div>
        )}
        
        {error && (
          <div className="error-screen">
            <h2>Error</h2>
            <p>{error}</p>
            <button onClick={backToSearch}>Back to Search</button>
          </div>
        )}
        
        {inspectionData && (
          <>
            {inspectionData.analysis?.is_cat_fallback ? (
              <main className="main-content">
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '80vh',
                  padding: '20px'
                }}>
                  <h2 style={{ 
                    color: '#fff', 
                    textAlign: 'center', 
                    marginBottom: '20px',
                    fontSize: '2rem'
                  }}>
                    {inspectionData.analysis.message || "Here's a cat instead! 🐱"}
                  </h2>
                  <div style={{
                    maxWidth: '90vw',
                    maxHeight: '70vh',
                    borderRadius: '15px',
                    overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                  }}>
                    <img 
                      src={inspectionData.analysis.results?.[0]?.cat_image_url || inspectionData.analysis.layers?.[0]?.cat_data?.image_url} 
                      alt="Cute cat fallback"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                      onError={(e) => {
                        // Fallback to a different cat if the first one fails
                        e.target.src = 'https://cataas.com/cat?type=square&width=600&height=450';
                      }}
                    />
                  </div>
                  <p style={{ 
                    color: '#aaa', 
                    textAlign: 'center', 
                    marginTop: '20px',
                    fontSize: '1.2rem'
                  }}>
                    {inspectionData.analysis.cat_message || "The original image couldn't be analyzed, but this cat is much cuter anyway! 🐾"}
                  </p>
                </div>
              </main>
            ) : (
              <main className="main-content">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-icon">📦</div>
                <div className="metric-value">{inspectionData.analysis?.analysis?.totalLayers || 0}</div>
                <div className="metric-label">Total Layers</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">💾</div>
                <div className="metric-value">{formatBytes(inspectionData.analysis?.analysis?.totalSize || 0)}</div>
                <div className="metric-label">Total Size</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">⚠️</div>
                <div className="metric-value">{formatBytes(inspectionData.analysis?.analysis?.wastedSpace || 0)}</div>
                <div className="metric-label">Wasted Space</div>
              </div>
              
              <div className="metric-card">
                <div className="metric-icon">⚡</div>
                <div className="metric-value">{inspectionData.analysis?.analysis?.efficiency || 0}%</div>
                <div className="metric-label">Efficiency</div>
              </div>
            </div>
            
            <div className="analysis-section">
              <h2>⚡ Efficiency Analysis</h2>
              <div className="efficiency-details">
                <p>Needs Optimization</p>
                <p>Efficiency Score: {inspectionData.analysis?.analysis?.efficiency || 0}% ({formatBytes(inspectionData.analysis?.analysis?.userDataInImage || 0)} useful / {formatBytes(inspectionData.analysis?.analysis?.totalSize || 0)} total)</p>
                <p>Potential Savings: {formatBytes(inspectionData.analysis?.analysis?.wastedSpace || 0)} ({((inspectionData.analysis?.analysis?.wastedSpace || 0) / (inspectionData.analysis?.analysis?.totalSize || 1) * 100).toFixed(1)}% reduction possible)</p>
              </div>
            </div>
            
            <div className="layers-section">
              <div className="layers-header">
                <h2>🔍 Layer Breakdown</h2>
                <button 
                  className="expand-toggle-btn" 
                  onClick={toggleAllLayers}
                  title={allLayersExpanded ? "Collapse All Commands" : "Expand All Commands"}
                >
                  {allLayersExpanded ? '📁 Collapse All' : '📂 Expand All'}
                </button>
              </div>
              <div className="layers-list">
                {inspectionData.analysis?.layers?.map((layer, index) => {
                  const layerId = layer.id || index;
                  const isExpanded = expandedLayers.has(layerId);
                  const hasLongCommand = (layer.command || '').length > 100;
                  
                  return (
                    <div key={layerId} className="layer-item">
                      <div className="layer-header">
                        <span className="layer-index">#{index + 1}</span>
                        <span className="layer-size">{formatBytes(layer.size || 0)}</span>
                        <span className="layer-efficiency">{layer.efficiency || 0}%</span>
                      </div>
                      <div className="layer-command-container">
                        {hasLongCommand && (
                          <button 
                            className="command-toggle-btn"
                            onClick={() => toggleLayer(layerId)}
                            title={isExpanded ? "Collapse command" : "Expand command"}
                          >
                            <span className={`arrow ${isExpanded ? 'expanded' : ''}`}>▶</span>
                            {isExpanded ? 'Hide full command' : 'Show full command'}
                          </button>
                        )}
                        <div className={`layer-command ${isExpanded ? 'expanded' : ''}`}>
                          {formatCommand(layer.command || 'Unknown command', isExpanded)}
                        </div>
                      </div>
                      {layer.wasted_size > 0 && (
                        <div className="layer-waste">⚠️ {formatBytes(layer.wasted_size)} wasted</div>
                      )}
                    </div>
                  );
                }) || []}
              </div>
            </div>
          </main>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">🐋 Dive Docker Image Inspector</h1>
        <p className="app-subtitle">Analyze Docker images layer by layer</p>
      </header>
      
      <main className="main-content">
        <div className="search-container">
          <input 
            type="text" 
            className="search-input"
            placeholder="Search for Docker images (e.g., nginx, postgres, node...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button className="search-button" onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}
        
        <div className="popular-section">
          <h2>Popular Images</h2>
          <div className="image-grid">
            {popularImages.map((image) => (
              <div key={image.name} className="image-card" onClick={() => handleInspect(image.name)}>
                <h3>{image.name}</h3>
                <p>{image.description}</p>
                <button className="inspect-button">Pull and Inspect</button>
              </div>
            ))}
          </div>
        </div>
        
        {images.length > 0 && (
          <div className="search-results">
            <h2>Search Results</h2>
            <div className="image-grid">
              {images.map((image) => (
                <div key={image.name} className="image-card" onClick={() => handleInspect(image.name)}>
                  <h3>{image.name}</h3>
                  <p>{image.description}</p>
                  <button className="inspect-button">Pull and Inspect</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper function to format Docker commands for better readability
function formatCommand(command, isExpanded = false) {
  if (!command) return 'Unknown command';
  
  if (isExpanded) {
    // Show full command with proper line breaks for readability
    return command
      .replace(/&&/g, '\n  &&')
      .replace(/\|\|/g, '\n  ||')
      .replace(/;/g, ';\n  ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  // Show truncated version
  if (command.length <= 100) return command;
  
  // Split and show first line with truncation indicator
  const firstLine = command.split(/&&|\|\|/)[0].trim();
  if (firstLine.length > 80) {
    return firstLine.substring(0, 77) + '...';
  }
  return firstLine + ' ...';
}

export default App;
