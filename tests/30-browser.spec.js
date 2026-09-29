/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {describe, inject, it} from 'vitest';
import {httpClient} from '../lib/index.js';

// tests that only run in the `browser` project
describe('http-client API', () => {
  // local test servers are started once by `tests/globalSetup.js`
  const httpHost = inject('httpHost');
  const httpsHost = inject('httpsHost');

  // test local self-signed cert; no agent is needed because the playwright
  // provider always runs the browser context with `ignoreHTTPSErrors`
  it('can ping HTTPS test server', async () => {
    let err;
    let response;
    const url = `https://${httpsHost}/ping`;
    try {
      response = await httpClient.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    response.status.should.equal(200);
  });

  // browser check for endpoint without CORS
  it('handles a CORS error', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/nocors`;
    try {
      response = await httpClient.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.should.equal(
      `Failed to fetch "${url}". Possible CORS error.`);
    should.not.exist(err.response);
    should.exist(err.requestUrl);
    err.requestUrl.should.equal(url);
  });

  describe('Browser execution context', () => {
    it('should give a meaningful CORS error', async () => {
      let err;
      let response;
      try {
        response = await httpClient.get('https://example.com');
      } catch(e) {
        err = e;
      }
      should.not.exist(response);
      should.exist(err);
      // failed to fetch may commonly be due to an issue with CORS
      err.message.should
        .equal('Failed to fetch "https://example.com". Possible CORS error.');
    });
  });
});
