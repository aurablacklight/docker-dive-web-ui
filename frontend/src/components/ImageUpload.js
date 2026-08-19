// The production babel config (.babelrc) uses the classic JSX runtime, which
// requires React in scope; only the test env uses the automatic runtime.
import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { uploadImage } from '../services/api';

const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GiB, matches the backend limit
const ACCEPTED_EXTENSIONS = '.tar,.tar.gz,.tgz,.tar.bz2,.tar.xz,.tar.zst';

const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${units[i]}`;
};

const ImageUpload = ({ onUploaded, onInspect }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [loadedRefs, setLoadedRefs] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const selectFile = (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setError(null);
    setLoadedRefs([]);
    setProgress(0);
  };

  const clearSelection = () => {
    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleFileChange = (e) => {
    selectFile(e.target.files && e.target.files[0]);
  };

  const handleDragOver = (e) => {
    // Not preventing the default keeps the browser's "no drop" cursor while an
    // upload is in flight, matching the disabled file input.
    if (uploading) return;
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    // A drop mid-upload would be silently discarded by clearSelection() when the
    // in-flight request resolves, so ignore it entirely.
    if (uploading) return;
    selectFile(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file || uploading) return;

    // Client-side pre-check: never send a request we know the server rejects.
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `File is too large (${formatSize(file.size)}). Maximum upload size is 1 GB.`
      );
      return;
    }

    setError(null);
    setLoadedRefs([]);
    setProgress(0);
    setUploading(true);

    try {
      const data = await uploadImage(file, setProgress);
      const loadedImages = data.loadedImages || [];
      const refs = loadedImages.length > 0 ? loadedImages : data.loadedImageIds || [];

      setLoadedRefs(refs);
      clearSelection();

      if (onUploaded) {
        onUploaded(loadedImages);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      // Keep the file selected so the user can retry.
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Bare image IDs are rejected by the backend image-name validator and never
  // appear in the Local Images list, so they get a retag hint instead of Inspect.
  const inspectableRefs = loadedRefs.filter((ref) => !ref.startsWith('sha256:'));
  const untaggedRefs = loadedRefs.filter((ref) => ref.startsWith('sha256:'));

  return (
    <div
      className={`upload-card ${dragActive ? 'drag-active' : ''}`}
      data-testid="image-upload-card"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h3 className="upload-title">📤 Upload Local Image</h3>

      <div className="upload-controls">
        <label className="upload-choose-btn" htmlFor="image-upload-input">
          Choose file…
        </label>
        <input
          id="image-upload-input"
          ref={inputRef}
          className="upload-file-input"
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          disabled={uploading}
        />

        <button
          type="button"
          className="btn-primary upload-submit-btn"
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {file && (
        <p className="upload-filename">{`${file.name} (${formatSize(file.size)})`}</p>
      )}

      <p className="upload-hint">
        Build locally, then <code>docker save myimage:tag -o myimage.tar</code> — max 1 GB
        (uploads over ~100 MB may fail through Cloudflare).
      </p>

      {uploading && (
        <div className="upload-progress">
          <div
            className="upload-progress-track"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Upload progress"
          >
            <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="upload-progress-label">
            {progress >= 100 ? 'Loading into Docker…' : `${progress}%`}
          </span>
        </div>
      )}

      {error && <p className="upload-error">{error}</p>}

      {loadedRefs.length > 0 && (
        <div className="upload-success">
          <p className="upload-success-text">{`Loaded: ${loadedRefs.join(', ')}`}</p>
          {inspectableRefs.length > 0 && (
            <div className="upload-success-actions">
              {inspectableRefs.map((ref) => (
                <button
                  key={ref}
                  type="button"
                  className="btn-secondary"
                  onClick={() => onInspect(ref)}
                >
                  Inspect
                </button>
              ))}
            </div>
          )}
          {untaggedRefs.map((ref) => (
            <p className="upload-untagged-hint" key={ref}>
              Untagged image — run <code>{`docker tag ${ref} myname:tag`}</code> locally and
              re-save to inspect it here.
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

ImageUpload.propTypes = {
  onUploaded: PropTypes.func,
  onInspect: PropTypes.func.isRequired,
};

export default ImageUpload;
