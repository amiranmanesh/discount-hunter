import type { NextConfig } from 'next';

/**
 * `standalone` is what makes the Docker image small and dependency-free: the
 * build traces every module the server actually needs into `.next/standalone`,
 * so the runtime image carries no `node_modules` of its own.
 *
 * Nothing else is configured here on purpose. The app is served from its own
 * origin — root of a personal domain, a sub-path behind a reverse proxy, or
 * `localhost` — and none of that needs a build-time setting.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Several upstream paths end in a slash and mean something different without
  // it — `/user/login-register/`, `/address/`, `/products/search/all/`. Next.js
  // would answer those with a 308 to the slash-less form, the browser would
  // follow it, and the proxy would forward a path the platform does not serve.
  // Leaving the path exactly as it arrived is the only correct behaviour for a
  // pass-through proxy.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
