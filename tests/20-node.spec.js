/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {describe, inject, it, vi} from 'vitest';
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

  // a non-simple method would need a CORS preflight in the browser, so this
  // stays in the node project
  it('passes a non-proxied method straight through to `ky`', async () => {
    let err;
    const url = `http://${httpHost}/ping`;
    try {
      await httpClient(url, {method: 'purge'});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    should.exist(err.response);
    // this path bypasses the response/error handling that the proxied
    // methods get, so `ky`'s error is surfaced unmodified
    should.not.exist(err.requestUrl);
    should.not.exist(err.data);
  });

  // the success side of the same path: `ky` supports `options` as a `method`
  // value but exposes no helper for it. Node only, because in a browser this
  // needs the server to list OPTIONS in its CORS `Access-Control-Allow-
  // Methods`, which the default `cors()` used by the test server does not.
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

  describe('agent compatibility', () => {
    it('does not override a custom `fetch` from another lib', () => {
      const options = {
        agent: makeAgent({rejectUnauthorized: false}),
        fetch: () => {}
      };
      convertAgent(options).should.equal(options);
    });

    // the fallback is only taken when the installed undici cannot drive the
    // platform `fetch`, which is no supported node today, so force it by
    // reporting a platform undici major that is not in the compatible list
    it('routes through an internal `fetch` when the platform undici is ' +
      'incompatible', async () => {
      vi.resetModules();
      vi.doMock('node:process', async importOriginal => {
        const actual = await importOriginal();
        return {
          ...actual,
          versions: {...actual.versions, undici: '999.0.0'}
        };
      });
      try {
        const {convertAgent: convert} =
          await import('../lib/agentCompatibility.js');
        const agent = makeAgent({rejectUnauthorized: false});
        const options = convert({agent});

        // no dispatcher is handed to `ky`; an override is used instead
        should.not.exist(options.dispatcher);
        should.exist(options.fetch);
        options.fetch._httpClientCustomFetch.should.be.true;
        // the override is cached per dispatcher
        convert({agent}).fetch.should.equal(options.fetch);

        // the override rebuilds the platform `Request` as undici's own and
        // still reaches the self-signed server through the agent
        const response = await options.fetch(
          new Request(`https://${httpsHost}/ping`));
        response.status.should.equal(200);
        const body = await response.json();
        body.pong.should.equal(true);

        // it is a general `fetch` replacement, so a plain URL works too
        const direct = await options.fetch(`https://${httpsHost}/ping`);
        direct.status.should.equal(200);
      } finally {
        vi.doUnmock('node:process');
        vi.resetModules();
      }
    });

    // `parseInt` returns `NaN` rather than throwing, so a present but
    // unparseable version never reaches the `catch` and has to be rejected
    // explicitly; otherwise the lookup falls back to `[NaN]` and `includes`
    // matches `NaN` to `NaN`, reporting compatible
    it('falls back when a version is present but unparseable', async () => {
      vi.resetModules();
      vi.doMock('node:process', async importOriginal => {
        const actual = await importOriginal();
        return {
          ...actual,
          versions: {...actual.versions, undici: 'not-a-version'}
        };
      });
      try {
        const {convertAgent: convert} =
          await import('../lib/agentCompatibility.js');
        const options = convert({agent: makeAgent({})});
        should.not.exist(options.dispatcher);
        should.exist(options.fetch);
      } finally {
        vi.doUnmock('node:process');
        vi.resetModules();
      }
    });

    // a failed version read must not throw at module load, which would break
    // `import` for every consumer; it falls back to the override instead
    it('imports and falls back when the version read fails', async () => {
      vi.resetModules();
      vi.doMock('node:process', async importOriginal => {
        const actual = await importOriginal();
        return {...actual, versions: undefined};
      });
      try {
        const {convertAgent: convert} =
          await import('../lib/agentCompatibility.js');
        const options = convert({agent: makeAgent({})});
        should.not.exist(options.dispatcher);
        should.exist(options.fetch);
      } finally {
        vi.doUnmock('node:process');
        vi.resetModules();
      }
    });
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
