import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUpload from '../components/ImageUpload';
import { uploadImage } from '../services/api';

// Mock only the API surface this component uses; the real module (and the axios
// harness behind it) is never loaded here.
jest.mock('../services/api', () => ({
  uploadImage: jest.fn(),
}));

const makeFile = (name = 'myimage.tar', size = null) => {
  const file = new File(['tarball'], name, { type: 'application/x-tar' });
  if (size !== null) {
    Object.defineProperty(file, 'size', { value: size });
  }
  return file;
};

describe('ImageUpload Component', () => {
  const mockProps = {
    onUploaded: jest.fn(),
    onInspect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the upload card, file chooser and helper line', () => {
    render(<ImageUpload {...mockProps} />);

    expect(screen.getByText('📤 Upload Local Image')).toBeInTheDocument();
    expect(screen.getByText('Choose file…')).toBeInTheDocument();
    expect(screen.getByText(/max 1 GB/)).toBeInTheDocument();
    expect(screen.getByText(/may fail through Cloudflare/)).toBeInTheDocument();
    expect(screen.getByText('docker save myimage:tag -o myimage.tar')).toBeInTheDocument();
  });

  test('file input accepts docker save tarball extensions', () => {
    render(<ImageUpload {...mockProps} />);

    expect(screen.getByLabelText('Choose file…')).toHaveAttribute(
      'accept',
      '.tar,.tar.gz,.tgz,.tar.bz2,.tar.xz,.tar.zst'
    );
  });

  test('selecting a file shows its name and human readable size', async () => {
    const user = userEvent.setup();
    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile('myimage.tar', 2048));

    expect(screen.getByText('myimage.tar (2 KB)')).toBeInTheDocument();
  });

  test('dropping a file onto the card selects it', () => {
    render(<ImageUpload {...mockProps} />);

    fireEvent.drop(screen.getByTestId('image-upload-card'), {
      dataTransfer: { files: [makeFile('dropped.tar', 1024)] },
    });

    expect(screen.getByText('dropped.tar (1 KB)')).toBeInTheDocument();
  });

  test('successful upload reports refs, renders them and wires Inspect', async () => {
    const user = userEvent.setup();
    uploadImage.mockResolvedValue({
      success: true,
      loadedImages: ['myimage:latest'],
      loadedImageIds: [],
    });

    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile());
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => {
      expect(screen.getByText('Loaded: myimage:latest')).toBeInTheDocument();
    });

    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(uploadImage.mock.calls[0][0]).toBeInstanceOf(File);
    expect(typeof uploadImage.mock.calls[0][1]).toBe('function');
    expect(mockProps.onUploaded).toHaveBeenCalledWith(['myimage:latest']);

    await user.click(screen.getByRole('button', { name: 'Inspect' }));
    expect(mockProps.onInspect).toHaveBeenCalledWith('myimage:latest');

    // Tagged refs are inspectable, so no untagged hint is shown
    expect(screen.queryByText(/Untagged image/)).not.toBeInTheDocument();

    // Selection is cleared after a successful upload
    expect(screen.queryByText(/myimage\.tar \(/)).not.toBeInTheDocument();
  });

  test('renders an Inspect button for every tagged ref', async () => {
    const user = userEvent.setup();
    uploadImage.mockResolvedValue({
      success: true,
      loadedImages: ['myimage:latest', 'myimage:v2'],
      loadedImageIds: [],
    });

    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile());
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => {
      expect(screen.getByText('Loaded: myimage:latest, myimage:v2')).toBeInTheDocument();
    });

    expect(screen.getAllByRole('button', { name: 'Inspect' })).toHaveLength(2);
  });

  test('falls back to loadedImageIds when loadedImages is empty', async () => {
    const user = userEvent.setup();
    uploadImage.mockResolvedValue({
      success: true,
      loadedImages: [],
      loadedImageIds: ['sha256:abc123'],
    });

    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile());
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => {
      expect(screen.getByText('Loaded: sha256:abc123')).toBeInTheDocument();
    });
  });

  test('offers no Inspect button for bare image IDs, shows a retag hint instead', async () => {
    const user = userEvent.setup();
    uploadImage.mockResolvedValue({
      success: true,
      loadedImages: [],
      loadedImageIds: ['sha256:abc123'],
    });

    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile());
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => {
      expect(screen.getByText('Loaded: sha256:abc123')).toBeInTheDocument();
    });

    // A bare ID is rejected by the backend name validator, so never offer Inspect
    expect(screen.queryByRole('button', { name: 'Inspect' })).not.toBeInTheDocument();
    expect(screen.getByText(/Untagged image/)).toBeInTheDocument();
    expect(screen.getByText('docker tag sha256:abc123 myname:tag')).toBeInTheDocument();
  });

  test('shows progress percent, then "Loading into Docker…" after 100%', async () => {
    const user = userEvent.setup();
    let reportProgress;
    let finishUpload;
    uploadImage.mockImplementation((file, onProgress) => {
      reportProgress = onProgress;
      return new Promise((resolve) => {
        finishUpload = resolve;
      });
    });

    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile());
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    act(() => reportProgress(42));
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');

    act(() => reportProgress(100));
    expect(screen.getByText('Loading into Docker…')).toBeInTheDocument();

    await act(async () => {
      finishUpload({ success: true, loadedImages: ['done:latest'], loadedImageIds: [] });
    });

    expect(screen.getByText('Loaded: done:latest')).toBeInTheDocument();
    expect(screen.queryByText('Loading into Docker…')).not.toBeInTheDocument();
  });

  test('ignores drag-and-drop while an upload is in flight', async () => {
    const user = userEvent.setup();
    let finishUpload;
    uploadImage.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        })
    );

    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile('first.tar', 1024));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    const card = screen.getByTestId('image-upload-card');
    expect(screen.getByText('first.tar (1 KB)')).toBeInTheDocument();

    // The drop cursor must not suggest the card accepts a file right now
    fireEvent.dragOver(card);
    expect(card).not.toHaveClass('drag-active');

    fireEvent.drop(card, {
      dataTransfer: { files: [makeFile('second.tar', 2048)] },
    });

    // Selection is untouched, so the resolving upload cannot discard a new file
    expect(screen.getByText('first.tar (1 KB)')).toBeInTheDocument();
    expect(screen.queryByText('second.tar (2 KB)')).not.toBeInTheDocument();

    await act(async () => {
      finishUpload({ success: true, loadedImages: ['first:latest'], loadedImageIds: [] });
    });

    expect(screen.getByText('Loaded: first:latest')).toBeInTheDocument();
    expect(uploadImage).toHaveBeenCalledTimes(1);
  });

  test('failed upload renders the error and keeps the file selected', async () => {
    const user = userEvent.setup();
    uploadImage.mockRejectedValue(new Error('502: Failed to load image'));

    render(<ImageUpload {...mockProps} />);

    await user.upload(screen.getByLabelText('Choose file…'), makeFile('myimage.tar', 2048));
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    await waitFor(() => {
      expect(screen.getByText('502: Failed to load image')).toBeInTheDocument();
    });

    expect(mockProps.onUploaded).not.toHaveBeenCalled();
    // File stays selected so the user can retry
    expect(screen.getByText('myimage.tar (2 KB)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^upload$/i })).toBeEnabled();
  });

  test('rejects files over 1 GiB locally without sending a request', async () => {
    const user = userEvent.setup();
    render(<ImageUpload {...mockProps} />);

    await user.upload(
      screen.getByLabelText('Choose file…'),
      makeFile('huge.tar', 1024 * 1024 * 1024 + 1)
    );
    await user.click(screen.getByRole('button', { name: /^upload$/i }));

    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  test('upload button is disabled until a file is selected', () => {
    render(<ImageUpload {...mockProps} />);

    expect(screen.getByRole('button', { name: /^upload$/i })).toBeDisabled();
  });
});
