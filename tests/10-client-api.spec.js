/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {
  DEFAULT_HEADERS,
  httpClient,
  ky
} from '../lib/index.js';
import {describe, inject, it} from 'vitest';

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

  // guards against the proxied set drifting ahead of `ky`'s helper registry:
  // proxying indexes into `ky[method]`, so a name `ky` does not implement
  // would throw on first call rather than fail here
  it('proxies only methods that `ky` implements', async () => {
    const proxied = [
      'get', 'post', 'put', 'patch', 'head', 'delete'
    ];
    for(const method of proxied) {
      ky[method].should.be.a('function', `ky.${method} is missing`);
      httpClient[method].should.be.a(
        'function', `httpClient.${method} is missing`);
    }
    // methods `ky` has no helper for must not be proxied
    for(const method of ['query', 'options', 'trace']) {
      should.not.exist(ky[method], `ky.${method} unexpectedly exists`);
      should.not.exist(
        httpClient[method], `httpClient.${method} must not be proxied`);
    }
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
    const expectedErrorCode = 'ECONNREFUSED';
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
    // in node 18 global fetch places the error code in err.cause
    const cause = err.cause || err;
    // chrome's fetch errors don't contain a code at all
    if(cause.code) {
      cause.code.should.equal(
        expectedErrorCode,
        `Expected nonExistentResource "err.code" to be ${expectedErrorCode}.`
      );
    }
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

  it('can use create() to provide default headers', async () => {
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

  it('create() returns a client with overridden default headers', async () => {
    const client = httpClient.create({headers: {Accept: 'text/html'}});

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
    should.exist(response.data);
    should.exist(response.data.headers);
    response.status.should.equal(200);
    // the default `Accept` is replaced rather than appended to
    response.data.headers.accept.should.equal('text/html');
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

  it('proxies the `stop` signal from `ky`', async () => {
    const stop = await httpClient.stop;
    should.exist(stop);
    stop.should.equal(ky.stop);
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
  });
});
