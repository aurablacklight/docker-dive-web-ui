const MAX_IMAGE_NAME_LENGTH = 255;
const DIGEST_REGEX = /^sha256:[a-f0-9]{64}$/;
const TAG_REGEX = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const NAME_COMPONENT_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const REGISTRY_REGEX = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]+)?$/;

function validateImageName(imageName) {
  if (typeof imageName !== 'string') {
    return { valid: false, reason: 'must be a string' };
  }

  if (imageName.length === 0) {
    return { valid: false, reason: 'is required' };
  }

  if (imageName.length > MAX_IMAGE_NAME_LENGTH) {
    return { valid: false, reason: `must be ${MAX_IMAGE_NAME_LENGTH} characters or fewer` };
  }

  if (imageName !== imageName.trim()) {
    return { valid: false, reason: 'must not have leading or trailing whitespace' };
  }

  if (/\s/.test(imageName)) {
    return { valid: false, reason: 'must not contain whitespace' };
  }

  if (imageName.startsWith('-')) {
    return { valid: false, reason: 'must not start with a dash' };
  }

  if (imageName.includes('://')) {
    return { valid: false, reason: 'must not include a URL scheme' };
  }

  if (imageName.startsWith('sha256:')) {
    return { valid: false, reason: 'bare image IDs are not accepted' };
  }

  const digestParts = imageName.split('@');
  if (digestParts.length > 2) {
    return { valid: false, reason: 'has malformed digest syntax' };
  }

  let nameAndTag = digestParts[0];
  if (digestParts.length === 2 && !DIGEST_REGEX.test(digestParts[1])) {
    return { valid: false, reason: 'has malformed digest' };
  }

  if (!nameAndTag) {
    return { valid: false, reason: 'repository is required' };
  }

  const lastSlash = nameAndTag.lastIndexOf('/');
  const lastColon = nameAndTag.lastIndexOf(':');
  let tag = null;

  if (lastColon > lastSlash) {
    tag = nameAndTag.slice(lastColon + 1);
    nameAndTag = nameAndTag.slice(0, lastColon);
    if (!TAG_REGEX.test(tag)) {
      return { valid: false, reason: 'has invalid tag' };
    }
  }

  const parts = nameAndTag.split('/');
  if (parts.some((part) => part.length === 0)) {
    return { valid: false, reason: 'has empty path component' };
  }

  let repositoryParts = parts;
  const first = parts[0];
  const hasRegistry = parts.length > 1 && (first.includes('.') || first.includes(':') || first === 'localhost');

  if (hasRegistry) {
    if (!REGISTRY_REGEX.test(first)) {
      return { valid: false, reason: 'has invalid registry' };
    }

    const port = first.split(':')[1];
    if (port && !/^[0-9]+$/.test(port)) {
      return { valid: false, reason: 'has invalid registry port' };
    }

    repositoryParts = parts.slice(1);
  }

  if (repositoryParts.length === 0 || repositoryParts.some((part) => !NAME_COMPONENT_REGEX.test(part))) {
    return { valid: false, reason: 'has invalid repository path' };
  }

  return { valid: true };
}

function assertValidImageName(imageName) {
  const result = validateImageName(imageName);
  if (!result.valid) {
    throw new Error(`Invalid image name: ${result.reason}`);
  }
  return imageName;
}

module.exports = {
  validateImageName,
  assertValidImageName
};
