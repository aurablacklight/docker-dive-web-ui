import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../components/SearchBar';

describe('SearchBar Component', () => {
  const mockProps = {
    onSearch: jest.fn(),
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders search input and button', () => {
    render(<SearchBar {...mockProps} />);
    
    expect(screen.getByPlaceholderText('Search Docker images (e.g., nginx, node, ubuntu)...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  test('calls onSearch when form is submitted with valid input', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...mockProps} />);
    
    const input = screen.getByPlaceholderText('Search Docker images (e.g., nginx, node, ubuntu)...');
    const searchButton = screen.getByRole('button', { name: /search/i });
    
    await user.type(input, 'nginx');
    await user.click(searchButton);
    
    expect(mockProps.onSearch).toHaveBeenCalledWith('nginx');
  });

  test('calls onSearch when Enter key is pressed', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...mockProps} />);
    
    const input = screen.getByPlaceholderText('Search Docker images (e.g., nginx, node, ubuntu)...');
    await user.type(input, 'nginx');
    await user.keyboard('{Enter}');
    
    expect(mockProps.onSearch).toHaveBeenCalledWith('nginx');
  });

  test('shows loading state when loading is true', () => {
    render(<SearchBar {...mockProps} loading={true} />);
    
    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search Docker images (e.g., nginx, node, ubuntu)...')).toBeDisabled();
  });

  test('renders popular search buttons', () => {
    render(<SearchBar {...mockProps} />);
    
    expect(screen.getByText('Popular searches:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'nginx' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'node' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ubuntu' })).toBeInTheDocument();
  });

  test('calls onSearch when popular search button is clicked', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...mockProps} />);
    
    const nginxButton = screen.getByRole('button', { name: 'nginx' });
    await user.click(nginxButton);
    
    expect(mockProps.onSearch).toHaveBeenCalledWith('nginx');
  });

  test('disables buttons when loading', () => {
    render(<SearchBar {...mockProps} loading={true} />);
    
    const searchButton = screen.getByRole('button', { name: /searching/i });
    const nginxButton = screen.getByRole('button', { name: 'nginx' });
    
    expect(searchButton).toBeDisabled();
    expect(nginxButton).toBeDisabled();
  });

  test('does not call onSearch with empty input', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...mockProps} />);
    
    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);
    
    expect(mockProps.onSearch).not.toHaveBeenCalled();
  });
});
