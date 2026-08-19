const express = require('express');
const path = require('path');
const fsp = require('fs').promises;
const fs = require('fs-extra');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const dockerUtils = require('../utils/docker');
const { validateImageName } = require('../utils/image-name');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', 'temp', 'uploads');
fs.ensureDirSync(uploadsDir);

const parseUploadMaxBytes = () => {
  const parsed = parseInt(process.env.UPLOAD_MAX_BYTES, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1024 * 1024 * 1024;
};
const UPLOAD_MAX_BYTES = parseUploadMaxBytes();

const uploadMiddleware = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `upload-${uuidv4()}.tar`)
  }),
  limits: { fileSize: UPLOAD_MAX_BYTES }
}).single('image');

const XZ_MAGIC = Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]);

// docker load accepts plain tar plus gzip/bzip2/xz/zstd compressed tars
const isTarArchive = async (filePath) => {
  const header = Buffer.alloc(262);
  const handle = await fsp.open(filePath, 'r');
  let bytesRead;
  try {
    ({ bytesRead } = await handle.read(header, 0, 262, 0));
  } finally {
    await handle.close();
  }

  if (bytesRead >= 2 && header[0] === 0x1f && header[1] === 0x8b) return true;
  if (bytesRead >= 3 && header.toString('latin1', 0, 3) === 'BZh') return true;
  if (bytesRead >= 6 && header.subarray(0, 6).equals(XZ_MAGIC)) return true;
  if (bytesRead >= 4 && header.readUInt32LE(0) === 0xfd2fb528) return true;
  if (bytesRead >= 262 && header.toString('latin1', 257, 262) === 'ustar') return true;
  return false;
};

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
 * POST /api/images/upload
 * Upload a docker save tarball and load it into the Docker daemon
 */
router.post('/upload', (req, res) => {
  uploadMiddleware(req, res, async (multerError) => {
    const tempPath = req.file ? req.file.path : null;
    let status = 200;
    let payload = null;

    try {
      if (multerError) {
        if (multerError.code === 'LIMIT_FILE_SIZE') {
          status = 413;
          payload = {
            error: 'File too large',
            message: `Uploads are limited to ${UPLOAD_MAX_BYTES} bytes`
          };
        } else {
          status = 400;
          payload = {
            error: 'Upload failed',
            message: multerError.message
          };
        }
      } else if (!req.file) {
        status = 400;
        payload = {
          error: 'No image file uploaded',
          message: 'Attach a docker save tarball as multipart field "image"'
        };
      } else if (!(await isTarArchive(tempPath))) {
        status = 400;
        payload = {
          error: 'Invalid file type',
          message: 'File is not a tar archive or compressed tar archive'
        };
      } else if (!(await dockerUtils.isDockerAvailable())) {
        status = 503;
        payload = {
          error: 'Docker is not available or not accessible'
        };
      } else {
        console.log(`Loading uploaded image tarball: ${tempPath}`);
        const result = await dockerUtils.loadImage(tempPath);
        payload = {
          success: true,
          loadedImages: result.loadedImages,
          loadedImageIds: result.loadedImageIds,
          output: result.output,
          uploadedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.error('Upload image error:', error);
      status = 502;
      payload = {
        error: 'Failed to load image',
        message: error.message
      };
    } finally {
      if (tempPath) {
        try {
          await fs.remove(tempPath);
        } catch (cleanupError) {
          console.error(`Failed to remove uploaded temp file ${tempPath}:`, cleanupError);
        }
      }
    }

    res.status(status).json(payload);
  });
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
