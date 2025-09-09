import axios, { mockAxiosInstance } from '../__mocks__/axios';
import { searchImages, inspectImage, cleanupAllImages } from '../services/api';

// Use manual mock for axios
jest.mock('axios');

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure axios.create returns our mocked instance
    axios.create.mockReturnValue(mockAxiosInstance);
  });

  describe('searchImages', () => {
    test('returns search results successfully', async () => {
      const mockResponse = {
        data: {
          results: [
            { name: 'nginx', description: 'Official nginx' },
            { name: 'redis', description: 'Official redis' }
          ]
        }
      };
      
      mockAxiosInstance.get.mockResolvedValue(mockResponse);
      
      const result = await searchImages('nginx');
      
      console.log('axios.create calls:', axios.create.mock.calls.length);
      console.log('mockAxiosInstance.get calls:', mockAxiosInstance.get.mock.calls.length);
      console.log('Mock calls:', mockAxiosInstance.get.mock.calls);
      
      expect(axios.create).toHaveBeenCalled();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/search', {
        params: { q: 'nginx' }
      });
      expect(result).toEqual(mockResponse.data.results);
    });

    test('handles search errors', async () => {
      const errorMessage = 'Network error';
      mockAxiosInstance.get.mockRejectedValue(new Error(errorMessage));
      
      await expect(searchImages('test')).rejects.toThrow(errorMessage);
    });

    test('handles empty query', async () => {
      const mockResponse = { data: { results: [] } };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);
      
      const result = await searchImages('');
      
      expect(result).toEqual([]);
    });
  });

  describe('inspectImage', () => {
    test('returns inspection data successfully', async () => {
      const mockResponse = {
        data: {
          analysis: {
            layers: [
              { id: '1', size: 1000, command: 'RUN apt-get update' }
            ],
            analysis: {
              totalSize: 1000,
              totalLayers: 1,
              efficiency: 85
            }
          }
        }
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      const result = await inspectImage('nginx:latest');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/inspect/nginx:latest');
      expect(result).toEqual(mockResponse.data);
    });

    test('handles inspection errors', async () => {
      const errorMessage = 'Image not found';
      mockAxiosInstance.post.mockRejectedValue({
        response: { data: { error: errorMessage } }
      });
      
      await expect(inspectImage('invalid:image')).rejects.toThrow(errorMessage);
    });

    test('handles network errors during inspection', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));
      
      await expect(inspectImage('nginx:latest')).rejects.toThrow('Network error');
    });

    test('handles namespaced image names', async () => {
      const mockResponse = { data: { analysis: {} } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      await inspectImage('library/nginx:latest');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/inspect/library/nginx:latest');
    });
  });

  describe('cleanupAllImages', () => {
    test('returns cleanup results successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          details: {
            deletedCount: 5,
            protectedImages: ['nginx:latest', 'postgres:13']
          }
        }
      };
      
      mockAxiosInstance.post.mockResolvedValue(mockResponse);
      
      const result = await cleanupAllImages();
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/images/cleanup');
      expect(result).toEqual(mockResponse.data);
    });

    test('handles cleanup errors', async () => {
      const errorMessage = 'Cleanup failed';
      mockAxiosInstance.post.mockRejectedValue({
        response: { data: { error: errorMessage } }
      });
      
      await expect(cleanupAllImages()).rejects.toThrow(errorMessage);
    });

    test('handles network errors during cleanup', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network timeout'));
      
      await expect(cleanupAllImages()).rejects.toThrow('Network timeout');
    });
  });
});
