/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {describe, inject, it} from 'vitest';
import {convertAgent} from '../lib/agentCompatibility.js';
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

  // a custom `fetch` (e.g. from another library) is used as given; agent
  // conversion must neither replace it nor slip it a `dispatcher`
  it('keeps a custom `fetch` when an agent is given', async () => {
    let err;
    let response;
    let called = false;
    let dispatcher;
    const url = `http://${httpHost}/ping`;
    try {
      const agent = makeAgent({
        rejectUnauthorized: false
      });
      response = await httpClient.get(url, {
        agent,
        fetch: async (input, init) => {
          called = true;
          dispatcher = init?.dispatcher;
          return globalThis.fetch(input, init);
        }
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(200);
    called.should.be.true;
    should.not.exist(dispatcher);
  });

  // an agent is converted once and reused, so its connections are pooled
  // across requests instead of each request building a new dispatcher
  it('reuses the conversion of the same agent', async () => {
    const agent = makeAgent({rejectUnauthorized: false});
    const otherAgent = makeAgent({rejectUnauthorized: false});
    // a compatible platform gets a `dispatcher`, others a `fetch` override
    const converted = options => options.dispatcher ?? options.fetch;
    const first = converted(convertAgent({agent}));
    should.exist(first);
    converted(convertAgent({agent})).should.equal(first);
    converted(convertAgent({agent: otherAgent})).should.not.equal(first);
  });

  // ky wraps fetch's error in a `NetworkError`, and node's fetch places the
  // system error in its own error's `cause`; chrome's fetch errors don't
  // contain a code at all
  it('reports the system error code of a connection refused error',
    async () => {
      let err;
      // the intention here is to use an unused http port
      // the port cannot be higher than 65535 (which is invalid)
      const nonExistentResource = 'https://localhost:65535';
      const expectedErrorCode = 'ECONNREFUSED';
      try {
        await httpClient.get(nonExistentResource);
      } catch(e) {
        err = e;
      }
      should.exist(err, 'Expected nonExistentResource to error.');
      let cause = err;
      while(cause && !cause.code) {
        cause = cause.cause;
      }
      should.exist(cause, 'Expected an error code in the "cause" chain.');
      cause.code.should.equal(
        expectedErrorCode,
        `Expected nonExistentResource "err.code" to be ${expectedErrorCode}.`
      );
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
