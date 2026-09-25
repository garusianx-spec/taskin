import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { dirs: ['src'] },
  // Workspace packages ship compiled ES2022; let SWC bring them to the app's browser targets.
  transpilePackages: ['@taskin/contracts', '@taskin/jalali', '@taskin/text'],
  // The lockfile lives at the monorepo root; trace server files from there, not from apps/web.
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
