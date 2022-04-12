/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
// common test for ESM and CommonJS
exports.test = function({kyPromise, httpClient, DEFAULT_HEADERS, isNode}) {

/* eslint-disable indent */
describe('http-client API', () => {
  let ky;
  it('has proper exports', async () => {
    ky = await kyPromise;
    should.exist(ky);
    DEFAULT_HEADERS.should.have.keys(['Accept']);
    httpClient.should.be.a('function');
    ky.should.be.a('function');
  });
  it('handles a get not found error', async () => {
    let err;
    let response;
    try {
      response = await httpClient.get('http://httpbin.org/status/404');
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.toUpperCase().should.contain('NOT FOUND');
    should.exist(err.response);
    should.exist(err.response.status);
    should.exist(err.requestUrl);
    err.requestUrl.should.equal('http://httpbin.org/status/404');
    err.response.status.should.equal(404);
  });
  it('handles a TimeoutError error', async () => {
    let err;
    let response;
    try {
      response = await httpClient.get('http://httpbin.org/delay/2', {
        timeout: 1000,
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.should.equal(
      'Request to "http://httpbin.org/delay/2" timed out.');
    should.not.exist(err.response);
    should.exist(err.requestUrl);
    err.requestUrl.should.equal('http://httpbin.org/delay/2');
  });
  it('successfully makes request with default json headers', async () => {
    let err;
    let response;
    try {
      response = await httpClient.get('https://httpbin.org/headers');
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    should.exist(response.data.headers);
    response.status.should.equal(200);
    const {Accept: accept} = response.data.headers;
    accept.should.equal('application/ld+json, application/json');
  });
  it('successfully makes request with header that is overridden', async () => {
    let err;
    let response;
    try {
      response = await httpClient.get('https://httpbin.org/headers', {
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
    const {Accept: accept} = response.data.headers;
    accept.should.equal('text/html');
  });
  it('can use create() to provide default headers', async () => {
    let err;
    let response;
    try {
      response = await httpClient.get('https://httpbin.org/headers', {
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
    const {Accept: accept} = response.data.headers;
    accept.should.equal('text/html');
  });
  it('handles a successful get with JSON data', async () => {
    let err;
    let response;
    try {
      response = await httpClient.get('http://httpbin.org/json');
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
    try {
      response = await httpClient.get(
        'https://dog.ceo/api/breeds/image/DOESNOTEXIST');
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    err.message.should.contain('No route found');
    should.exist(err.response);
    should.exist(err.response.status);
    should.exist(err.status);
    err.status.should.equal(404);
    should.exist(err.data);
    err.data.should.be.an('object');
    // these are API specific from the JSON body of the response
    err.data.should.have.keys(['status', 'message', 'code']);
    err.data.status.should.equal('error');
    err.data.message.should.contain('No route found');
    err.data.code.should.equal(404);
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
        err.message.should.contain(
          'request to http://localhost:9876/does-not-exist failed, reason: ' +
          'connect ECONNREFUSED 127.0.0.1:9876');
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
});

describe('extend (custom client)', () => {
  it('adds an Authorization header to all requests', async () => {
    const accessToken = '12345';

    const client = httpClient.extend({
      headers: {Authorization: `Bearer ${accessToken}`}
    });

    let err;
    let response;
    try {
      response = await client.get('https://httpbin.org/headers');
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(response);
    should.exist(response.status);
    should.exist(response.data);
    should.exist(response.data.headers);
    response.status.should.equal(200);
    const {Authorization: authzHeader} = response.data.headers;
    authzHeader.should.equal('Bearer 12345');
  });
});

};
