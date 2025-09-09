import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io } from 'socket.io-client';
import 'xterm/css/xterm.css';

const TerminalView = ({ image, onExit }) => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const socketRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    const term = new Terminal();
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    term.focus();

    const socket = io(
      process.env.NODE_ENV === 'production'
        ? '/ws/terminal'
        : 'http://localhost:3000/ws/terminal',
      { query: { image } }
    );

    term.onData(data => socket.emit('data', data));
    socket.on('data', d => term.write(d));
    socket.on('exit', code => {
      term.write(`\r\nProcess exited with code ${code}\r\n`);
      if (onExit) onExit(code);
    });

    const handleResize = () => {
      fitAddon.fit();
      socket.emit('resize', { cols: term.cols, rows: term.rows });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    termRef.current = term;
    socketRef.current = socket;
    fitRef.current = fitAddon;

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.disconnect();
      term.dispose();
    };
  }, [image, onExit]);

  const handleExit = () => {
    socketRef.current?.emit('data', 'q');
  };

  const handleManualResize = () => {
    if (fitRef.current && termRef.current && socketRef.current) {
      fitRef.current.fit();
      socketRef.current.emit('resize', { cols: termRef.current.cols, rows: termRef.current.rows });
    }
  };

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="terminal" />
      <div className="flex space-x-2">
        <button onClick={handleExit} className="glass px-3 py-1">Exit</button>
        <button onClick={handleManualResize} className="glass px-3 py-1">Resize</button>
      </div>
    </div>
  );
};

export default TerminalView;
