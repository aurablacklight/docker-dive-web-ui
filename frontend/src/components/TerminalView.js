import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io } from 'socket.io-client';
import 'xterm/css/xterm.css';

const TerminalView = ({ image, onExit }) => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const socketRef = useRef(null);
  const fitRef = useRef(null);
  const mountedRef = useRef(true);
  const initTimeoutRef = useRef(null);

  // Reset mounted flag on mount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Guard against strict-mode double init
    if (termRef.current) {
      return;
    }

    const term = new Terminal();
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    // CHECKLIST: open FIRST, FIT AFTER (rAF is your friend)
    term.open(containerRef.current);
    
    // Wait for DOM and renderer to be ready using requestAnimationFrame
    const initializeTerminal = () => {
      // Don't proceed if component unmounted
      if (!mountedRef.current) return;
      
      try {
        // CHECKLIST: ensure the container is visible (not display:none, not width/height:0)
        const container = containerRef.current;
        if (container && 
            container.offsetWidth > 0 && 
            container.offsetHeight > 0 && 
            container.offsetParent !== null) {
          
          fitAddon.fit();
          term.focus();
          console.log('Terminal initialized and focused');
          
          // Auto-resize when container dimensions change (with debouncing)
          if (window.ResizeObserver) {
            let resizeTimeout;
            let lastWidth = 0;
            let lastHeight = 0;
            
            const resizeObserver = new ResizeObserver((entries) => {
              // Exit early if component is unmounting or refs are null
              if (!mountedRef.current || !fitRef.current || !termRef.current || !containerRef.current) {
                return;
              }
              
              const entry = entries[0];
              if (!entry || !entry.contentRect) return;
              
              const newWidth = entry.contentRect.width;
              const newHeight = entry.contentRect.height;
              
              // Only resize if dimensions actually changed significantly
              if (Math.abs(newWidth - lastWidth) < 10 && Math.abs(newHeight - lastHeight) < 10) {
                return;
              }
              
              lastWidth = newWidth;
              lastHeight = newHeight;
              
              // Debounce resize calls
              clearTimeout(resizeTimeout);
              resizeTimeout = setTimeout(() => {
                // Double check refs are still valid when timeout fires
                if (mountedRef.current && fitRef.current && termRef.current && containerRef.current) {
                  try {
                    fitRef.current.fit();
                    console.log(`Terminal auto-resized to ${newWidth}x${newHeight}`);
                  } catch (error) {
                    console.warn('Auto-resize failed:', error);
                  }
                }
              }, 100); // 100ms debounce
            });
            resizeObserver.observe(containerRef.current);
            
            // Store observer for cleanup
            containerRef.current._resizeObserver = resizeObserver;
            containerRef.current._resizeTimeout = resizeTimeout;
          }
          
          // Additional focus debugging
          setTimeout(() => {
            term.focus();
            console.log('Terminal re-focused after delay');
          }, 1000);
        } else {
          // Retry if container isn't ready, but don't retry indefinitely
          if (mountedRef.current) {
            initTimeoutRef.current = requestAnimationFrame(initializeTerminal);
          }
        }
      } catch (error) {
        console.warn('Initial fit failed:', error);
        // Fallback retry after longer delay
        if (mountedRef.current) {
          initTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              try {
                fitAddon.fit();
                term.focus();
              } catch (retryError) {
                console.error('Terminal initialization failed:', retryError);
              }
            }
          }, 500);
        }
      }
    };
    
    // Use requestAnimationFrame for proper timing
    initTimeoutRef.current = requestAnimationFrame(initializeTerminal);

    const socket = io(
      process.env.NODE_ENV === 'production'
        ? '/ws/terminal'
        : 'http://localhost:3000/ws/terminal',
      { query: { image } }
    );

    socket.on('connect', () => {
      console.log('Socket connected for terminal');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    // CHECKLIST: don't write/fit after unmount
    term.onData(data => {
      console.log('Terminal data input:', data);
      if (mountedRef.current && socket) {
        socket.emit('data', data);
      }
    });
    
    console.log('Terminal onData handler set up');
    
    socket.on('data', d => {
      console.log('Socket data received:', d);
      if (mountedRef.current && termRef.current) {
        term.write(d);
      }
    });
    
    socket.on('exit', code => {
      if (mountedRef.current && termRef.current) {
        term.write(`\r\nProcess exited with code ${code}\r\n`);
        if (onExit) onExit(code);
      }
    });

    const handleResize = () => {
      if (!mountedRef.current || !fitRef.current || !termRef.current || !containerRef.current) {
        return;
      }
      
      try {
        // Check if container has valid dimensions and is visible
        const container = containerRef.current;
        if (container.offsetWidth > 0 && 
            container.offsetHeight > 0 && 
            container.offsetParent !== null) {
          requestAnimationFrame(() => {
            if (mountedRef.current && fitRef.current && socketRef.current) {
              try {
                fitRef.current.fit();
                socket.emit('resize', { cols: term.cols, rows: term.rows });
              } catch (error) {
                console.warn('Resize fit failed:', error);
              }
            }
          });
        }
      } catch (error) {
        console.warn('Resize failed:', error);
      }
    };

    window.addEventListener('resize', handleResize);

    termRef.current = term;
    socketRef.current = socket;
    fitRef.current = fitAddon;

    // CHECKLIST: cancel timers/subs on cleanup
    return () => {
      // Set unmounted flag first to prevent any async operations
      mountedRef.current = false;
      
      // Clear fitRef early to prevent resize operations
      fitRef.current = null;
      
      // Cancel any pending timeouts/animations
      if (initTimeoutRef.current) {
        if (typeof initTimeoutRef.current === 'number') {
          clearTimeout(initTimeoutRef.current);
        } else {
          cancelAnimationFrame(initTimeoutRef.current);
        }
      }
      
      window.removeEventListener('resize', handleResize);
      
      // Clean up ResizeObserver and timeout BEFORE disposing terminal
      if (containerRef.current && containerRef.current._resizeObserver) {
        containerRef.current._resizeObserver.disconnect();
        delete containerRef.current._resizeObserver;
      }
      
      if (containerRef.current && containerRef.current._resizeTimeout) {
        clearTimeout(containerRef.current._resizeTimeout);
        delete containerRef.current._resizeTimeout;
      }
      
      // Disconnect socket before disposing terminal
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Dispose terminal last and clear ref
      if (termRef.current) {
        try {
          termRef.current.dispose();
        } catch (error) {
          console.warn('Terminal disposal error:', error);
        }
        termRef.current = null;
      }
    };
  }, [image, onExit]);

  const handleTerminalClick = () => {
    if (termRef.current) {
      console.log('Terminal clicked, focusing...');
      termRef.current.focus();
    }
  };

  const handleExit = () => {
    if (socketRef.current && mountedRef.current) {
      socketRef.current.emit('data', 'q');
    }
  };

  const handleManualResize = () => {
    if (fitRef.current && termRef.current && socketRef.current && mountedRef.current) {
      try {
        fitRef.current.fit();
        socketRef.current.emit('resize', { cols: termRef.current.cols, rows: termRef.current.rows });
      } catch (error) {
        console.warn('Manual resize failed:', error);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div 
        ref={containerRef} 
        className="terminal" 
        onClick={handleTerminalClick}
        style={{ minHeight: '400px', minWidth: '600px' }}
      />
      <div className="flex space-x-2">
        <button onClick={handleExit} className="glass px-3 py-1">Exit</button>
        <button onClick={handleManualResize} className="glass px-3 py-1">Resize</button>
      </div>
    </div>
  );
};

TerminalView.propTypes = {
  image: PropTypes.string.isRequired,
  onExit: PropTypes.func.isRequired
};

export default TerminalView;
