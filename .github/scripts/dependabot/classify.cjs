const { isDeepStrictEqual } = require('node:util');

function snapshot({ manifest, lock }) {
  if (manifest.workspaces || lock.lockfileVersion !== 3 || !lock.packages?.['']) {
    throw new Error('Expected a single-package npm v3 lockfile');
  }
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    if (!isDeepStrictEqual(manifest[field], lock.packages[''][field])) {
      throw new Error(`Manifest and lockfile disagree on ${field}`);
    }
  }
  const names = new Map();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === '') {
      continue;
    }
    if (!path.startsWith('node_modules/') || entry.link || !entry.version) {
      throw new Error(`Unsupported lockfile entry: ${path}`);
    }
    // Include both the installed name and the real name of npm aliases.
    for (const name of new Set([path.split('node_modules/').pop(), entry.name].filter(Boolean))) {
      const devOnly = entry.dev === true;
      names.set(name, devOnly && names.get(name) !== false);
    }
  }
  for (const name of Object.keys({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies
  })) {
    names.set(name, false);
  }
  return names;
}

function classify({ base, head, dependencyNames, files }) {
  if (
    !dependencyNames.length ||
    !files.length ||
    files.some(file => !['package.json', 'package-lock.json'].includes(file))
  ) {
    return 'dependencies';
  }
  const before = snapshot(base);
  const after = snapshot(head);
  // Only development dependency declarations may change in the manifest/root entry.
  for (const [previous, next] of [
    [base.manifest, head.manifest],
    [base.lock.packages[''], head.lock.packages['']]
  ]) {
    const previousRest = { ...previous };
    const nextRest = { ...next };
    delete previousRest.devDependencies;
    delete nextRest.devDependencies;
    if (!isDeepStrictEqual(previousRest, nextRest)) {
      return 'dependencies';
    }
  }
  const previousPackages = base.lock.packages;
  const nextPackages = head.lock.packages;
  const previousMetadata = { ...base.lock };
  const nextMetadata = { ...head.lock };
  delete previousMetadata.packages;
  delete nextMetadata.packages;
  if (!isDeepStrictEqual(previousMetadata, nextMetadata)) {
    return 'dependencies';
  }
  for (const name of dependencyNames) {
    if (
      before.get(name) === false ||
      after.get(name) === false ||
      !(before.get(name) === true || after.get(name) === true)
    ) {
      return 'dependencies';
    }
  }
  // Inspect collateral changes too, including removed packages and scope transitions.
  for (const path of new Set([...Object.keys(previousPackages), ...Object.keys(nextPackages)])) {
    if (path === '' || isDeepStrictEqual(previousPackages[path], nextPackages[path])) {
      continue;
    }
    for (const entry of [previousPackages[path], nextPackages[path]]) {
      if (entry && entry.dev !== true) {
        return 'dependencies';
      }
    }
  }
  return 'dev-dependencies';
}

module.exports = { classify };
