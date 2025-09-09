import PropTypes from 'prop-types';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ 
  size = 'medium', 
  message = 'Loading...', 
  showMessage = true 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const containerClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };

  return (
    <div 
      className={`flex flex-col items-center justify-center ${containerClasses[size]}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={`${sizeClasses[size]} animate-spin text-white`} />
      {showMessage && (
        <p className="text-white text-opacity-70 mt-3">
          {message}
        </p>
      )}
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  message: PropTypes.string,
  showMessage: PropTypes.bool
};

export default LoadingSpinner;
