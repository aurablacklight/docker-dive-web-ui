import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import LayerItem from './LayerItem';
import { 
  BarChart3, 
  PieChart, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Layers,
  HardDrive,
  Zap,
  Filter
} from 'lucide-react';

const InspectionView = ({ image, layers, onBack }) => {
  const [selectedLayer, setSelectedLayer] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'large', 'wasted', 'efficient'

  // Calculate overall metrics
  const metrics = useMemo(() => {
    if (!layers || layers.length === 0) {
      return {
        totalSize: 0,
        totalLayers: 0,
        wastedSpace: 0,
        efficiency: 0,
        largestLayer: null
      };
    }

    const totalSize = layers.reduce((sum, layer) => sum + (layer.size || 0), 0);
    const wastedSpace = layers.reduce((sum, layer) => sum + (layer.wasted_size || 0), 0);
    const efficiency = totalSize > 0 ? ((totalSize - wastedSpace) / totalSize) * 100 : 0;
    const largestLayer = layers.reduce((max, layer) => 
      (layer.size || 0) > (max?.size || 0) ? layer : max, null
    );

    return {
      totalSize,
      totalLayers: layers.length,
      wastedSpace,
      efficiency,
      largestLayer
    };
  }, [layers]);

  // Filter layers based on selected filter
  const filteredLayers = useMemo(() => {
    if (!layers) return [];
    
    switch (filterType) {
      case 'large':
        return layers.filter(layer => (layer.size || 0) > metrics.totalSize * 0.1);
      case 'wasted':
        return layers.filter(layer => (layer.wasted_size || 0) > 0);
      case 'efficient':
        return layers.filter(layer => (layer.efficiency || 0) >= 90);
      default:
        return layers;
    }
  }, [layers, filterType, metrics.totalSize]);

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getEfficiencyStatus = (efficiency) => {
    if (efficiency >= 90) return { color: 'text-green-400', icon: CheckCircle, label: 'Excellent' };
    if (efficiency >= 70) return { color: 'text-yellow-400', icon: AlertTriangle, label: 'Good' };
    return { color: 'text-red-400', icon: AlertTriangle, label: 'Needs Optimization' };
  };

  const handleLayerClick = (layer, index) => {
    setSelectedLayer(selectedLayer?.index === index ? null : { ...layer, index });
  };

  const efficiencyStatus = getEfficiencyStatus(metrics.efficiency);

  return (
    <div className="space-y-6">
      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card text-center">
          <div className="flex items-center justify-center mb-3">
            <Layers className="w-8 h-8 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">{metrics.totalLayers}</div>
          <div className="text-white text-opacity-60">Total Layers</div>
        </div>

        <div className="glass-card text-center">
          <div className="flex items-center justify-center mb-3">
            <HardDrive className="w-8 h-8 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatSize(metrics.totalSize)}</div>
          <div className="text-white text-opacity-60">Total Size</div>
        </div>

        <div className="glass-card text-center">
          <div className="flex items-center justify-center mb-3">
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-white">{formatSize(metrics.wastedSpace)}</div>
          <div className="text-white text-opacity-60">Wasted Space</div>
        </div>

        <div className="glass-card text-center">
          <div className="flex items-center justify-center mb-3">
            <efficiencyStatus.icon className={`w-8 h-8 ${efficiencyStatus.color}`} />
          </div>
          <div className={`text-2xl font-bold ${efficiencyStatus.color}`}>
            {metrics.efficiency.toFixed(1)}%
          </div>
          <div className="text-white text-opacity-60">Efficiency</div>
        </div>
      </div>

      {/* Efficiency Summary */}
      <div className="glass-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Zap className="w-6 h-6 mr-3 text-yellow-400" />
            Efficiency Analysis
          </h3>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            metrics.efficiency >= 90 ? 'bg-green-500 bg-opacity-20 text-green-300' :
            metrics.efficiency >= 70 ? 'bg-yellow-500 bg-opacity-20 text-yellow-300' :
            'bg-red-500 bg-opacity-20 text-red-300'
          }`}>
            {efficiencyStatus.label}
          </span>
        </div>
        
        <div className="space-y-3">
          <div className="progress-bar">
            <div 
              className={`h-full rounded-full transition-all duration-300 ${
                metrics.efficiency >= 90 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                metrics.efficiency >= 70 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                'bg-gradient-to-r from-red-400 to-red-500'
              }`}
              style={{ width: `${Math.min(metrics.efficiency, 100)}%` }}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="text-white text-opacity-80">
              <strong>Efficiency Score:</strong> {metrics.efficiency.toFixed(1)}% 
              ({formatSize(metrics.totalSize - metrics.wastedSpace)} useful / {formatSize(metrics.totalSize)} total)
            </div>
            <div className="text-white text-opacity-80">
              <strong>Potential Savings:</strong> {formatSize(metrics.wastedSpace)} 
              ({((metrics.wastedSpace / metrics.totalSize) * 100).toFixed(1)}% reduction possible)
            </div>
          </div>
        </div>
      </div>

      {/* Layer Analysis */}
      <div className="analysis-layout">
        {/* Layers List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white flex items-center">
              <BarChart3 className="w-6 h-6 mr-3 text-blue-400" />
              Layer Breakdown
            </h3>
            
            {/* Filter Options */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-white text-opacity-60" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="glass px-3 py-1 text-sm rounded bg-white bg-opacity-10 border border-white border-opacity-20 text-white"
              >
                <option value="all">All Layers</option>
                <option value="large">Large Layers (&gt;10%)</option>
                <option value="wasted">Layers with Waste</option>
                <option value="efficient">Efficient Layers (&gt;90%)</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 custom-scrollbar max-h-96 overflow-y-auto">
            {filteredLayers.length > 0 ? (
              filteredLayers.map((layer, index) => (
                <LayerItem
                  key={layer.id || index}
                  layer={layer}
                  index={index}
                  isSelected={selectedLayer?.index === index}
                  onClick={handleLayerClick}
                />
              ))
            ) : (
              <div className="glass-card text-center py-8">
                <Info className="w-12 h-12 text-white text-opacity-50 mx-auto mb-3" />
                <p className="text-white text-opacity-70">
                  No layers match the current filter
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Layer Details */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <PieChart className="w-6 h-6 mr-3 text-green-400" />
            Layer Details
          </h3>

          {selectedLayer ? (
            <div className="glass-card">
              <div className="space-y-4">
                <div className="border-b border-white border-opacity-20 pb-4">
                  <h4 className="text-lg font-semibold text-white mb-2">
                    Layer {selectedLayer.index + 1}
                  </h4>
                  <div className="command-text">
                    {selectedLayer.command || 'No command available'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-white text-opacity-60">Size:</span>
                    <div className="text-white font-medium">{formatSize(selectedLayer.size)}</div>
                  </div>
                  <div>
                    <span className="text-white text-opacity-60">Wasted:</span>
                    <div className="text-white font-medium">{formatSize(selectedLayer.wasted_size)}</div>
                  </div>
                  <div>
                    <span className="text-white text-opacity-60">Efficiency:</span>
                    <div className={`font-medium ${getEfficiencyStatus(selectedLayer.efficiency).color}`}>
                      {selectedLayer.efficiency?.toFixed(1) || 0}%
                    </div>
                  </div>
                  <div>
                    <span className="text-white text-opacity-60">Files:</span>
                    <div className="text-white font-medium">{selectedLayer.file_count || 0}</div>
                  </div>
                </div>

                {selectedLayer.created && (
                  <div className="text-sm">
                    <span className="text-white text-opacity-60">Created:</span>
                    <div className="text-white">{new Date(selectedLayer.created).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card text-center py-12">
              <Layers className="w-16 h-16 text-white text-opacity-30 mx-auto mb-4" />
              <p className="text-white text-opacity-60">
                Select a layer to view detailed information
              </p>
            </div>
          )}

          {/* Optimization Suggestions */}
          {metrics.wastedSpace > 0 && (
            <div className="glass-card border-yellow-400 bg-yellow-500 bg-opacity-10">
              <h4 className="text-lg font-semibold text-yellow-300 mb-3 flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Optimization Suggestions
              </h4>
              <ul className="space-y-2 text-yellow-200 text-sm">
                <li>• Consider using multi-stage builds to reduce final image size</li>
                <li>• Remove unnecessary files and packages in the same RUN command</li>
                <li>• Use .dockerignore to exclude unwanted files</li>
                <li>• Combine RUN commands to reduce layer count</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

InspectionView.propTypes = {
  image: PropTypes.string.isRequired,
  layers: PropTypes.arrayOf(PropTypes.object).isRequired,
  onBack: PropTypes.func.isRequired
};

export default InspectionView;
