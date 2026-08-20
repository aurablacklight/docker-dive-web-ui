require('@testing-library/jest-dom');

// jsdom does not provide TextEncoder/TextDecoder (browsers do)
const { TextEncoder, TextDecoder } = require('util');
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;

// Mock CSS imports
global.CSS = { supports: jest.fn(() => false) };
