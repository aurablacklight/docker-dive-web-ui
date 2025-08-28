import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3000/api',
  timeout: 300000, // 5 minutes for image analysis
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making API request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API response error:', error);
    
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || error.response.statusText || 'Server error';
      throw new Error(`${error.response.status}: ${message}`);
    } else if (error.request) {
      // Request made but no response received
      throw new Error('Network error: No response from server');
    } else {
      // Something else happened
      throw new Error(`Request error: ${error.message}`);
    }
  }
);

/**
 * Search for Docker images on Docker Hub
 * @param {string} query - Search query
 * @param {boolean} popular - Whether to get popular images
 * @returns {Promise<Array>} Array of image objects
 */
export const searchImages = async (query, popular = false) => {
  try {
    const endpoint = popular ? '/search/popular' : '/search';
    const params = popular ? {} : { q: query };
    
    const response = await api.get(endpoint, { params });
    return response.data.results || response.data || [];
  } catch (error) {
    console.error('Search images error:', error);
    throw error;
  }
};

/**
 * Get popular/trending images
 * @returns {Promise<Array>} Array of popular image objects
 */
export const getPopularImages = async () => {
  try {
    const response = await api.get('/search/popular');
    return response.data.results || response.data || [];
  } catch (error) {
    console.error('Get popular images error:', error);
    throw error;
  }
};

/**
 * Inspect a Docker image using dive
 * @param {string} imageName - Name of the image to inspect
 * @returns {Promise<Object>} Inspection results with layers and metrics
 */
export const inspectImage = async (imageName) => {
  try {
    console.log(`Starting inspection for image: ${imageName}`);
    const response = await api.post(`/inspect/${encodeURIComponent(imageName)}`);
    return response.data;
  } catch (error) {
    console.error('Inspect image error:', error);
    throw error;
  }
};

/**
 * Get the status of an ongoing inspection
 * @param {string} imageName - Name of the image being inspected
 * @returns {Promise<Object>} Status object with progress information
 */
export const getInspectionStatus = async (imageName) => {
  try {
    const response = await api.get(`/inspect/${encodeURIComponent(imageName)}/status`);
    return response.data;
  } catch (error) {
    console.error('Get inspection status error:', error);
    throw error;
  }
};

/**
 * Pull a Docker image
 * @param {string} imageName - Name of the image to pull
 * @returns {Promise<Object>} Pull result
 */
export const pullImage = async (imageName) => {
  try {
    const response = await api.post('/images/pull', { imageName });
    return response.data;
  } catch (error) {
    console.error('Pull image error:', error);
    throw error;
  }
};

/**
 * Get list of local Docker images
 * @returns {Promise<Array>} Array of local image objects
 */
export const getLocalImages = async () => {
  try {
    const response = await api.get('/images/local');
    return response.data.images || [];
  } catch (error) {
    console.error('Get local images error:', error);
    throw error;
  }
};

/**
 * Remove a local Docker image
 * @param {string} imageName - Name of the image to remove
 * @returns {Promise<Object>} Remove result
 */
export const removeImage = async (imageName) => {
  try {
    const response = await api.delete(`/images/${encodeURIComponent(imageName)}`);
    return response.data;
  } catch (error) {
    console.error('Remove image error:', error);
    throw error;
  }
};

/**
 * Health check endpoint
 * @returns {Promise<Object>} Health status
 */
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check error:', error);
    throw error;
  }
};

// WebSocket connection for real-time updates
export class InspectionWebSocket {
  constructor(imageName, onUpdate, onError, onComplete) {
    this.imageName = imageName;
    this.onUpdate = onUpdate;
    this.onError = onError;
    this.onComplete = onComplete;
    this.ws = null;
  }

  connect() {
    try {
      const wsUrl = process.env.NODE_ENV === 'production' 
        ? `wss://${window.location.host}/ws/inspect`
        : 'ws://localhost:3000/ws/inspect';
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected for inspection updates');
        this.ws.send(JSON.stringify({ 
          type: 'subscribe', 
          imageName: this.imageName 
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'progress':
              this.onUpdate(data);
              break;
            case 'complete':
              this.onComplete(data);
              break;
            case 'error':
              this.onError(new Error(data.message));
              break;
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
          this.onError(error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed');
      };

    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.onError(error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default api;
