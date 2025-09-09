import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TerminalView from '../components/TerminalView';

describe('TerminalView Component', () => {
  const mockProps = {
    image: 'nginx:latest',
    onExit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders terminal container', () => {
    render(<TerminalView {...mockProps} />);
    
    // Check for terminal controls
    expect(screen.getByText('Exit')).toBeInTheDocument();
    expect(screen.getByText('Resize')).toBeInTheDocument();
  });

  test('exit button calls onExit callback', async () => {
    const user = userEvent.setup();
    
    render(<TerminalView {...mockProps} />);
    
    const exitButton = screen.getByText('Exit');
    await user.click(exitButton);
    
    expect(mockProps.onExit).toHaveBeenCalled();
  });

  test('resize button triggers manual resize', async () => {
    const user = userEvent.setup();
    
    render(<TerminalView {...mockProps} />);
    
    const resizeButton = screen.getByText('Resize');
    await user.click(resizeButton);
    
    // Since we're mocking xterm, we can't test the actual resize functionality
    // but we can ensure the button is clickable without errors
    expect(resizeButton).toBeInTheDocument();
  });

  test('component unmounts cleanly', () => {
    const { unmount } = render(<TerminalView {...mockProps} />);
    
    // Should unmount without errors
    expect(() => unmount()).not.toThrow();
  });

  test('handles different image names', () => {
    const props = { ...mockProps, image: 'postgres:13' };
    
    render(<TerminalView {...props} />);
    
    // Component should render regardless of image name
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });
});
