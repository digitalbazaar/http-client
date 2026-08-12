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
      // `istanbul` rather than `v8`: v8 coverage is gathered over CDP, which
      // only Chromium supports, and the browser project runs in Firefox and
      // WebKit as well
      provider: 'istanbul',
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
                // needed to launch Chromium in CI containers; `playwright`
                // applies this only to Chromium, so it is safe to set for
                // every instance (a raw `--no-sandbox` arg is not -- WebKit
                // rejects unknown options and fails to launch)
                chromiumSandbox: false
              }
            }),
            /*
            The `Possible CORS error` message in `lib/httpClient.js` keys off
            the browser's own network-error text, which differs per engine, so
            each engine has to be exercised to keep that mapping honest. The
            shared `10-client-api.spec.js` runs per instance as well, which is
            what catches any other behavior difference between engines.
            */
            instances: [
              {browser: 'chromium'},
              {browser: 'firefox'},
              {browser: 'webkit'}
            ]
          }
        }
      }
    ]
  }
});
