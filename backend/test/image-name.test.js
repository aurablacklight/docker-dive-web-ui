const { validateImageName, assertValidImageName } = require('../utils/image-name');

const digest = 'a'.repeat(64);

describe('Docker image name validation', () => {
  test.each([
    'nginx',
    'nginx:latest',
    'library/nginx:latest',
    'ghcr.io/owner/repo:tag',
    'registry.example.com:5000/owner/repo:tag',
    `alpine@sha256:${digest}`
  ])('accepts %s', (imageName) => {
    expect(validateImageName(imageName).valid).toBe(true);
    expect(assertValidImageName(imageName)).toBe(imageName);
  });

  test.each([
    '',
    'Nginx',
    'ghcr.io/Owner/repo:tag',
    'alpine@sha256:abc',
    `alpine@sha256:${'A'.repeat(64)}`,
    'alpine;id',
    'alpine && id',
    '$(id)',
    '`id`',
    '--help',
    'name with spaces',
    'name\nother',
    ' nginx',
    'nginx ',
    'https://registry.example.com/repo',
    `sha256:${digest}`
  ])('rejects %j', (imageName) => {
    expect(validateImageName(imageName).valid).toBe(false);
    expect(() => assertValidImageName(imageName)).toThrow('Invalid image name');
  });
});
