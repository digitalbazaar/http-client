/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
// common test for ESM and CommonJS
exports.test = function({
  kyPromise, httpClient, DEFAULT_HEADERS, isNode, utils
}) {

/* eslint-disable indent */
describe('http-client API', () => {
  // start/close local test server
  let serverInfo;
  let httpHost;
  let httpsHost;
  before(async () => {
    serverInfo = await utils.startServers();
    httpHost = serverInfo.httpHost;
    httpsHost = serverInfo.httpsHost;
  });
  after(async () => {
    await Promise.all([
      serverInfo.httpServer.close(),
      serverInfo.httpsServer.close()
    ]);
  });

  let ky;
  it('has proper exports', async () => {
    ky = await kyPromise;
    should.exist(ky);
    DEFAULT_HEADERS.should.have.keys(['Accept']);
    httpClient.should.be.a('function');
    ky.should.be.a('function');
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

  // test HTTPS on httpstat.us on node and browsers
  it('can use HTTPS on httpbin', async () => {
    let err;
    let response;
    const url = `https://httpstat.us/200`;
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

  if(isNode) {
    // test local self-signed cert in node only
    it('can ping HTTPS test server', async () => {
      let err;
      let response;
      const url = `https://${httpsHost}/ping`;
      try {
        const agent = utils.makeAgent({
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
  }

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

  if(!isNode) {
    // browser check for endpoint without CORS
    it.only('handles a CORS error', async () => {
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
  }

  it('handles a TimeoutError error', async () => {
    let err;
    let response;
    const url = `http://${httpHost}/delay/2`;
    try {
      response = await httpClient.get(url, {
        timeout: 1000,
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

  if(isNode) {
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
            m.includes('fetch failed'));
      });
    });
  } else {
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
  }

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

};
