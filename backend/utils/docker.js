const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const execAsync = promisify(exec);

/**
 * Docker utility functions for image operations
 */
class DockerUtils {
  constructor() {
    this.dockerCommand = 'docker';
  }

  /**
   * Pull a Docker image from registry
   * @param {string} imageName - Name of the image to pull
   * @param {function} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Pull result
   */
  async pullImage(imageName, progressCallback = null) {
    try {
      console.log(`Pulling Docker image: ${imageName}`);
      
      if (progressCallback) {
        // Use spawn for real-time progress
        return this.pullImageWithProgress(imageName, progressCallback);
      } else {
        // Use exec for simple pull
        const { stdout, stderr } = await execAsync(`${this.dockerCommand} pull ${imageName}`);
        
        return {
          success: true,
          imageName,
          output: stdout,
          error: stderr
        };
      }
    } catch (error) {
      console.error(`Failed to pull image ${imageName}:`, error);
      throw new Error(`Failed to pull image: ${error.message}`);
    }
  }

  /**
   * Pull image with real-time progress updates
   * @param {string} imageName - Name of the image to pull
   * @param {function} progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Pull result
   */
  pullImageWithProgress(imageName, progressCallback) {
    return new Promise((resolve, reject) => {
      const pullProcess = spawn(this.dockerCommand, ['pull', imageName]);
      let output = '';
      let errorOutput = '';

      pullProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        
        // Parse progress information
        const lines = chunk.split('\n').filter(line => line.trim());
        lines.forEach(line => {
          if (progressCallback) {
            progressCallback({
              type: 'progress',
              message: line.trim(),
              imageName
            });
          }
        });
      });

      pullProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.warn(`Docker pull stderr: ${chunk}`);
      });

      pullProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            imageName,
            output,
            error: errorOutput
          });
        } else {
          reject(new Error(`Docker pull failed with code ${code}: ${errorOutput}`));
        }
      });

      pullProcess.on('error', (error) => {
        reject(new Error(`Failed to start docker pull: ${error.message}`));
      });
    });
  }

  /**
   * List local Docker images
   * @returns {Promise<Array>} Array of image objects
   */
  async listImages() {
    try {
      const { stdout } = await execAsync(
        `${this.dockerCommand} images --format "{{.Repository}}:{{.Tag}}|{{.ID}}|{{.CreatedAt}}|{{.Size}}"`
      );

      const images = stdout
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [name, id, created, size] = line.split('|');
          return {
            name: name === '<none>:<none>' ? `${id.substring(0, 12)}` : name,
            id,
            created,
            size,
            repository: name.split(':')[0],
            tag: name.split(':')[1] || 'latest'
          };
        });

      return images;
    } catch (error) {
      console.error('Failed to list Docker images:', error);
      throw new Error(`Failed to list images: ${error.message}`);
    }
  }

  /**
   * Remove all Docker images except the ones running this service (safer cleanup!)
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupAllImages() {
    try {
      console.log('🧹 Performing SAFE cleanup - preserving service images');
      
      // Get list of images to exclude (the ones running this service)
      const servicesToProtect = [
        'dive-inspector-backend:latest',
        'dive-inspector-frontend:latest'
      ];
      
      // Get all images
      const allImages = await this.listImages();
      console.log(`Found ${allImages.length} total images`);
      
      // Filter out protected service images
      const imagesToDelete = allImages.filter(img => {
        const fullName = `${img.repository}:${img.tag}`;
        const isProtected = servicesToProtect.includes(fullName);
        if (isProtected) {
          console.log(`🛡️ PROTECTING service image: ${fullName}`);
        }
        return !isProtected;
      });
      
      console.log(`🗑️ Will delete ${imagesToDelete.length} images (protecting ${servicesToProtect.length} service images)`);
      
      let deletedCount = 0;
      let errors = [];
      
      // Delete images one by one to avoid deleting service images
      for (const image of imagesToDelete) {
        try {
          const fullName = `${image.repository}:${image.tag}`;
          console.log(`Deleting: ${fullName}`);
          await this.removeImage(fullName, true); // force remove
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${image.repository}:${image.tag}:`, error.message);
          errors.push(`${image.repository}:${image.tag} - ${error.message}`);
        }
      }
      
      // Also run docker system prune to clean up dangling resources
      try {
        const { stdout } = await execAsync(`${this.dockerCommand} system prune -f`);
        console.log('System prune completed:', stdout);
      } catch (pruneError) {
        console.error('System prune failed:', pruneError.message);
        errors.push(`System prune failed: ${pruneError.message}`);
      }

      return {
        success: true,
        message: `Safely deleted ${deletedCount} images (protected ${servicesToProtect.length} service images)`,
        output: `Deleted ${deletedCount} images`,
        deletedCount,
        protectedImages: servicesToProtect,
        errors: errors.length > 0 ? errors : null
      };
    } catch (error) {
      console.error('Failed to cleanup images safely:', error);
      throw new Error(`Failed to cleanup images: ${error.message}`);
    }
  }

  /**
   * Remove a Docker image
   * @param {string} imageName - Name or ID of the image to remove
   * @param {boolean} force - Whether to force removal
   * @returns {Promise<Object>} Remove result
   */
  async removeImage(imageName, force = false) {
    try {
      const forceFlag = force ? ' -f' : '';
      const { stdout, stderr } = await execAsync(
        `${this.dockerCommand} rmi${forceFlag} ${imageName}`
      );

      return {
        success: true,
        imageName,
        output: stdout,
        error: stderr
      };
    } catch (error) {
      console.error(`Failed to remove image ${imageName}:`, error);
      throw new Error(`Failed to remove image: ${error.message}`);
    }
  }

  /**
   * Get detailed information about an image
   * @param {string} imageName - Name of the image
   * @returns {Promise<Object>} Image information
   */
  async getImageInfo(imageName) {
    try {
      const { stdout } = await execAsync(
        `${this.dockerCommand} inspect ${imageName}`
      );

      const imageInfo = JSON.parse(stdout)[0];
      
      return {
        id: imageInfo.Id,
        created: imageInfo.Created,
        size: imageInfo.Size,
        virtualSize: imageInfo.VirtualSize,
        architecture: imageInfo.Architecture,
        os: imageInfo.Os,
        config: imageInfo.Config,
        rootfs: imageInfo.RootFS,
        metadata: imageInfo.ContainerConfig
      };
    } catch (error) {
      console.error(`Failed to get image info for ${imageName}:`, error);
      throw new Error(`Failed to get image info: ${error.message}`);
    }
  }

  /**
   * Check if Docker is available and accessible
   * @returns {Promise<boolean>} Whether Docker is available
   */
  async isDockerAvailable() {
    try {
      await execAsync(`${this.dockerCommand} --version`);
      return true;
    } catch (error) {
      console.error('Docker is not available:', error);
      return false;
    }
  }

  /**
   * Get Docker version information
   * @returns {Promise<Object>} Docker version info
   */
  async getDockerVersion() {
    try {
      const { stdout } = await execAsync(`${this.dockerCommand} version --format json`);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Failed to get Docker version:', error);
      throw new Error(`Failed to get Docker version: ${error.message}`);
    }
  }

  /**
   * Check if an image exists locally
   * @param {string} imageName - Name of the image to check
   * @returns {Promise<boolean>} Whether the image exists locally
   */
  async imageExists(imageName) {
    try {
      await execAsync(`${this.dockerCommand} inspect ${imageName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the history of an image (layers)
   * @param {string} imageName - Name of the image
   * @returns {Promise<Array>} Array of layer objects
   */
  async getImageHistory(imageName) {
    try {
      const { stdout } = await execAsync(
        `${this.dockerCommand} history ${imageName} --format "{{.ID}}|{{.CreatedBy}}|{{.Size}}|{{.CreatedAt}}" --no-trunc`
      );

      const layers = stdout
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map((line, index) => {
          const [id, command, size, created] = line.split('|');
          return {
            id,
            command: command.replace(/^\/bin\/sh -c #\(nop\) /, '').replace(/^\/bin\/sh -c /, 'RUN '),
            size,
            created,
            index
          };
        });

      return layers;
    } catch (error) {
      console.error(`Failed to get image history for ${imageName}:`, error);
      throw new Error(`Failed to get image history: ${error.message}`);
    }
  }
}

module.exports = new DockerUtils();
