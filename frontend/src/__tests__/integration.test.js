import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as api from '../services/api';

// Mock the entire API module
jest.mock('../services/api');

describe('App Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm = jest.fn(() => true);
  });

  test('complete search and inspect workflow', async () => {
    const user = userEvent.setup();
    
    // Mock search results
    const searchResults = [
      { name: 'nginx:latest', description: 'Official nginx image' }
    ];
    
    // Mock inspection data
    const inspectionData = {
      analysis: {
        analysis: {
          totalLayers: 3,
          totalSize: 50000000,
          wastedSpace: 5000000,
          efficiency: 90
        },
        layers: [
          {
            id: 'layer1',
            size: 20000000,
            command: 'FROM nginx:alpine',
            efficiency: 95,
            wasted_size: 0
          },
          {
            id: 'layer2',
            size: 25000000,
            command: 'RUN apt-get update && apt-get install -y curl',
            efficiency: 85,
            wasted_size: 3000000
          },
          {
            id: 'layer3',
            size: 5000000,
            command: 'COPY . /usr/share/nginx/html',
            efficiency: 98,
            wasted_size: 2000000
          }
        ]
      }
    };
    
    api.searchImages.mockResolvedValue(searchResults);
    api.inspectImage.mockResolvedValue(inspectionData);
    
    render(<App />);
    
    // Step 1: Search for an image
    const searchInput = screen.getByPlaceholderText(/search for docker images/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    await user.type(searchInput, 'nginx');
    await user.click(searchButton);
    
    // Wait for search results
    await waitFor(() => {
      expect(screen.getByText('nginx:latest')).toBeInTheDocument();
    });
    
    // Step 2: Inspect the image
    const inspectButton = screen.getByText(/pull and inspect/i);
    await user.click(inspectButton);
    
    // Wait for inspection to complete
    await waitFor(() => {
      expect(screen.getByText(/analyzing: nginx:latest/i)).toBeInTheDocument();
    });
    
    // Check that inspection data is displayed
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // Total layers
      expect(screen.getByText('47.7 MB')).toBeInTheDocument(); // Total size
      expect(screen.getByText('4.8 MB')).toBeInTheDocument(); // Wasted space
    });
    
    // Check that layers are displayed
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    
    // Step 3: Test terminal toggle
    const terminalButton = screen.getByText(/💻 interactive terminal/i);
    await user.click(terminalButton);
    
    // Should show terminal view
    await waitFor(() => {
      expect(screen.getByText(/interactive dive terminal - nginx:latest/i)).toBeInTheDocument();
    });
    
    // Should have terminal controls
    expect(screen.getByText('Exit')).toBeInTheDocument();
    expect(screen.getByText('Resize')).toBeInTheDocument();
    
    // Step 4: Switch back to analysis
    const analysisButton = screen.getByText(/📊 show analysis/i);
    await user.click(analysisButton);
    
    // Should show analysis again
    await waitFor(() => {
      expect(screen.getByText('Total Layers')).toBeInTheDocument();
    });
    
    // Step 5: Go back to search
    const backButton = screen.getByText(/← back to search/i);
    await user.click(backButton);
    
    // Should be back at search view
    await waitFor(() => {
      expect(screen.getByText(/dive docker image inspector/i)).toBeInTheDocument();
    });
  });

  test('error handling throughout the workflow', async () => {
    const user = userEvent.setup();
    
    // Mock search error
    api.searchImages.mockRejectedValue(new Error('Search service unavailable'));
    
    render(<App />);
    
    const searchInput = screen.getByPlaceholderText(/search for docker images/i);
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    await user.type(searchInput, 'nginx');
    await user.click(searchButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/search failed: search service unavailable/i)).toBeInTheDocument();
    });
    
    // Test inspection error
    api.searchImages.mockResolvedValue([{ name: 'nginx', description: 'nginx' }]);
    api.inspectImage.mockRejectedValue(new Error('Inspection failed'));
    
    await user.clear(searchInput);
    await user.type(searchInput, 'nginx');
    await user.click(searchButton);
    
    await waitFor(() => {
      expect(screen.getByText('nginx')).toBeInTheDocument();
    });
    
    const inspectButton = screen.getByText(/pull and inspect/i);
    await user.click(inspectButton);
    
    await waitFor(() => {
      expect(screen.getByText(/inspection failed: inspection failed/i)).toBeInTheDocument();
    });
  });

  test('cleanup workflow with success and cancellation', async () => {
    const user = userEvent.setup();
    
    // Mock successful cleanup
    const cleanupResult = {
      success: true,
      details: { deletedCount: 10, protectedImages: ['nginx:latest'] }
    };
    api.cleanupAllImages.mockResolvedValue(cleanupResult);
    
    render(<App />);
    
    const cleanupButton = screen.getByText(/🧹 clean up images/i);
    await user.click(cleanupButton);
    
    await waitFor(() => {
      expect(screen.getByText(/success! deleted 10 images/i)).toBeInTheDocument();
    });
    
    // Test cleanup cancellation
    global.confirm = jest.fn(() => false);
    jest.clearAllMocks();
    
    await user.click(cleanupButton);
    
    expect(api.cleanupAllImages).not.toHaveBeenCalled();
  });
});
