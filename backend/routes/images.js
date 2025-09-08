const express = require('express');
const { body, param, validationResult } = require('express-validator');
const dockerUtils = require('../utils/docker');

const router = express.Router();

/**
 * GET /api/images/local
 * List all local Docker images
 */
router.get('/local', async (req, res) => {
  try {
    console.log('Listing local Docker images');
    
    const images = await dockerUtils.listImages();
    
    res.json({
      count: images.length,
      images
    });
  } catch (error) {
    console.error('List local images error:', error);
    res.status(500).json({
      error: 'Failed to list local images',
      message: error.message
    });
  }
});

/**
 * POST /api/images/pull
 * Pull a Docker image from registry
 */
router.post('/pull',
  [
    body('imageName')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Image name must be between 1 and 255 characters')
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*[a-zA-Z0-9]*(:[a-zA-Z0-9._-]+)?$/)
      .withMessage('Invalid image name format')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid request body',
          details: errors.array()
        });
      }

      const { imageName } = req.body;
      
      console.log(`Pulling Docker image: ${imageName}`);
      
      // Check if Docker is available
      const dockerAvailable = await dockerUtils.isDockerAvailable();
      if (!dockerAvailable) {
        return res.status(503).json({
          error: 'Docker is not available or not accessible'
        });
      }

      const result = await dockerUtils.pullImage(imageName);
      
      res.json({
        success: true,
        imageName,
        result,
        pulledAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Pull image error for ${req.body?.imageName}:`, error);
      res.status(500).json({
        error: 'Failed to pull image',
        imageName: req.body?.imageName,
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/images/:imageName
 * Remove a local Docker image
 */
router.delete('/:imageName',
  [
    param('imageName')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Image name must be between 1 and 255 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid image name',
          details: errors.array()
        });
      }

      const { imageName } = req.params;
      const decodedImageName = decodeURIComponent(imageName);
      const { force = false } = req.query;
      
      console.log(`Removing Docker image: ${decodedImageName}`);
      
      // Check if Docker is available
      const dockerAvailable = await dockerUtils.isDockerAvailable();
      if (!dockerAvailable) {
        return res.status(503).json({
          error: 'Docker is not available or not accessible'
        });
      }

      // Check if image exists
      const imageExists = await dockerUtils.imageExists(decodedImageName);
      if (!imageExists) {
        return res.status(404).json({
          error: 'Image not found locally',
          imageName: decodedImageName
        });
      }

      const result = await dockerUtils.removeImage(decodedImageName, force === 'true');
      
      res.json({
        success: true,
        imageName: decodedImageName,
        result,
        removedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Remove image error for ${req.params.imageName}:`, error);
      res.status(500).json({
        error: 'Failed to remove image',
        imageName: req.params.imageName,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/images/:imageName/info
 * Get detailed information about a local image
 */
router.get('/:imageName/info',
  [
    param('imageName')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Image name must be between 1 and 255 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid image name',
          details: errors.array()
        });
      }

      const { imageName } = req.params;
      const decodedImageName = decodeURIComponent(imageName);
      
      console.log(`Getting info for image: ${decodedImageName}`);
      
      // Check if image exists
      const imageExists = await dockerUtils.imageExists(decodedImageName);
      if (!imageExists) {
        return res.status(404).json({
          error: 'Image not found locally',
          imageName: decodedImageName
        });
      }

      const imageInfo = await dockerUtils.getImageInfo(decodedImageName);
      
      res.json({
        imageName: decodedImageName,
        info: imageInfo,
        retrievedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Get image info error for ${req.params.imageName}:`, error);
      res.status(500).json({
        error: 'Failed to get image information',
        imageName: req.params.imageName,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/images/:imageName/history
 * Get the layer history of an image
 */
router.get('/:imageName/history',
  [
    param('imageName')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Image name must be between 1 and 255 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid image name',
          details: errors.array()
        });
      }

      const { imageName } = req.params;
      const decodedImageName = decodeURIComponent(imageName);
      
      console.log(`Getting history for image: ${decodedImageName}`);
      
      // Check if image exists
      const imageExists = await dockerUtils.imageExists(decodedImageName);
      if (!imageExists) {
        return res.status(404).json({
          error: 'Image not found locally',
          imageName: decodedImageName
        });
      }

      const history = await dockerUtils.getImageHistory(decodedImageName);
      
      res.json({
        imageName: decodedImageName,
        layerCount: history.length,
        history,
        retrievedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Get image history error for ${req.params.imageName}:`, error);
      res.status(500).json({
        error: 'Failed to get image history',
        imageName: req.params.imageName,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/images/docker-info
 * Get Docker system information
 */
router.get('/docker-info', async (req, res) => {
  try {
    console.log('Getting Docker system information');
    
    const dockerAvailable = await dockerUtils.isDockerAvailable();
    
    if (!dockerAvailable) {
      return res.status(503).json({
        error: 'Docker is not available or not accessible'
      });
    }

    const dockerVersion = await dockerUtils.getDockerVersion();
    
    res.json({
      available: true,
      version: dockerVersion,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Docker info error:', error);
    res.status(500).json({
      error: 'Failed to get Docker information',
      message: error.message
    });
  }
});

/**
 * POST /api/images/cleanup
 * Clean up all Docker images (nuclear option!)
 */
router.post('/cleanup', async (req, res) => {
  try {
    console.log('🧹 Starting Docker image cleanup - DELETING ALL IMAGES');
    
    // Check if Docker is available
    const dockerAvailable = await dockerUtils.isDockerAvailable();
    if (!dockerAvailable) {
      return res.status(503).json({
        error: 'Docker is not available or not accessible'
      });
    }

    // Get list of all images before cleanup
    const imagesBefore = await dockerUtils.listImages();
    console.log(`Found ${imagesBefore.length} images to delete`);

    // Nuclear option: Remove ALL images with force
    const cleanupResult = await dockerUtils.cleanupAllImages();
    
    // Get list of remaining images after cleanup
    const imagesAfter = await dockerUtils.listImages();
    const deletedCount = imagesBefore.length - imagesAfter.length;
    
    console.log(`🗑️ Cleanup complete! Deleted ${deletedCount} images`);
    
    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} Docker images`,
      details: {
        imagesBefore: imagesBefore.length,
        imagesAfter: imagesAfter.length,
        deletedCount: deletedCount,
        remainingImages: imagesAfter.map(img => ({
          repository: img.repository,
          tag: img.tag,
          size: img.size
        }))
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      error: 'Failed to perform cleanup',
      message: error.message
    });
  }
});

module.exports = router;
