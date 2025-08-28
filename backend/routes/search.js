const express = require('express');
const { body, query, validationResult } = require('express-validator');
const dockerHubUtils = require('../utils/dockerhub');
const catUtils = require('../utils/cat');

const router = express.Router();

/**
 * GET /api/search
 * Search Docker Hub for images
 */
router.get('/', 
  [
    query('q')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Query must be between 1 and 100 characters'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          details: errors.array()
        });
      }

      const { q: query, limit = 25 } = req.query;
      
      console.log(`Searching for images: "${query}"`);
      
      try {
        const results = await dockerHubUtils.searchImages(query, parseInt(limit));
        
        res.json({
          query,
          count: results.length,
          results
        });
      } catch (searchError) {
        // Check if this is a 400-like error (search failure)
        if (searchError.message && (
          searchError.message.includes('400') || 
          searchError.message.includes('Bad Request') ||
          searchError.message.includes('Search failed') ||
          searchError.response?.status === 400
        )) {
          console.log(`Search failed for "${query}", showing cats instead! 🐱`);
          
          // Generate cat results instead of showing error
          const catResults = await catUtils.generateCatResults(query, parseInt(limit));
          
          // Return cats with a 200 status (not an error for the frontend)
          return res.status(200).json(catResults);
        }
        
        // For other types of errors, still throw them
        throw searchError;
      }
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Failed to search images',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/search/popular
 * Get popular/trending Docker images
 */
router.get('/popular', async (req, res) => {
  try {
    const { limit = 12 } = req.query;
    
    console.log('Fetching popular images');
    
    const results = await dockerHubUtils.getPopularImages(parseInt(limit));
    
    res.json({
      type: 'popular',
      count: results.length,
      results
    });
  } catch (error) {
    console.error('Popular images error:', error);
    res.status(500).json({
      error: 'Failed to fetch popular images',
      message: error.message
    });
  }
});

/**
 * GET /api/search/repositories
 * Advanced repository search with filters
 */
router.get('/repositories',
  [
    query('q')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Query must be between 1 and 100 characters'),
    query('is_official')
      .optional()
      .isBoolean()
      .withMessage('is_official must be a boolean'),
    query('is_automated')
      .optional()
      .isBoolean()
      .withMessage('is_automated must be a boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request parameters',
          details: errors.array()
        });
      }

      const { q: query, limit = 25, is_official, is_automated, ordering } = req.query;
      
      const filters = {
        limit: parseInt(limit),
        is_official: is_official === 'true' ? true : is_official === 'false' ? false : undefined,
        is_automated: is_automated === 'true' ? true : is_automated === 'false' ? false : undefined,
        ordering
      };
      
      try {
        const results = await dockerHubUtils.searchRepositories(query, filters);
        
        res.json({
          query,
          filters,
          ...results
        });
      } catch (searchError) {
        // Check if this is a 400-like error (search failure)
        if (searchError.message && (
          searchError.message.includes('400') || 
          searchError.message.includes('Bad Request') ||
          searchError.message.includes('Search failed') ||
          searchError.response?.status === 400
        )) {
          console.log(`Repository search failed for "${query}", showing cats instead! 🐱`);
          
          // Generate cat results instead of showing error
          const catResults = await catUtils.generateCatResults(query, parseInt(filters.limit));
          
          // Return cats with a 200 status (not an error for the frontend)
          return res.status(200).json({
            ...catResults,
            filters,
            search_type: 'repositories'
          });
        }
        
        // For other types of errors, still throw them
        throw searchError;
      }
    } catch (error) {
      console.error('Repository search error:', error);
      res.status(500).json({
        error: 'Failed to search repositories',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/search/image/:imageName
 * Get detailed information about a specific image
 */
router.get('/image/:imageName', async (req, res) => {
  try {
    const { imageName } = req.params;
    
    if (!imageName || imageName.trim().length === 0) {
      return res.status(400).json({
        error: 'Image name is required'
      });
    }
    
    console.log(`Getting details for image: ${imageName}`);
    
    const imageDetails = await dockerHubUtils.getImageDetails(imageName);
    
    res.json({
      imageName,
      details: imageDetails
    });
  } catch (error) {
    console.error(`Image details error for ${req.params.imageName}:`, error);
    
    if (error.message.includes('not found')) {
      res.status(404).json({
        error: 'Image not found',
        imageName: req.params.imageName
      });
    } else {
      res.status(500).json({
        error: 'Failed to get image details',
        message: error.message
      });
    }
  }
});

/**
 * GET /api/search/image/:imageName/tags
 * Get tags for a specific image
 */
router.get('/image/:imageName/tags', async (req, res) => {
  try {
    const { imageName } = req.params;
    const { limit = 10 } = req.query;
    
    if (!imageName || imageName.trim().length === 0) {
      return res.status(400).json({
        error: 'Image name is required'
      });
    }
    
    console.log(`Getting tags for image: ${imageName}`);
    
    const tags = await dockerHubUtils.getImageTags(imageName, parseInt(limit));
    
    res.json({
      imageName,
      count: tags.length,
      tags
    });
  } catch (error) {
    console.error(`Image tags error for ${req.params.imageName}:`, error);
    res.status(500).json({
      error: 'Failed to get image tags',
      message: error.message
    });
  }
});

/**
 * GET /api/search/rate-limit
 * Get Docker Hub API rate limit status
 */
router.get('/rate-limit', async (req, res) => {
  try {
    const rateLimit = await dockerHubUtils.getRateLimit();
    
    res.json({
      rateLimit: rateLimit || {
        message: 'Rate limit information not available'
      }
    });
  } catch (error) {
    console.error('Rate limit error:', error);
    res.status(500).json({
      error: 'Failed to get rate limit information',
      message: error.message
    });
  }
});

/**
 * GET /api/search/cats
 * Special endpoint to show cats (for testing the cat fallback functionality)
 */
router.get('/cats', async (req, res) => {
  try {
    const { limit = 10, query = 'test-search' } = req.query;
    
    console.log('Generating cat results for testing! 🐱');
    
    const catResults = await catUtils.generateCatResults(query, parseInt(limit));
    
    res.json({
      ...catResults,
      endpoint_info: 'This is a special endpoint for testing the cat fallback functionality!'
    });
  } catch (error) {
    console.error('Cat generation error:', error);
    res.status(500).json({
      error: 'Failed to generate cats (how sad!)',
      message: error.message
    });
  }
});

/**
 * GET /api/search/test-400
 * Special endpoint to simulate a 400 error and trigger cat fallback
 */
router.get('/test-400', async (req, res) => {
  try {
    const { query = 'test-query-that-fails', limit = 5 } = req.query;
    
    console.log(`Simulating 400 error for query: "${query}"`);
    
    // Simulate a 400 error that would trigger cat fallback
    const mockError = new Error('400 Bad Request - Simulated error for testing');
    mockError.response = { status: 400 };
    
    // This simulates what happens in the real search when we get a 400
    if (mockError.message.includes('400')) {
      console.log(`Simulated search failed for "${query}", showing cats instead! 🐱`);
      
      const catResults = await catUtils.generateCatResults(query, parseInt(limit));
      
      return res.status(200).json({
        ...catResults,
        test_info: 'This was a simulated 400 error to demonstrate cat fallback!'
      });
    }
  } catch (error) {
    console.error('Test 400 error:', error);
    res.status(500).json({
      error: 'Failed to simulate 400 error',
      message: error.message
    });
  }
});

module.exports = router;
