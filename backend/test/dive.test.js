const diveUtils = require('../utils/dive');

describe('Dive Utils input validation', () => {
  test('rejects malicious image names', async () => {
    await expect(diveUtils.executeDiveSync('alpine;rm -rf /'))
      .rejects.toThrow('Invalid image name');
  });
});
