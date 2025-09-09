import PropTypes from 'prop-types';
import { Package, Settings, FileText, Tag, Hash, Clock } from 'lucide-react';

const LayerItem = ({ layer, index, isSelected, onClick }) => {
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatCommand = (command) => {
    if (!command) return 'No command';
    // Truncate long commands
    return command.length > 60 ? command.substring(0, 60) + '...' : command;
  };

  const getLayerIcon = (command = '') => {
    const cmd = command.toLowerCase();
    if (cmd.includes('from ') || cmd.includes('base')) {
      return <Package className="w-4 h-4 text-blue-400" />;
    }
    if (cmd.includes('run ')) {
      return <Settings className="w-4 h-4 text-green-400" />;
    }
    if (cmd.includes('copy ') || cmd.includes('add ')) {
      return <FileText className="w-4 h-4 text-yellow-400" />;
    }
    if (cmd.includes('label ') || cmd.includes('env ')) {
      return <Tag className="w-4 h-4 text-purple-400" />;
    }
    return <Hash className="w-4 h-4 text-gray-400" />;
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 90) return 'text-green-400';
    if (efficiency >= 70) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div
      onClick={() => onClick(layer, index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(layer, index);
        }
      }}
      role="button"
      tabIndex={0}
      className={`layer-item ${
        isSelected ? 'ring-2 ring-white ring-opacity-50 bg-opacity-20' : ''
      } transition-all duration-200`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-shrink-0 mr-3">
            {getLayerIcon(layer.command)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center mb-1">
              <span className="text-white text-opacity-60 text-sm mr-2">
                Layer {index + 1}
              </span>
              <span className="text-xs text-white text-opacity-40">
                {layer.id?.substring(0, 12) || 'unknown'}
              </span>
            </div>
            <div className="command-text text-xs">
              {formatCommand(layer.command)}
            </div>
          </div>
        </div>
        
        <div className="flex-shrink-0 text-right ml-4">
          <div className="text-white font-medium text-sm">
            {formatSize(layer.size)}
          </div>
          {layer.efficiency !== undefined && (
            <div className={`text-xs ${getEfficiencyColor(layer.efficiency)}`}>
              {layer.efficiency.toFixed(1)}% efficient
            </div>
          )}
        </div>
      </div>

      {/* Layer Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-white text-opacity-60">
        <div className="flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          {layer.created ? new Date(layer.created).toLocaleDateString() : 'Unknown'}
        </div>
        
        <div>
          Files: {layer.file_count || 0}
        </div>
        
        <div>
          {layer.wasted_size ? `Wasted: ${formatSize(layer.wasted_size)}` : 'No waste'}
        </div>
        
        <div>
          {layer.change_type || 'Modified'}
        </div>
      </div>

      {/* Progress bar for layer size relative to total */}
      {layer.size_percentage && (
        <div className="mt-3">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${Math.min(layer.size_percentage, 100)}%` }}
            />
          </div>
          <div className="text-xs text-white text-opacity-50 mt-1">
            {layer.size_percentage.toFixed(1)}% of total image size
          </div>
        </div>
      )}
    </div>
  );
};

LayerItem.propTypes = {
  layer: PropTypes.shape({
    id: PropTypes.string.isRequired,
    command: PropTypes.string,
    size: PropTypes.number,
    efficiency: PropTypes.number,
    created: PropTypes.string,
    file_count: PropTypes.number,
    wasted_size: PropTypes.number,
    change_type: PropTypes.string,
    size_percentage: PropTypes.number
  }).isRequired,
  index: PropTypes.number.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired
};

export default LayerItem;
