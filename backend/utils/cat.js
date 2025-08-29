const axios = require('axios');

/**
 * CATAAS (Cat as a Service) API utility functions
 * Used for showing cats when Docker search fails with 400 errors
 */
class CatUtils {
  constructor() {
    this.baseURL = 'https://cataas.com';
    
    // Create axios instance with default configuration
    this.api = axios.create({
      timeout: 10000, // 10 seconds timeout
      headers: {
        'User-Agent': 'dive-inspector/1.0.0'
      }
    });

    // Cat-related "search results" for when Docker search fails
    this.catMessages = [
      'Purrfect image not found!',
      'Meow-ybe try a different search?',
      'Cat-astrophic search failure!',
      'Feline like this search needs work',
      'Paws for a moment and try again',
      'This search is cat-astrophically broken',
      'Whiskers say: search harder!',
      'Purr-haps try something else?'
    ];

    this.catTags = [
      'cute', 'orange', 'black', 'white', 'tabby', 'kitten', 
      'sleepy', 'funny', 'fluffy', 'grumpy', 'happy', 'lazy'
    ];
  }

  /**
   * Get a random cat image URL with advanced options
   * @param {Object} options - Configuration options for the cat image
   * @param {string} options.tag - Optional tag for the cat (cute, orange, etc.)
   * @param {string} options.type - Image type: square, medium, small, xsmall
   * @param {string} options.filter - Image filter: mono, negate, custom
   * @param {number} options.width - Image width
   * @param {number} options.height - Image height
   * @param {boolean} options.json - Return JSON metadata instead of image
   * @returns {string} Cat image URL
   */
  getCatImageUrl(options = {}) {
    const { tag, type, filter, width, height, json } = options;
    
    let url = `${this.baseURL}/cat`;
    
    if (tag) {
      url += `/${tag}`;
    }
    
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (filter) params.append('filter', filter);
    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (json) params.append('json', 'true');
    
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Get a cat saying something with advanced text styling
   * @param {string} text - Text for the cat to say
   * @param {Object} options - Configuration options
   * @param {string} options.tag - Optional cat tag
   * @param {string} options.font - Font family (Impact, Arial, etc.)
   * @param {number} options.fontSize - Font size (default: 50)
   * @param {string} options.fontColor - Font color (default: #fff)
   * @param {string} options.fontBackground - Font background (default: none)
   * @param {string} options.type - Image type: square, medium, small, xsmall
   * @param {string} options.filter - Image filter: mono, negate, custom
   * @param {number} options.width - Image width
   * @param {number} options.height - Image height
   * @param {boolean} options.json - Return JSON metadata instead of image
   * @returns {string} Cat image URL with text
   */
  getCatSaysUrl(text, options = {}) {
    const { 
      tag, 
      font = 'Impact', 
      fontSize = 50, 
      fontColor = '#fff', 
      fontBackground = 'none',
      type,
      filter,
      width,
      height,
      json
    } = options;
    
    const encodedText = encodeURIComponent(text);
    
    let url = `${this.baseURL}/cat`;
    if (tag) {
      url += `/${tag}`;
    }
    url += `/says/${encodedText}`;
    
    const params = new URLSearchParams();
    if (font !== 'Impact') params.append('font', font);
    if (fontSize !== 50) params.append('fontSize', fontSize.toString());
    if (fontColor !== '#fff') params.append('fontColor', fontColor);
    if (fontBackground !== 'none') params.append('fontBackground', fontBackground);
    if (type) params.append('type', type);
    if (filter) params.append('filter', filter);
    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (json) params.append('json', 'true');
    
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Get a specific cat by ID
   * @param {string} catId - The cat ID
   * @param {boolean} json - Return JSON metadata instead of image
   * @returns {string} Cat image URL
   */
  getCatByIdUrl(catId, json = false) {
    let url = `${this.baseURL}/cat/${catId}`;
    if (json) {
      url += '?json=true';
    }
    return url;
  }

  /**
   * Get a specific cat by ID saying something
   * @param {string} catId - The cat ID
   * @param {string} text - Text for the cat to say
   * @param {Object} options - Configuration options (same as getCatSaysUrl)
   * @returns {string} Cat image URL with text
   */
  getCatByIdSaysUrl(catId, text, options = {}) {
    const { 
      font = 'Impact', 
      fontSize = 50, 
      fontColor = '#fff', 
      fontBackground = 'none',
      type,
      filter,
      width,
      height,
      json
    } = options;
    
    const encodedText = encodeURIComponent(text);
    let url = `${this.baseURL}/cat/${catId}/says/${encodedText}`;
    
    const params = new URLSearchParams();
    if (font !== 'Impact') params.append('font', font);
    if (fontSize !== 50) params.append('fontSize', fontSize.toString());
    if (fontColor !== '#fff') params.append('fontColor', fontColor);
    if (fontBackground !== 'none') params.append('fontBackground', fontBackground);
    if (type) params.append('type', type);
    if (filter) params.append('filter', filter);
    if (width) params.append('width', width.toString());
    if (height) params.append('height', height.toString());
    if (json) params.append('json', 'true');
    
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * Get cat data in JSON format
   * @param {number} limit - Number of cats to fetch (default: 10)
   * @param {number} skip - Number of cats to skip for pagination (default: 0)
   * @param {string} tags - Comma-separated list of tags to filter by
   * @returns {Promise<Array>} Array of cat objects with id, tags, mimetype, createdAt
   */
  async getCatsJson(limit = 10, skip = 0, tags = null) {
    try {
      const params = {
        limit: Math.min(limit, 50), // Limit to reasonable number
        skip: skip
      };
      
      if (tags) {
        params.tags = tags;
      }

      const response = await this.api.get('/api/cats', {
        params,
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data || [];
    } catch (error) {
      console.warn('Failed to fetch cat JSON data:', error.message);
      // Return mock cat data if API fails
      return this.getMockCatData(limit);
    }
  }

  /**
   * Get total count of cats available
   * @returns {Promise<number>} Total number of cats
   */
  async getCatCount() {
    try {
      const response = await this.api.get('/api/count', {
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data?.count || 1987; // Default fallback from main page
    } catch (error) {
      console.warn('Failed to fetch cat count:', error.message);
      return 1987; // Default fallback
    }
  }

  /**
   * Get available cat tags
   * @returns {Promise<Array>} Array of available tags
   */
  async getCatTags() {
    try {
      const response = await this.api.get('/api/tags', {
        headers: {
          'Accept': 'application/json'
        }
      });

      return response.data || this.catTags;
    } catch (error) {
      console.warn('Failed to fetch cat tags:', error.message);
      return this.catTags;
    }
  }

  /**
   * Generate cat-themed "search results" for failed Docker searches
   * @param {string} originalQuery - The original search query that failed
   * @param {number} limit - Number of cat "results" to generate
   * @returns {Promise<Object>} Cat-themed search results
   */
  async generateCatResults(originalQuery, limit = 10) {
    try {
      const [cats, tags, catCount] = await Promise.all([
        this.getCatsJson(limit),
        this.getCatTags(),
        this.getCatCount()
      ]);
      
      // Generate cat-themed "Docker images"
      const catResults = [];
      
      for (let i = 0; i < limit; i++) {
        const randomTag = tags[Math.floor(Math.random() * tags.length)];
        const randomMessage = this.catMessages[Math.floor(Math.random() * this.catMessages.length)];
        const randomFont = ['Impact', 'Arial', 'Comic Sans MS', 'Courier New'][Math.floor(Math.random() * 4)];
        const randomColor = ['#fff', '#000', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24'][Math.floor(Math.random() * 6)];
        
        // Get cat data if available
        const catData = cats[i] || {};
        const catId = catData.id || `cat-${i + 1}`;
        
        // Generate different image variations with minimum 400x300 dimensions
        const imageOptions = {
          tag: randomTag,
          type: ['square', 'medium', 'small'][Math.floor(Math.random() * 3)],
          filter: Math.random() > 0.7 ? ['mono', 'negate'][Math.floor(Math.random() * 2)] : null,
          width: 400 + Math.floor(Math.random() * 400), // 400-800px width
          height: 300 + Math.floor(Math.random() * 300) // 300-600px height
        };

        const textOptions = {
          tag: randomTag,
          font: randomFont,
          fontSize: 30 + Math.floor(Math.random() * 40),
          fontColor: randomColor,
          type: imageOptions.type,
          filter: imageOptions.filter
        };
        
        catResults.push({
          name: `${randomTag}-cat-${i + 1}`,
          namespace: 'cataas',
          repository: `${randomTag}-cat-${i + 1}`,
          short_description: randomMessage,
          description: `${randomMessage} Original search was: "${originalQuery}". This cute ${randomTag} cat is here to help!`,
          star_count: Math.floor(Math.random() * 1000) + 100, // Random stars
          pull_count: Math.floor(Math.random() * 50000) + 1000, // Random pulls
          is_official: false,
          is_automated: true,
          is_cat: true, // Special flag to identify cat results
          cat_image_url: this.getCatImageUrl(imageOptions),
          cat_says_url: this.getCatSaysUrl(randomMessage, textOptions),
          cat_by_id_url: catData.id ? this.getCatByIdUrl(catData.id) : null,
          cat_json_url: this.getCatImageUrl({ ...imageOptions, json: true }),
          cat_tag: randomTag,
          cat_id: catId,
          cat_metadata: catData,
          original_query: originalQuery,
          // Additional cat fun facts
          cat_facts: {
            font: randomFont,
            color: randomColor,
            type: imageOptions.type,
            filter: imageOptions.filter,
            created_at: catData.createdAt || new Date().toISOString(),
            tags: catData.tags || [randomTag]
          }
        });
      }

      return {
        query: originalQuery,
        count: catResults.length,
        results: catResults,
        is_cat_fallback: true,
        message: 'Oops! Docker search failed, but here are some cats to cheer you up! 🐱',
        cat_message: 'Purr-haps Docker Hub is having a cat-astrophe?',
        cat_stats: {
          total_cats_available: catCount,
          available_tags: tags.length,
          api_status: 'working'
        }
      };
    } catch (error) {
      console.error('Failed to generate cat results:', error);
      // Return basic cat fallback even if CATAAS fails
      return this.getBasicCatFallback(originalQuery, limit);
    }
  }

  /**
   * Get basic cat fallback when even CATAAS fails
   * @param {string} originalQuery - The original search query
   * @param {number} limit - Number of results
   * @returns {Object} Basic cat-themed results
   */
  getBasicCatFallback(originalQuery, limit = 5) {
    const basicCats = [];
    
    for (let i = 0; i < limit; i++) {
      const randomTag = this.catTags[Math.floor(Math.random() * this.catTags.length)];
      const randomMessage = this.catMessages[Math.floor(Math.random() * this.catMessages.length)];
      const randomFont = ['Impact', 'Arial', 'Comic Sans MS'][Math.floor(Math.random() * 3)];
      
      const imageOptions = { tag: randomTag, type: 'medium' };
      const textOptions = { 
        tag: randomTag, 
        font: randomFont, 
        fontSize: 40, 
        fontColor: '#fff',
        type: 'medium'
      };
      
      basicCats.push({
        name: `${randomTag}-cat-${i + 1}`,
        namespace: 'cataas',
        repository: `${randomTag}-cat-${i + 1}`,
        short_description: randomMessage,
        description: `${randomMessage} Original search was: "${originalQuery}". Fallback cat to the rescue!`,
        star_count: Math.floor(Math.random() * 500) + 50,
        pull_count: Math.floor(Math.random() * 10000) + 500,
        is_official: false,
        is_automated: true,
        is_cat: true,
        cat_image_url: this.getCatImageUrl(imageOptions),
        cat_says_url: this.getCatSaysUrl(randomMessage, textOptions),
        cat_tag: randomTag,
        original_query: originalQuery,
        cat_facts: {
          font: randomFont,
          type: 'medium',
          fallback: true
        }
      });
    }

    return {
      query: originalQuery,
      count: basicCats.length,
      results: basicCats,
      is_cat_fallback: true,
      message: 'Docker search failed, but cats are here to save the day! 🐱',
      cat_message: 'Even when the internet fails, cats prevail!',
      cat_stats: {
        api_status: 'fallback_mode',
        total_cats_available: 'unknown',
        available_tags: this.catTags.length
      }
    };
  }

  /**
   * Generate mock cat data when API is unavailable
   * @param {number} limit - Number of cats
   * @returns {Array} Mock cat data matching CATAAS API schema
   */
  getMockCatData(limit) {
    const mockCats = [];
    const mimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    
    for (let i = 0; i < limit; i++) {
      const randomTags = [];
      const tagCount = Math.floor(Math.random() * 3) + 1; // 1-3 tags per cat
      
      for (let j = 0; j < tagCount; j++) {
        const randomTag = this.catTags[Math.floor(Math.random() * this.catTags.length)];
        if (!randomTags.includes(randomTag)) {
          randomTags.push(randomTag);
        }
      }
      
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 365)); // Random date in past year
      
      mockCats.push({
        id: `mock-cat-${Date.now()}-${i + 1}`,
        tags: randomTags,
        mimetype: mimeTypes[Math.floor(Math.random() * mimeTypes.length)],
        createdAt: createdDate.toISOString()
      });
    }
    return mockCats;
  }
}

module.exports = new CatUtils();
