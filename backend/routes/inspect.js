const express = require('express');
const diveUtils = require('../utils/dive.js');
const dockerUtils = require('../utils/docker.js');
const { validateImageName } = require('../utils/image-name');

const router = express.Router();

// Store inspection progress for real-time updates
const inspectionProgress = new Map();

const getImageNameFromRequest = (req) => {
  let imageName = req.params.imageName;
  if (req.params[0]) {
    imageName += req.params[0];
  }
  return decodeURIComponent(imageName || '');
};

const failureStatusFor = (error) => {
  const message = error.message || '';
  if (message.includes('Invalid image name')) {
    return 400;
  }
  if (/not found|no such image|manifest unknown|pull access denied/i.test(message)) {
    return 404;
  }
  return 502;
};

/**
 * GET /api/inspect/health
 * Check if inspection dependencies are available
 */
router.get('/health', async (req, res) => {
  try {
    const dockerAvailable = await dockerUtils.isDockerAvailable();
    const diveAvailable = await diveUtils.isDiveAvailable();
    
    const dockerVersion = dockerAvailable ? await dockerUtils.getDockerVersion() : null;
    
    res.json({
      status: dockerAvailable && diveAvailable ? 'healthy' : 'unhealthy',
      dependencies: {
        docker: {
          available: dockerAvailable,
          version: dockerVersion?.Client?.Version || null
        },
        dive: {
          available: diveAvailable
        }
      },
      activeInspections: inspectionProgress.size
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      error: 'Health check failed',
      message: error.message
    });
  }
});

/**
 * GET /api/inspect/active
 * Get list of active inspections
 */
router.get('/active', async (req, res) => {
  try {
    const activeInspections = Array.from(inspectionProgress.entries()).map(([imageName, progress]) => ({
      imageName,
      ...progress
    }));

    res.json({
      count: activeInspections.length,
      inspections: activeInspections
    });
  } catch (error) {
    console.error('Active inspections error:', error);
    res.status(500).json({
      error: 'Failed to get active inspections',
      message: error.message
    });
  }
});

/**
 * GET /api/inspect/:imageName/status (and namespaced variants)
 * Get the status of an ongoing inspection (supports namespaced images)
 */
router.get(/^\/(.+?)\/status\/?$/, async (req, res) => {
  try {
    const imageName = req.params[0]; // Get the captured group from regex
    
    if (!imageName || imageName.trim().length === 0) {
      return res.status(400).json({
        error: 'Image name is required for status check',
        path: req.path
      });
    }

    const decodedImageName = decodeURIComponent(imageName);
    const progress = inspectionProgress.get(decodedImageName);
    
    if (!progress) {
      return res.status(404).json({
        error: 'No inspection in progress for this image',
        imageName: decodedImageName
      });
    }

    res.json({
      imageName: decodedImageName,
      ...progress
    });

  } catch (error) {
    console.error(`Status check error for ${req.path}:`, error);
    res.status(500).json({
      error: 'Failed to get inspection status',
      message: error.message
    });
  }
});

/**
 * DELETE /api/inspect/:imageName*
 * Cancel an ongoing inspection (supports namespaced images)
 */
router.delete('/:imageName*',
  async (req, res) => {
    try {
      // Reconstruct the full image name from params
      let imageName = req.params.imageName;
      if (req.params[0]) {
        imageName += req.params[0];
      }

      if (!imageName || imageName.trim().length === 0) {
        return res.status(400).json({
          error: 'Image name is required',
          path: req.path
        });
      }

      const decodedImageName = decodeURIComponent(imageName);
      const progress = inspectionProgress.get(decodedImageName);
      
      if (!progress) {
        return res.status(404).json({
          error: 'No inspection in progress for this image',
          imageName: decodedImageName
        });
      }

      // Remove from progress tracking
      inspectionProgress.delete(decodedImageName);
      
      // Notify via WebSocket
      const inspectionSockets = req.app.get('inspectionSockets');
      const socket = inspectionSockets.get(decodedImageName);
      if (socket) {
        socket.emit('inspection-cancelled', {
          imageName: decodedImageName,
          message: 'Inspection cancelled by user'
        });
      }

      res.json({
        success: true,
        imageName: decodedImageName,
        message: 'Inspection cancelled'
      });

    } catch (error) {
      console.error(`Cancel inspection error for ${req.path}:`, error);
      res.status(500).json({
        error: 'Failed to cancel inspection',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/inspect/:imageName*
 * Analyze a Docker image using dive (supports images with slashes in names)
 * IMPORTANT: This wildcard route must be LAST to avoid conflicts
 */
router.post('/:imageName*',
  async (req, res) => {
    try {
      const decodedImageName = getImageNameFromRequest(req);
      
      if (!decodedImageName) {
        return res.status(400).json({
          error: 'Image name is required',
          path: req.path
        });
      }

      const validation = validateImageName(decodedImageName);
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid image name',
          imageName: decodedImageName,
          message: validation.reason
        });
      }
      
      console.log(`Starting inspection for image: ${decodedImageName}`);
      
      // Get WebSocket connections for real-time updates
      const io = req.app.get('io');
      const inspectionSockets = req.app.get('inspectionSockets');
      const socket = inspectionSockets.get(decodedImageName);
      
      // Initialize progress tracking
      inspectionProgress.set(decodedImageName, {
        status: 'starting',
        progress: 0,
        message: 'Initializing analysis...',
        startTime: new Date()
      });

      const progressCallback = (update) => {
        // Update progress tracking
        inspectionProgress.set(decodedImageName, {
          ...inspectionProgress.get(decodedImageName),
          ...update,
          lastUpdate: new Date()
        });
        
        // Send real-time update via WebSocket
        if (socket) {
          socket.emit('inspection-update', {
            imageName: decodedImageName,
            ...update
          });
        }
      };

      // Check if Docker is available
      const dockerAvailable = await dockerUtils.isDockerAvailable();
      if (!dockerAvailable) {
        throw new Error('Docker is not available or not accessible');
      }

      // Check if dive is available
      const diveAvailable = await diveUtils.isDiveAvailable();
      if (!diveAvailable) {
        throw new Error('Dive tool is not available');
      }

      // Step 1: Check if image exists locally, if not pull it
      progressCallback({
        status: 'checking',
        progress: 10,
        message: 'Checking if image exists locally...'
      });

      const imageExists = await dockerUtils.imageExists(decodedImageName);
      
      if (!imageExists) {
        progressCallback({
          status: 'pulling',
          progress: 20,
          message: 'Image not found locally, pulling from registry...'
        });

        await dockerUtils.pullImage(decodedImageName, (pullUpdate) => {
          progressCallback({
            status: 'pulling',
            progress: Math.min(20 + (pullUpdate.progress || 0) * 0.4, 60), // 20-60%
            message: pullUpdate.message || 'Pulling image...'
          });
        });
      }

      // Step 2: Run dive analysis
      progressCallback({
        status: 'analyzing',
        progress: 60,
        message: 'Starting dive analysis...'
      });

      const analysis = await diveUtils.executeDive(decodedImageName);

      progressCallback({
        status: 'analyzing',
        progress: 95,
        message: 'Processing analysis results...'
      });

      // Step 3: Complete analysis
      progressCallback({
        status: 'complete',
        progress: 100,
        message: 'Analysis complete!'
      });

      // Clean up progress tracking
      setTimeout(() => {
        inspectionProgress.delete(decodedImageName);
      }, 300000); // Keep for 5 minutes

      res.json({
        success: true,
        imageName: decodedImageName,
        analysis,
        completedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Inspection error for ${req.params.imageName}:`, error);
      
      const decodedImageName = getImageNameFromRequest(req);
      
      // Update progress with error
      inspectionProgress.set(decodedImageName, {
        status: 'error',
        progress: 0,
        message: error.message,
        error: error.message,
        errorTime: new Date()
      });

      // Send error via WebSocket
      const inspectionSockets = req.app.get('inspectionSockets');
      const socket = inspectionSockets.get(decodedImageName);
      if (socket) {
        socket.emit('inspection-error', {
          imageName: decodedImageName,
          error: error.message
        });
      }

      res.status(failureStatusFor(error)).json({
        error: 'Failed to inspect image',
        imageName: decodedImageName,
        message: error.message
      });
    }
  }
);

module.exports = router;
