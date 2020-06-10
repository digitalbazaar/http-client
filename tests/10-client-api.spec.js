/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import dbHttpClient from '..';
import isNode from 'detect-node';

describe('http-client API', () => {
  it('has proper exports', async () => {
    should.exist(dbHttpClient);
    dbHttpClient.should.have.keys(['httpClient', 'ky']);
    const {httpClient, ky} = dbHttpClient;
    httpClient.should.be.a('function');
    ky.should.be.a('function');
  });
  it('handles a network error', async () => {
    const {httpClient} = dbHttpClient;
    let err;
    let response;
    try {
      response = await httpClient.get(
        'https://55d2da26-b555-4950-8e12-fdab8de488a3.com');
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    if(isNode) {
      err.message.should.equal(
        'request to https://55d2da26-b555-4950-8e12-fdab8de488a3.com/ ' +
        'failed, reason: getaddrinfo ENOTFOUND ' +
        '55d2da26-b555-4950-8e12-fdab8de488a3.com');
    } else {
      err.message.should.equal('Failed to fetch');
    }
  });
  it('handles a get not found error', async () => {
    const {httpClient} = dbHttpClient;
    let err;
    let response;
    try {
      response = await httpClient.get(
        'https://example.com/55d2da26-b555-4950-8e12-fdab8de488a3');
    } catch(e) {
      err = e;
    }
    should.not.exist(response);
    should.exist(err);
    if(isNode) {
      err.message.should.contain('Not Found');
      should.exist(err.response);
      should.exist(err.response.status);
      err.response.status.should.equal(404);
    } else {
      err.message.should.equal('Failed to fetch');
    }
  });
  it('handles a get not found error with JSON data', async () => {
    const {httpClient} = dbHttpClient;
    let err;
    let response;
    try {
      // TODO: use another site/mock for error response
      response = await httpClient.get(
        'https://dog.ceo/api/breeds/image/DOESNOTEXIST', {
          headers: {
            accept: 'application/json',
          }
        });
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
});
