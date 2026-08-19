// Use manual mock for axios
jest.mock('axios');

const axios = require('axios').default || require('axios');
const { mockAxiosInstance } = require('../__mocks__/axios');
const { searchImages, inspectImage, removeImage, uploadImage } = require('../services/api');

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
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/inspect/nginx%3Alatest');
      expect(result).toEqual(mockResponse.data);
    });

    test('handles inspection errors', async () => {
      const errorMessage = 'Image not found';
      mockAxiosInstance.post.mockRejectedValue(new Error(errorMessage));
      
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
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/inspect/library%2Fnginx%3Alatest');
    });
  });

  describe('removeImage', () => {
    test('removes a namespaced image using encoded path segment', async () => {
      const mockResponse = {
        data: {
          success: true,
          imageName: 'ghcr.io/owner/repo:tag'
        }
      };

      mockAxiosInstance.delete.mockResolvedValue(mockResponse);

      const result = await removeImage('ghcr.io/owner/repo:tag');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/images/ghcr.io%2Fowner%2Frepo%3Atag');
      expect(result).toEqual(mockResponse.data);
    });

    test('handles remove errors', async () => {
      const errorMessage = 'Remove failed';
      mockAxiosInstance.delete.mockRejectedValue(new Error(errorMessage));

      await expect(removeImage('nginx:latest')).rejects.toThrow(errorMessage);
    });
  });

  describe('uploadImage', () => {
    const makeFile = () =>
      new File(['tarball'], 'myimage.tar', { type: 'application/x-tar' });

    test('posts FormData with the image field to /images/upload', async () => {
      const mockResponse = {
        data: {
          success: true,
          loadedImages: ['myimage:latest'],
          loadedImageIds: []
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await uploadImage(makeFile());

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/images/upload',
        expect.any(FormData),
        expect.objectContaining({
          timeout: 600000,
          onUploadProgress: expect.any(Function)
        })
      );

      const formData = mockAxiosInstance.post.mock.calls[0][1];
      expect(formData.get('image')).toBeInstanceOf(File);
      expect(formData.get('image').name).toBe('myimage.tar');
      expect(result).toEqual(mockResponse.data);
    });

    test('does not set Content-Type manually', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await uploadImage(makeFile());

      const config = mockAxiosInstance.post.mock.calls[0][2];
      expect(config.headers).toBeUndefined();
    });

    test('reports upload progress as an integer percent', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });
      const onProgress = jest.fn();

      await uploadImage(makeFile(), onProgress);

      const { onUploadProgress } = mockAxiosInstance.post.mock.calls[0][2];

      onUploadProgress({ loaded: 25, total: 100 });
      onUploadProgress({ loaded: 700, total: 1024 });
      onUploadProgress({ loaded: 1024, total: 1024 });

      expect(onProgress).toHaveBeenNthCalledWith(1, 25);
      expect(onProgress).toHaveBeenNthCalledWith(2, 68);
      expect(onProgress).toHaveBeenNthCalledWith(3, 100);
      expect(
        onProgress.mock.calls.every(([percent]) => Number.isInteger(percent))
      ).toBe(true);
    });

    test('tolerates progress events with no total and a missing callback', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });
      const onProgress = jest.fn();

      await uploadImage(makeFile(), onProgress);
      const withCallback = mockAxiosInstance.post.mock.calls[0][2].onUploadProgress;
      expect(() => withCallback({ loaded: 10 })).not.toThrow();
      expect(onProgress).not.toHaveBeenCalled();

      await uploadImage(makeFile());
      const withoutCallback = mockAxiosInstance.post.mock.calls[1][2].onUploadProgress;
      expect(() => withoutCallback({ loaded: 50, total: 100 })).not.toThrow();
    });

    test('handles upload errors', async () => {
      const errorMessage = '502: Failed to load image';
      mockAxiosInstance.post.mockRejectedValue(new Error(errorMessage));

      await expect(uploadImage(makeFile())).rejects.toThrow(errorMessage);
    });
  });
});
