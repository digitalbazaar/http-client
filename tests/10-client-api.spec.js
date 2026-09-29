/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {
  DEFAULT_HEADERS,
  httpClient,
  ky
} from '../lib/index.js';
import {describe, inject, it} from 'vitest';
import {replaceOption} from 'ky';

// tests shared by the `node` and `browser` projects; environment-specific
// tests live in `20-node.spec.js` and `30-browser.spec.js`
describe('http-client API', () => {
  // local test servers are started once by `tests/globalSetup.js`
  const httpHost = inject('httpHost');

  it('has proper exports', async () => {
    should.exist(ky);
    DEFAULT_HEADERS.should.have.keys(['Accept']);
    httpClient.should.be.a('function');
    ky.should.be.a('function');
  });

  // the wrapper API is deliberately all async, including this getter; it
  // dates from keeping the CJS and ESM builds consistent and is kept so
  // calling code does not have to change
  it('resolves `stop` to `ky.stop` from an async getter', async () => {
    const stop = httpClient.stop;
    stop.should.be.an.instanceof(Promise);
    (await stop).should.equal(ky.stop);
  });

  // guards against the proxied set drifting from `ky`'s helper registry in
  // either direction: proxying indexes into `ky[method]`, so a name `ky` does
  // not implement would throw on first call, and a helper `ky` adds should be
  // proxied deliberately (it is new public API) rather than go unnoticed
  it('proxies exactly the methods that `ky` implements', async () => {
    const proxied = [
      'get', 'post', 'put', 'patch', 'head', 'delete', 'query'
    ];
    Object.keys(httpClient)
      .filter(key => !['create', 'extend'].includes(key))
      .sort().should.deep.equal(
        [...proxied].sort(),
        '`httpClient` methods differ from the proxied methods');
    // `ky` functions that are not request helpers
    const notHelpers = ['create', 'extend', 'retry'];
    const helpers = Object.keys(ky).filter(
      key => typeof ky[key] === 'function' && !notHelpers.includes(key));
    helpers.sort().should.deep.equal(
      [...proxied].sort(),
      '`ky` request helpers differ from the proxied methods');
  });

  it('supports the proxied `query` method', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/query`;
    const payload = {hello: 'world', n: 42, nested: {ok: true}};
    try {
      response = await httpClient.query(url, {json: payload});
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

  it('routes a `query` method option through the proxy', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/query`;
    const payload = {hello: 'world'};
    try {
      response = await httpClient(url, {method: 'query', json: payload});
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(200);
    // `data` is only set by the proxied path
    should.exist(response.data);
    response.data.echo.should.deep.equal(payload);
  });

  it('can ping HTTP test server', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/ping`;
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

  it('handles a get not found error', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/status/404`;
    try {
      response = await httpClient.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.toUpperCase().should.contain('NOT FOUND');
    should.exist(err.response);
    should.exist(err.response.status);
    should.exist(err.requestUrl);
    err.requestUrl.should.equal(url);
    err.response.status.should.equal(404);
  });

  it('handles a connection refused error', async () => {
    let err;
    let response;
    // the intention here is to use an unused http port
    // the port cannot be higher than 65535 (which is invalid)
    const nonExistentResource = 'https://localhost:65535';
    // replace the default Accept with text/plain to get around
    // possibly sending a CORS pre-flight
    const headers = {Accept: 'text/plain'};
    try {
      response = await httpClient.get(nonExistentResource, {headers});
    } catch(e) {
      err = e;
    }
    should.not.exist(
      response, 'Expected nonExistentResource to not return a response.');
    should.exist(
      err, 'Expected nonExistentResource to error.');
    should.not.exist(
      err.response,
      'Expected nonExistentResource "err.response" to not exist.'
    );
    should.exist(
      err.requestUrl,
      'Expected nonExistentResource "err.requestUrl" to exist.'
    );
    err.requestUrl.should.equal(
      nonExistentResource,
      `Expected nonExistentResource "err.requestUrl" to be ` +
        `${nonExistentResource}`
    );
  });

  // a browser's `fetch` rejects a CORS failure with a bare
  // `TypeError: Failed to fetch`; simulate it so node covers the message too
  it('reports a possible CORS error for a failed fetch', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/ping`;
    try {
      response = await httpClient.get(url, {
        fetch: async () => {
          throw new TypeError('Failed to fetch');
        },
        // skip ky's retry backoff for a network error
        retry: 0
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.should.equal(`Failed to fetch "${url}". Possible CORS error.`);
    err.requestUrl.should.equal(url);
  });

  it('handles a TimeoutError error', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/delay/2`;
    try {
      response = await httpClient.get(url, {
        timeout: 1000
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.should.equal(
      `Request to "${url}" timed out.`);
    should.not.exist(err.response);
    should.exist(err.requestUrl);
    err.requestUrl.should.equal(url);
  });

  it('successfully makes request with default json headers', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/headers`;
    try {
      response = await httpClient.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    should.exist(response.data.headers);
    response.status.should.equal(200);
    const {accept} = response.data.headers;
    accept.should.equal('application/ld+json, application/json');
  });

  it('successfully makes request with header that is overridden', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/headers`;
    try {
      response = await httpClient.get(url, {
        headers: {
          accept: 'text/html'
        }
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    should.exist(response.data.headers);
    response.status.should.equal(200);
    const {accept} = response.data.headers;
    accept.should.equal('text/html');
  });

  // a lowercase name must replace the default `Accept`, not be combined
  // with it
  it('can use create() to provide default headers', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/headers`;
    try {
      const client = httpClient.create({
        headers: {
          accept: 'text/html'
        }
      });
      response = await client.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    should.exist(response.data.headers);
    response.status.should.equal(200);
    const {accept} = response.data.headers;
    accept.should.equal('text/html');
  });

  it('can use create() with a `Headers` instance', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/headers`;
    try {
      const client = httpClient.create({
        headers: new Headers({Authorization: 'Bearer 12345'})
      });
      response = await client.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(200);
    should.exist(response.data);
    should.exist(response.data.headers);
    const {accept, authorization} = response.data.headers;
    accept.should.equal('application/ld+json, application/json');
    authorization.should.equal('Bearer 12345');
  });

  // like ky, an `undefined` value deletes the header rather than sending
  // the string 'undefined'
  it('can use create() to remove a default header', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/headers`;
    try {
      const client = httpClient.create({
        headers: {
          Accept: undefined
        }
      });
      response = await client.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(200);
    should.exist(response.data);
    should.exist(response.data.headers);
    // fetch sends its own default when no `Accept` is set
    response.data.headers.accept.should.equal('*/*');
  });

  it('can use create() to replace the default headers', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/headers`;
    try {
      const client = httpClient.create({
        headers: replaceOption({Authorization: 'Bearer 12345'})
      });
      response = await client.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(200);
    should.exist(response.data);
    should.exist(response.data.headers);
    const {accept, authorization} = response.data.headers;
    // fetch sends its own default when no `Accept` is set
    accept.should.equal('*/*');
    authorization.should.equal('Bearer 12345');
  });

  it('create() and extend() keep the defaults with no overrides', async () => {
    const url = `http://${httpHost}/headers`;
    for(const client of [httpClient.create({}), httpClient.extend({})]) {
      const response = await client.get(url);
      response.status.should.equal(200);
      response.data.headers.accept.should.equal(
        'application/ld+json, application/json');
    }
  });

  it('does not parse the body when `parseBody` is false', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/json`;
    try {
      response = await httpClient.get(url, {parseBody: false});
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    response.status.should.equal(200);
    // `data` is always defined as a property, but left undefined
    should.not.exist(response.data);
    // the body is untouched, so the caller can still read it
    const body = await response.json();
    should.exist(body);
  });

  it('handles a successful get with JSON data', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/json`;
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

  it('handles a successful get with HTML data', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/html`;
    try {
      response = await httpClient.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.not.exist(response.data);
    should.exist(await response.text());
    response.status.should.equal(200);
    const ct = response.headers.get('content-type');
    should.exist(ct);
    ct.includes('text/html').should.be.true;
  });

  it('handles a successful direct get', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/json`;
    try {
      response = await httpClient(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    response.status.should.equal(200);
  });

  it('handles a get not found error with JSON data', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/404`;
    try {
      response = await httpClient.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.should.contain('404 Not Found');
    should.exist(err.response);
    should.exist(err.response.status);
    should.exist(err.status);
    err.status.should.equal(404);
    should.exist(err.data);
    err.data.should.be.an('object');
    // these are API specific from the JSON body of the response
    err.data.should.have.keys(['code', 'description']);
    err.data.code.should.equal(404);
    err.data.description.should.equal('Not Found');
  });

  it('uses the message from a JSON error body', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/error/message`;
    try {
      response = await httpClient.get(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.status.should.equal(400);
    err.message.should.equal('Invalid widget.');
  });

  it('handles a direct get not found error with JSON data', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/404`;
    try {
      response = await httpClient(url);
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.should.contain('404 Not Found');
    should.exist(err.response);
    should.exist(err.response.status);
    should.exist(err.status);
    err.status.should.equal(404);
    should.exist(err.data);
    err.data.should.be.an('object');
    // these are API specific from the JSON body of the response
    err.data.should.have.keys(['code', 'description']);
    err.data.code.should.equal(404);
    err.data.description.should.equal('Not Found');
  });

  describe('extend (custom client)', () => {
    it('adds an Authorization header to all requests', async () => {
      const accessToken = '12345';

      const client = httpClient.extend({
        headers: {Authorization: `Bearer ${accessToken}`}
      });

      let err;
      let response;
      const url = `http://${httpHost}/headers`;
      try {
        response = await client.get(url);
      } catch(e) {
        err = e;
      }
      should.not.exist(err);
      should.exist(response);
      should.exist(response.status);
      should.exist(response.data);
      should.exist(response.data.headers);
      response.status.should.equal(200);
      const {authorization: authzHeader} = response.data.headers;
      authzHeader.should.equal('Bearer 12345');
    });

    it('replaces parent headers with `replaceOption()`', async () => {
      const parent = httpClient.extend({
        headers: {Authorization: 'Bearer 12345'}
      });
      const client = parent.extend({
        headers: replaceOption({accept: 'text/plain'})
      });

      let err;
      let response;
      const url = `http://${httpHost}/headers`;
      try {
        response = await client.get(url);
      } catch(e) {
        err = e;
      }
      should.not.exist(err);
      should.exist(response);
      response.status.should.equal(200);
      should.exist(response.data);
      should.exist(response.data.headers);
      const {accept, authorization} = response.data.headers;
      accept.should.equal('text/plain');
      should.not.exist(authorization);
    });
  });
});
