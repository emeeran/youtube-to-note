/**
 * version-bump.mjs — keeps manifest.json + versions.json in step with package.json.
 *
 * Wired up as the `version` script in package.json, so `npm version <x.y.z>` runs it
 * AFTER npm has already written the new version into package.json.
 *
 * Mirrors Obsidian's official sample plugin behaviour, with two extras:
 *   - strict x.y.z validation (exits non-zero with a clear message on bad input)
 *   - versions.json entries are re-written in ascending semver order
 *
 * Uses only Node built-ins — no new dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const writeJson = (file, data) => fs.writeFileSync(path.join(ROOT, file), `${JSON.stringify(data, null, 4)}\n`);

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** Ascending semver comparison for two strict x.y.z strings. */
const compareVersions = (a, b) => {
    const [majorA, minorA, patchA] = a.split('.').map(Number);
    const [majorB, minorB, patchB] = b.split('.').map(Number);
    return majorA - majorB || minorA - minorB || patchA - patchB;
};

const fail = message => {
    console.error(`version-bump: ${message}`);
    process.exit(1);
};

const readJsonOr = (file, fallback) => {
    try {
        return readJson(file);
    } catch (error) {
        if (error.code === 'ENOENT' && fallback !== undefined) {
            return fallback;
        }
        fail(`could not read ${file} (${error.message})`);
        return undefined; // unreachable, keeps the type checker honest
    }
};

let pkg = readJsonOr('package.json');
let manifest = readJsonOr('manifest.json');
const versions = readJsonOr('versions.json', {});

const version = pkg.version;
if (typeof version !== 'string' || !SEMVER_RE.test(version)) {
    fail(`package.json has an invalid version "${version}" — expected strict x.y.z (e.g. 2.0.1).`);
}

const minAppVersion = manifest.minAppVersion;
if (typeof minAppVersion !== 'string' || !SEMVER_RE.test(minAppVersion)) {
    fail(`manifest.json has an invalid minAppVersion "${minAppVersion}" — expected strict x.y.z.`);
}

manifest.version = version;

// Record the minAppVersion that ships with this release, dropping any junk keys.
versions[version] = minAppVersion;
const sortedVersions = Object.fromEntries(
    Object.keys(versions)
        .filter(key => SEMVER_RE.test(key))
        .sort(compareVersions)
        .map(key => [key, versions[key]]),
);

if (Object.keys(sortedVersions).length !== Object.keys(versions).length) {
    const junk = Object.keys(versions)
        .filter(key => !SEMVER_RE.test(key))
        .join(', ');
    console.warn(`version-bump: dropped non-x.y.z keys from versions.json: ${junk}`);
}

writeJson('manifest.json', manifest);
writeJson('versions.json', sortedVersions);

console.log(`version-bump: manifest.json + versions.json updated to ${version} (minAppVersion ${minAppVersion}).`);
