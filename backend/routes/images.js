const express = require('express');
const dockerUtils = require('../utils/docker');
const { validateImageName } = require('../utils/image-name');

const router = express.Router();

const sendInvalidImageName = (res, imageName) => res.status(400).json({
  error: 'Invalid image name',
  imageName,
  message: validateImageName(imageName).reason
});

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
  async (req, res) => {
    try {
      const { imageName } = req.body;
      if (!validateImageName(imageName).valid) {
        return sendInvalidImageName(res, imageName);
      }
      
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
  async (req, res) => {
    try {
      const { imageName } = req.params;
      const decodedImageName = decodeURIComponent(imageName);
      if (Object.prototype.hasOwnProperty.call(req.query, 'force')) {
        return res.status(400).json({
          error: 'Force delete is not supported',
          imageName: decodedImageName
        });
      }

      if (!validateImageName(decodedImageName).valid) {
        return sendInvalidImageName(res, decodedImageName);
      }
      
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

      const result = await dockerUtils.removeImage(decodedImageName);
      
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
  async (req, res) => {
    try {
      const { imageName } = req.params;
      const decodedImageName = decodeURIComponent(imageName);
      if (!validateImageName(decodedImageName).valid) {
        return sendInvalidImageName(res, decodedImageName);
      }
      
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
  async (req, res) => {
    try {
      const { imageName } = req.params;
      const decodedImageName = decodeURIComponent(imageName);
      if (!validateImageName(decodedImageName).valid) {
        return sendInvalidImageName(res, decodedImageName);
      }
      
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

module.exports = router;
