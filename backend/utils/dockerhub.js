const axios = require('axios');

/**
 * Docker Hub API utility functions
 */
class DockerHubUtils {
  constructor() {
    this.baseURL = 'https://hub.docker.com/v2';
    this.searchURL = 'https://index.docker.io/v1/search';
    
    // Create axios instance with default configuration
    this.api = axios.create({
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'dive-inspector/1.0.0'
      }
    });

    // Popular images to show when no search is performed
    this.popularImages = [
      'nginx', 'node', 'ubuntu', 'postgres', 'redis', 'python', 
      'mysql', 'alpine', 'httpd', 'mongo', 'java', 'golang'
    ];
  }

  /**
   * Search for Docker images on Docker Hub
   * @param {string} query - Search query
   * @param {number} limit - Maximum number of results (default: 25)
   * @param {number} page - Page number for pagination (default: 1)
   * @returns {Promise<Array>} Array of image objects
   */
  async searchImages(query, limit = 25, page = 1) {
    try {
      console.log(`Searching Docker Hub for: ${query}`);
      
      // Use the Docker Hub search API
      const response = await this.api.get(this.searchURL, {
        params: {
          q: query,
          n: Math.min(limit, 100), // Docker Hub limits to 100
          page: page
        }
      });

      const results = response.data.results || [];
      
      // Enhance results with additional information
      const enhancedResults = await Promise.all(
        results.slice(0, limit).map(async (image) => {
          try {
            const details = await this.getImageDetails(image.name);
            return {
              ...image,
              ...details,
              // Ensure consistent field names
              name: image.name,
              namespace: image.name.includes('/') ? image.name.split('/')[0] : 'library',
              repository: image.name.includes('/') ? image.name.split('/')[1] : image.name,
              short_description: image.description || details.short_description || '',
              star_count: image.star_count || details.star_count || 0,
              pull_count: image.pull_count || details.pull_count || 0,
              is_official: image.is_official || details.is_official || false,
              is_automated: image.is_automated || details.is_automated || false
            };
          } catch (detailError) {
            console.warn(`Failed to get details for ${image.name}:`, detailError.message);
            return {
              ...image,
              namespace: image.name.includes('/') ? image.name.split('/')[0] : 'library',
              repository: image.name.includes('/') ? image.name.split('/')[1] : image.name,
              short_description: image.description || '',
              star_count: image.star_count || 0,
              pull_count: image.pull_count || 0,
              is_official: image.is_official || false,
              is_automated: image.is_automated || false
            };
          }
        })
      );

      return enhancedResults;
    } catch (error) {
      console.error('Docker Hub search failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific image
   * @param {string} imageName - Name of the image (e.g., 'nginx' or 'library/nginx')
   * @returns {Promise<Object>} Detailed image information
   */
  async getImageDetails(imageName) {
    try {
      // Normalize image name for API call
      const normalizedName = this.normalizeImageName(imageName);
      const [namespace, repository] = normalizedName.includes('/') 
        ? normalizedName.split('/')
        : ['library', normalizedName];

      const url = `${this.baseURL}/repositories/${namespace}/${repository}`;
      const response = await this.api.get(url);

      const data = response.data;
      
      return {
        name: data.name,
        namespace: data.namespace,
        repository: repository,
        short_description: data.description || '',
        full_description: data.full_description || '',
        star_count: data.star_count || 0,
        pull_count: data.pull_count || 0,
        last_updated: data.last_updated,
        date_registered: data.date_registered,
        status: data.status,
        is_private: data.is_private || false,
        is_automated: data.is_automated || false,
        is_official: namespace === 'library',
        has_starred: data.has_starred || false,
        full_size: data.full_size || 0,
        permissions: data.permissions
      };
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`Image not found: ${imageName}`);
      }
      console.error(`Failed to get image details for ${imageName}:`, error);
      throw new Error(`Failed to get image details: ${error.message}`);
    }
  }

  /**
   * Get popular/trending images
   * @param {number} limit - Maximum number of results
   * @returns {Promise<Array>} Array of popular image objects
   */
  async getPopularImages(limit = 12) {
    try {
      console.log('Fetching popular Docker images');
      
      // Get details for each popular image
      const popularResults = await Promise.allSettled(
        this.popularImages.slice(0, limit).map(async (imageName) => {
          try {
            const details = await this.getImageDetails(imageName);
            return {
              name: imageName,
              ...details,
              namespace: 'library',
              repository: imageName,
              is_popular: true
            };
          } catch (error) {
            console.warn(`Failed to get details for popular image ${imageName}:`, error.message);
            return {
              name: imageName,
              namespace: 'library',
              repository: imageName,
              short_description: `Popular ${imageName} image`,
              star_count: 0,
              pull_count: 0,
              is_official: true,
              is_popular: true,
              last_updated: new Date().toISOString()
            };
          }
        })
      );

      // Filter successful results and sort by popularity
      const results = popularResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
        .sort((a, b) => (b.star_count || 0) - (a.star_count || 0));

      return results;
    } catch (error) {
      console.error('Failed to get popular images:', error);
      throw new Error(`Failed to get popular images: ${error.message}`);
    }
  }

  /**
   * Get tags for a specific image
   * @param {string} imageName - Name of the image
   * @param {number} limit - Maximum number of tags to return
   * @returns {Promise<Array>} Array of tag objects
   */
  async getImageTags(imageName, limit = 10) {
    try {
      const normalizedName = this.normalizeImageName(imageName);
      const [namespace, repository] = normalizedName.includes('/') 
        ? normalizedName.split('/')
        : ['library', normalizedName];

      const url = `${this.baseURL}/repositories/${namespace}/${repository}/tags`;
      const response = await this.api.get(url, {
        params: {
          page_size: limit,
          ordering: '-last_updated'
        }
      });

      const tags = response.data.results || [];
      
      return tags.map(tag => ({
        name: tag.name,
        full_size: tag.full_size,
        last_updated: tag.last_updated,
        last_updater_username: tag.last_updater_username,
        images: tag.images,
        v2: tag.v2
      }));
    } catch (error) {
      console.error(`Failed to get tags for ${imageName}:`, error);
      throw new Error(`Failed to get image tags: ${error.message}`);
    }
  }

  /**
   * Search for repositories with additional filters
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} Filtered search results
   */
  async searchRepositories(query, filters = {}) {
    try {
      const params = {
        q: query,
        page_size: filters.limit || 25,
        page: filters.page || 1
      };

      // Add additional filters
      if (filters.is_official !== undefined) {
        params.is_official = filters.is_official;
      }
      if (filters.is_automated !== undefined) {
        params.is_automated = filters.is_automated;
      }
      if (filters.ordering) {
        params.ordering = filters.ordering;
      }

      const response = await this.api.get(`${this.baseURL}/search/repositories`, { params });
      
      return {
        count: response.data.count,
        next: response.data.next,
        previous: response.data.previous,
        results: response.data.results || []
      };
    } catch (error) {
      console.error('Repository search failed:', error);
      throw new Error(`Repository search failed: ${error.message}`);
    }
  }

  /**
   * Normalize image name for API calls
   * @param {string} imageName - Raw image name
   * @returns {string} Normalized image name
   */
  normalizeImageName(imageName) {
    // Remove tag if present
    const nameWithoutTag = imageName.split(':')[0];
    
    // If no namespace, assume 'library' (official images)
    if (!nameWithoutTag.includes('/')) {
      return nameWithoutTag;
    }
    
    return nameWithoutTag;
  }

  /**
   * Format image data for consistent API responses
   * @param {Object} rawData - Raw image data from Docker Hub
   * @returns {Object} Formatted image data
   */
  formatImageData(rawData) {
    return {
      name: rawData.name,
      namespace: rawData.namespace || (rawData.name.includes('/') ? rawData.name.split('/')[0] : 'library'),
      repository: rawData.repository || (rawData.name.includes('/') ? rawData.name.split('/')[1] : rawData.name),
      short_description: rawData.short_description || rawData.description || '',
      full_description: rawData.full_description || '',
      star_count: rawData.star_count || 0,
      pull_count: rawData.pull_count || 0,
      last_updated: rawData.last_updated,
      date_registered: rawData.date_registered,
      is_official: rawData.is_official || false,
      is_automated: rawData.is_automated || false,
      is_private: rawData.is_private || false,
      full_size: rawData.full_size || 0,
      tag_count: rawData.tag_count || 0
    };
  }

  /**
   * Get rate limit information
   * @returns {Promise<Object>} Rate limit status
   */
  async getRateLimit() {
    try {
      const response = await this.api.head(`${this.baseURL}/repositories/library/hello-world`);
      
      return {
        limit: response.headers['x-ratelimit-limit'],
        remaining: response.headers['x-ratelimit-remaining'],
        reset: response.headers['x-ratelimit-reset']
      };
    } catch (error) {
      console.error('Failed to get rate limit:', error);
      return null;
    }
  }
}

module.exports = new DockerHubUtils();
