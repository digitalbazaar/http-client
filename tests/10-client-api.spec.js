/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import dbHttpClient from '../lib/index';
import isNode from 'detect-node';

describe('http-client API', () => {
  it('has proper exports', async () => {
    should.exist(dbHttpClient);
    dbHttpClient.should.have.keys([
      'httpClient', 'ky', 'DEFAULT_HEADERS'
    ]);
    const {httpClient, ky} = dbHttpClient;
    httpClient.should.be.a('function');
    ky.should.be.a('function');
  });
  it('handles a get not found error', async () => {
    const {httpClient} = dbHttpClient;
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
    err.response.status.should.equal(404);
  });
  it('successfully makes request with default json headers', async () => {
    const {httpClient} = dbHttpClient;
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
  it('succesfully makes request with a header that is overriden', async () => {
    const {httpClient} = dbHttpClient;
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
    const {httpClient} = dbHttpClient;
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
    const {httpClient} = dbHttpClient;
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
        const {httpClient} = dbHttpClient;
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
        const {httpClient} = dbHttpClient;
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
        err.message.should.equal('Failed to fetch. Possible CORS error.');
      });
    });
  }
});
