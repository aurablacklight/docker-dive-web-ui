const express = require('express');
const { param, validationResult } = require('express-validator');
const diveUtils = require('../utils/dive');
const dockerUtils = require('../utils/docker');
const catUtils = require('../utils/cat');

const router = express.Router();

// Store inspection progress for real-time updates
const inspectionProgress = new Map();

/**
 * POST /api/inspect/:imageName
 * Analyze a Docker image using dive
 */
router.post('/:imageName',
  [
    param('imageName')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Image name must be between 1 and 255 characters')
      .matches(/^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]*(:[a-zA-Z0-9._-]+)?$/)
      .withMessage('Invalid image name format')
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const { imageName } = req.params;
        const decodedImageName = decodeURIComponent(imageName);
        
        console.log(`Invalid image name "${decodedImageName}", showing cats instead! 🐱`);
        
        // Generate cat results for invalid image names
        const catResults = await catUtils.generateCatResults(decodedImageName, 5);
        
        // Return cat inspection results instead of validation error
        return res.status(200).json({
          imageName: decodedImageName,
          analysis: {
            is_cat_fallback: true,
            message: 'Image name validation failed, but here are some cats to inspect! 🐱',
            cat_message: 'Purr-fect! These cats are much easier to analyze than that confusing image name!',
            results: catResults.results,
            cat_stats: catResults.cat_stats,
            layers: catResults.results.map((cat, index) => ({
              id: `cat-layer-${index + 1}`,
              command: `RUN curl -s "${cat.cat_image_url}" > /tmp/cat-${index + 1}.jpg`,
              size: Math.floor(Math.random() * 1000000) + 100000, // Random size between 100KB-1MB
              efficiency: Math.random() * 100,
              cat_data: {
                image_url: cat.cat_image_url,
                says_url: cat.cat_says_url,
                tag: cat.cat_tag,
                description: cat.short_description
              }
            }))
          },
          efficiency: {
            score: Math.floor(Math.random() * 100) + 1,
            wastedBytes: Math.floor(Math.random() * 1000000),
            wastedPercent: Math.floor(Math.random() * 50),
            is_cat_analysis: true
          },
          summary: {
            totalLayers: catResults.results.length,
            totalSize: catResults.results.length * 500000, // Approximate total size
            baseImage: 'scratch/cats:latest',
            is_cat_summary: true,
            original_image_name: decodedImageName
          }
        });
      }

      const { imageName } = req.params;
      const decodedImageName = decodeURIComponent(imageName);
      
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

      const analysis = await diveUtils.executeDive(decodedImageName, (diveUpdate) => {
        progressCallback({
          status: 'analyzing',
          progress: Math.min(60 + (diveUpdate.progress || 0) * 0.35, 95), // 60-95%
          message: diveUpdate.message || 'Analyzing image layers...'
        });
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
      
      const decodedImageName = decodeURIComponent(req.params.imageName);
      
      // Check if this is a 400-like error or inspection failure
      if (error.message && (
        error.message.includes('400') || 
        error.message.includes('Bad Request') ||
        error.message.includes('not found') ||
        error.message.includes('invalid') ||
        error.message.includes('Failed to') ||
        error.response?.status === 400
      )) {
        console.log(`Inspection failed for "${decodedImageName}", showing cats instead! 🐱`);
        
        try {
          // Generate cat inspection results instead of showing error
          const catResults = await catUtils.generateCatResults(decodedImageName, 8);
          
          // Update progress with cat success
          inspectionProgress.set(decodedImageName, {
            status: 'completed',
            progress: 100,
            message: 'Cat inspection completed successfully! 🐱',
            is_cat_result: true,
            completedTime: new Date()
          });

          // Send cat success via WebSocket
          const inspectionSockets = req.app.get('inspectionSockets');
          const socket = inspectionSockets.get(decodedImageName);
          if (socket) {
            socket.emit('inspection-complete', {
              imageName: decodedImageName,
              is_cat_fallback: true,
              message: 'Image inspection failed, but cat analysis succeeded! 🐱'
            });
          }

          // Return cat inspection results with a 200 status (not an error for the frontend)
          return res.status(200).json({
            success: true,
            imageName: decodedImageName,
            analysis: {
              is_cat_fallback: true,
              message: 'Original image inspection failed, but here are some cats to analyze instead! 🐱',
              cat_message: 'These cats are much more photogenic than that problematic Docker image!',
              results: catResults.results,
              cat_stats: catResults.cat_stats,
              layers: catResults.results.map((cat, index) => ({
                id: `cat-layer-${index + 1}`,
                command: `RUN curl -s "${cat.cat_image_url}" > /tmp/cat-${index + 1}.jpg`,
                size: Math.floor(Math.random() * 2000000) + 100000, // Random size between 100KB-2MB
                efficiency: 85 + Math.random() * 15, // Cats are very efficient!
                wastedBytes: Math.floor(Math.random() * 10000), // Cats don't waste much
                cat_data: {
                  image_url: cat.cat_image_url,
                  says_url: cat.cat_says_url,
                  json_url: cat.cat_json_url,
                  tag: cat.cat_tag,
                  description: cat.short_description,
                  facts: cat.cat_facts
                }
              })),
              original_error: error.message
            },
            efficiency: {
              score: 90 + Math.floor(Math.random() * 10), // Cats are very efficient
              wastedBytes: Math.floor(Math.random() * 50000), // Minimal waste
              wastedPercent: Math.floor(Math.random() * 5), // Very low waste
              is_cat_analysis: true,
              message: 'Cats are naturally efficient creatures! 🐱'
            },
            summary: {
              totalLayers: catResults.results.length,
              totalSize: catResults.results.reduce((sum, cat, index) => 
                sum + (100000 + Math.floor(Math.random() * 2000000)), 0),
              baseImage: 'scratch/cats:latest',
              is_cat_summary: true,
              original_image_name: decodedImageName,
              cat_count: catResults.results.length
            },
            completedAt: new Date().toISOString()
          });
        } catch (catError) {
          console.error('Failed to generate cat fallback:', catError);
          // Fall through to regular error handling
        }
      }
      
      // For other types of errors, use regular error handling
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

      res.status(500).json({
        error: 'Failed to inspect image',
        imageName: decodedImageName,
        message: error.message
      });
    }
  }
);

/**
 * GET /api/inspect/:imageName/status
 * Get the status of an ongoing inspection
 */
router.get('/:imageName/status', 
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
      console.error(`Status check error for ${req.params.imageName}:`, error);
      res.status(500).json({
        error: 'Failed to get inspection status',
        message: error.message
      });
    }
  }
);

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
 * DELETE /api/inspect/:imageName
 * Cancel an ongoing inspection
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
        console.log('Delete validation error, generating cat fallback...');
        const catResult = await catUtils.generateCatInspectionResult(
          'invalid-image', 
          'Validation Error - Invalid Parameters',
          { validationErrors: errors.array() }
        );
        return res.status(200).json(catResult);
      }

      const { imageName } = req.params;
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
      console.error(`Cancel inspection error for ${req.params.imageName}:`, error);
      res.status(500).json({
        error: 'Failed to cancel inspection',
        message: error.message
      });
    }
  }
);

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

module.exports = router;
