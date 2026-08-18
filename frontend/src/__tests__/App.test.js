import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as api from '../services/api';

// Mock the API module
jest.mock('../services/api');

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders main app title', () => {
    render(<App />);
    expect(screen.getByText(/Dive Docker Image Inspector/i)).toBeInTheDocument();
  });

  test('shows popular images by default', () => {
    render(<App />);
    expect(screen.getByText('Popular Images')).toBeInTheDocument();
    expect(screen.getByText('nginx')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
  });

  test('search functionality works', async () => {
    const user = userEvent.setup();
    const mockSearchResults = [
      { name: 'test-image', description: 'Test image description' }
    ];

    api.searchImages.mockResolvedValue(mockSearchResults);

    render(<App />);

    const searchInput = screen.getByPlaceholderText(/search for docker images/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(searchInput, 'test');
    await user.click(searchButton);

    await waitFor(() => {
      expect(api.searchImages).toHaveBeenCalledWith('test');
    });

    await waitFor(() => {
      expect(screen.getByText('test-image')).toBeInTheDocument();
    });
  });

  test('clear search button works', async () => {
    const user = userEvent.setup();

    render(<App />);

    const searchInput = screen.getByPlaceholderText(/search for docker images/i);
    const clearButton = screen.getByRole('button', { name: /clear/i });

    await user.type(searchInput, 'test query');
    expect(searchInput.value).toBe('test query');

    await user.click(clearButton);
    expect(searchInput.value).toBe('');
  });

  test('inspect image button triggers inspection', async () => {
    const user = userEvent.setup();
    const mockInspectionData = {
      analysis: {
        analysis: { totalLayers: 5, totalSize: 1000, efficiency: 85 },
        layers: [
          { id: '1', size: 200, command: 'RUN apt-get update', efficiency: 90 }
        ]
      }
    };

    api.inspectImage.mockResolvedValue(mockInspectionData);

    render(<App />);

    const inspectButton = screen.getAllByText(/pull and inspect/i)[0];
    await user.click(inspectButton);

    await waitFor(() => {
      expect(api.inspectImage).toHaveBeenCalled();
    });
  });

  test('delete inspected image works with exact confirmation', async () => {
    const user = userEvent.setup();
    const mockInspectionData = {
      analysis: {
        analysis: { totalLayers: 5, totalSize: 1000, efficiency: 85 },
        layers: [
          { id: '1', size: 200, command: 'RUN apt-get update', efficiency: 90 }
        ]
      }
    };

    api.inspectImage.mockResolvedValue(mockInspectionData);
    api.removeImage.mockResolvedValue({ success: true, imageName: 'nginx:latest' });

    global.confirm = jest.fn(() => true);

    render(<App />);

    const inspectButton = screen.getAllByText(/pull and inspect/i)[0];
    await user.click(inspectButton);

    await waitFor(() => {
      expect(screen.getByText(/analyzing: nginx/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete image/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(api.removeImage).toHaveBeenCalledWith('nginx');
      expect(global.confirm).toHaveBeenCalledWith(
        'Delete nginx from this Docker Dive host?\nThis does not prune any other images or build cache.'
      );
      expect(screen.getByText(/deleted nginx from this docker dive host/i)).toBeInTheDocument();
    });
  });

  test('delete cancellation performs no API call', async () => {
    const user = userEvent.setup();
    const mockInspectionData = {
      analysis: {
        analysis: { totalLayers: 5, totalSize: 1000, efficiency: 85 },
        layers: [
          { id: '1', size: 200, command: 'RUN apt-get update', efficiency: 90 }
        ]
      }
    };

    api.inspectImage.mockResolvedValue(mockInspectionData);
    global.confirm = jest.fn(() => false);

    render(<App />);

    const inspectButton = screen.getAllByText(/pull and inspect/i)[0];
    await user.click(inspectButton);

    await waitFor(() => {
      expect(screen.getByText(/analyzing: nginx/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole('button', { name: /delete image/i });
    await user.click(deleteButton);

    expect(api.removeImage).not.toHaveBeenCalled();
  });

  test('handles search errors gracefully', async () => {
    const user = userEvent.setup();

    api.searchImages.mockRejectedValue(new Error('Network error'));

    render(<App />);

    const searchInput = screen.getByPlaceholderText(/search for docker images/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(searchInput, 'test');
    await user.click(searchButton);

    await waitFor(() => {
      expect(screen.getByText(/search failed: network error/i)).toBeInTheDocument();
    });
  });

  test('handles inspect errors gracefully', async () => {
    const user = userEvent.setup();

    api.inspectImage.mockRejectedValue(new Error('Inspection failed'));

    render(<App />);

    const inspectButton = screen.getAllByText(/pull and inspect/i)[0];
    await user.click(inspectButton);

    await waitFor(() => {
      expect(screen.getByText(/inspection failed: inspection failed/i)).toBeInTheDocument();
    });
  });

  test('loading states work correctly', async () => {
    const user = userEvent.setup();

    // Make searchImages hang
    api.searchImages.mockImplementation(() => new Promise(() => {}));

    render(<App />);

    const searchInput = screen.getByPlaceholderText(/search for docker images/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    await user.type(searchInput, 'test');
    await user.click(searchButton);

    expect(screen.getByText(/searching for images/i)).toBeInTheDocument();
  });
});
