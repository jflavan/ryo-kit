/**
 * Minimal, dependency-free glob matching for repo-relative paths.
 * Supports `**` (any number of path segments), `*` (within a segment), and `?`.
 * Paths are normalised to forward slashes and stripped of a leading `./`.
 */
export function normalisePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

export function globToRegExp(glob) {
  const g = normalisePath(glob);
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        // `**/` matches zero or more segments; trailing `**` matches the rest
        if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 2; }
        else { re += '.*'; i += 1; }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

export function matchesGlob(path, glob) {
  return globToRegExp(glob).test(normalisePath(path));
}

export function matchesAnyGlob(path, globs = []) {
  return globs.some(g => matchesGlob(path, g));
}
