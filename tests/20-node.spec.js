/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {describe, inject, it} from 'vitest';
import {httpClient} from '../lib/index.js';
import {makeAgent} from './utils.js';

// tests that only run in the `node` project; this file is free to import
// node-only modules, which is why it is kept out of `10-client-api.spec.js`
describe('http-client API', () => {
  // local test servers are started once by `tests/globalSetup.js`
  const httpHost = inject('httpHost');
  const httpsHost = inject('httpsHost');

  // test HTTPS against a real external site; node only, since the site
  // sends no CORS headers and a browser would block the request
  // NOTE: might get rate limited
  it('can use HTTPS on github.com', async () => {
    let err;
    let response;
    const url = 'https://github.com/';
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
    const ct = response.headers.get('content-type');
    should.exist(ct);
    ct.includes('application/json').should.be.true;
  });

  // test local self-signed cert; node needs an agent to accept it
  it('can ping HTTPS test server', async () => {
    let err;
    let response;
    const url = `https://${httpsHost}/ping`;
    try {
      const agent = makeAgent({
        rejectUnauthorized: false
      });
      response = await httpClient.get(url, {agent});
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    response.status.should.equal(200);
  });

  // exercises the agent path with a request body: on an incompatible
  // runtime the body + headers must survive the Request -> (url, init)
  // decomposition, on a compatible one it rides the native dispatcher path
  it('can POST a body over an HTTPS agent', async () => {
    let err;
    let response;
    const url = `https://${httpsHost}/echo`;
    const payload = {hello: 'world', n: 42, nested: {ok: true}};
    try {
      const agent = makeAgent({
        rejectUnauthorized: false
      });
      response = await httpClient.post(url, {agent, json: payload});
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(200);
    should.exist(response.data);
    should.exist(response.data.echo);
    response.data.echo.should.deep.equal(payload);
  });

  // `ky` supports `options` as a `method` value but exposes no helper for it,
  // so it has to reach `ky` through the direct-call fall-through. Node only,
  // because in a browser this needs the server to list OPTIONS in its CORS
  // `Access-Control-Allow-Methods`, which the default `cors()` used by the
  // test server does not.
  it('supports a non-proxied method via the `method` option', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/headers`;
    try {
      response = await httpClient(url, {method: 'options'});
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(204);
  });

  describe('Nodejs execution context', () => {
    it('handles a network error', async () => {
      let err;
      let response;
      try {
        response = await httpClient.get(
          'http://localhost:9876/does-not-exist');
      } catch(e) {
        err = e;
      }
      should.not.exist(response);
      should.exist(err);
      err.message.should.satisfy(m =>
        m.includes(
          'request to http://localhost:9876/does-not-exist failed, reason: ' +
          'connect ECONNREFUSED 127.0.0.1:9876') ||
          // node 18.x +
          m.includes('fetch failed') ||
          // node 22+ / ky@2
          m.includes(
            'Request failed due to a network error: ' +
            'GET http://localhost:9876/does-not-exist'));
    });
  });
});
