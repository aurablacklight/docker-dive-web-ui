import React from 'react';
import { Star, Download, Calendar, Package, ArrowRight } from 'lucide-react';

const ImageCard = ({ image, onInspect }) => {
  const formatNumber = (num) => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(1) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleInspect = () => {
    onInspect(image.name);
  };

  return (
    <div className="glass-card hover-lift hover-glow group cursor-pointer animate-fade-in">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white truncate group-hover:text-gradient transition-all duration-200">
              {image.name}
            </h3>
            <p className="text-sm text-white text-opacity-60 mt-1">
              {image.namespace || 'library'}
            </p>
          </div>
          <div className="flex items-center text-yellow-400 ml-3">
            <Star className="w-4 h-4 mr-1" />
            <span className="text-sm font-medium">
              {formatNumber(image.star_count || 0)}
            </span>
          </div>
        </div>

        {/* Description */}
        {image.short_description && (
          <p className="text-white text-opacity-80 text-sm line-clamp-2">
            {image.short_description}
          </p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center text-white text-opacity-70">
            <Download className="w-4 h-4 mr-2 text-green-400" />
            <span>{formatNumber(image.pull_count || 0)} pulls</span>
          </div>
          
          <div className="flex items-center text-white text-opacity-70">
            <Package className="w-4 h-4 mr-2 text-blue-400" />
            <span>{formatSize(image.full_size)}</span>
          </div>
          
          <div className="flex items-center text-white text-opacity-70 col-span-2">
            <Calendar className="w-4 h-4 mr-2 text-purple-400" />
            <span>Updated {formatDate(image.last_updated)}</span>
          </div>
        </div>

        {/* Tags */}
        {image.is_official && (
          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500 bg-opacity-20 text-blue-300 border border-blue-400 border-opacity-30">
            Official Image
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleInspect}
          className="w-full glass-button flex items-center justify-center group-hover:bg-opacity-25 group-hover:scale-105 transition-all duration-200"
        >
          <span className="mr-2">Pull & Inspect</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
        </button>
      </div>
    </div>
  );
};

export default ImageCard;
