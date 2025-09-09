import React from 'react';

// Simple test to verify Jest setup
describe('Jest Configuration Test', () => {
  test('basic Jest functionality', () => {
    expect(2 + 2).toBe(4);
  });

  test('can handle React syntax', () => {
    const element = React.createElement('div', { className: 'test' }, 'Hello');
    expect(element.type).toBe('div');
  });
});
