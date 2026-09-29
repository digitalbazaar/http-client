/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    // tests make real network requests, so the 5s default is too low
    testTimeout: 30000,
    hookTimeout: 30000,
    // `coverage` is process-wide: it can only be set at the root, never
    // inside a project, and applies across every project in the run
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary', 'text'],
      include: ['lib/**/*.js']
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          globalSetup: ['./tests/globalSetup.js'],
          setupFiles: ['./tests/setup.js'],
          include: ['tests/10-client-api.spec.js', 'tests/20-node.spec.js']
        }
      },
      {
        extends: true,
        test: {
          name: 'browser',
          globalSetup: ['./tests/globalSetup.js'],
          setupFiles: ['./tests/setup.js'],
          include: ['tests/10-client-api.spec.js', 'tests/30-browser.spec.js'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: {
                // required to launch Chromium in CI containers
                args: ['--no-sandbox', '--disable-setuid-sandbox']
              }
            }),
            instances: [{browser: 'chromium'}]
          }
        }
      }
    ]
  }
});
