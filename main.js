/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import kyOriginal from 'ky-universal';

export const DEFAULT_HEADERS = {
  Accept: 'application/ld+json, application/json'
};

const ky = kyOriginal.create({headers: DEFAULT_HEADERS});

const proxyMethods = new Set([
  'get', 'post', 'push', 'patch', 'head', 'delete'
]);

export const httpClient = new Proxy(ky, {
  apply: _handleResponse,
  get(target, propKey) {
    const propValue = target[propKey];

    // only intercept particular methods
    if(!proxyMethods.has(propKey)) {
      return propValue;
    }
    return async function() {
      return _handleResponse(propValue, this, arguments);
    };
  }
});

async function _handleResponse(target, thisArg, args) {
  let response;
  const [url] = args;
  try {
    response = await target.apply(thisArg, args);
  } catch(error) {
    return _handleError({error, url});
  }
  const {parseBody = true} = args[1] || {};
  if(parseBody) {
    // a 204 will not include a content-type header
    const contentType = response.headers.get('content-type');
    if(contentType && contentType.includes('json')) {
      response.data = await response.json();
    }
  }
  return response;
}

/**
 * @param {object} options - Options hashmap.
 * @param {Error} options.error - Error thrown during http operation.
 * @param {string} options.url - Target URL of the request.
 * @return {Promise}
 */
async function _handleError({error, url}) {
  error.requestUrl = url;

  // handle network errors and system errors that do not have a response
  if(!error.response) {
    if(error.message === 'Failed to fetch') {
      error.message = `Failed to fetch "${url}". Possible CORS error.`;
    }
    // ky's TimeoutError class
    if(error.name === 'TimeoutError') {
      error.message = `Request to "${url}" timed out.`;
    }

    throw error;
  }

  // always move status up to the root of error
  error.status = error.response.status;

  const contentType = error.response.headers.get('content-type');
  if(contentType && contentType.includes('json')) {
    const errorBody = await error.response.json();
    // the HTTPError received from ky has a generic message based on status
    // use that if the JSON body does not include a message
    error.message = errorBody.message || error.message;
    error.data = errorBody;
  }
  throw error;
}

/**
 * Creates a wrapped httpClient that adds an `Authorization: Bearer ...` header
 * to all requests.
 *
 * @param {object} options - Options hashmap.
 * @param {string} options.accessToken - Bearer access token.
 * @param {object} [options.httpsAgent] - Optional HTTPS agent.
 *
 * @return {Proxy<httpClient>} Bearer token client instance.
 */
export function createBearerTokenClient({accessToken, httpsAgent} = {}) {
  if(typeof accessToken !== 'string') {
    throw new TypeError('"accessToken" parameter is required.');
  }
  return new Proxy(httpClient, {
    async apply(target, thisArg, args) {
      return _handleAuthorizedRequest({
        target, thisArg, args, accessToken, httpsAgent
      });
    },
    get(target, propKey) {
      const propValue = target[propKey];

      // only intercept particular methods
      if(!proxyMethods.has(propKey)) {
        return propValue;
      }
      return async function() {
        return _handleAuthorizedRequest({
          target: propValue, thisArg: this, args: arguments, accessToken,
          httpsAgent
        });
      };
    }
  });
}

/**
 * Adds an `Authorization: Bearer ${accessToken}` header to the options,
 * and passes through the request to the wrapped `httpClient` instance.
 *
 * @param {object} options - Options hashmap.
 * @param {function} options.target - httpClient method ('get', 'post', etc).
 * @param {object} options.thisArg - httpClient instance.
 * @param {Array<*>} options.args - Method arguments ([url, options]).
 * @param {string} options.accessToken - Access token.
 * @param {object} [options.httpsAgent] - Optional HTTPS agent.
 *
 * @return {Promise} Resolves with httpClient method response.
 */
async function _handleAuthorizedRequest({
  target, thisArg, args, accessToken, httpsAgent
} = {}) {
  const [url, options = {}] = args;

  if(httpsAgent) {
    options.httpsAgent = httpsAgent;
  }
  options.headers = options.headers || {};

  let authzHeader = options.headers.Authorization;
  if(!authzHeader) {
    authzHeader = `Bearer ${accessToken}`;
  } else {
    // One or more Authorization: headers exist
    authzHeader = Array.isArray(`Bearer ${accessToken}`) ?
      authzHeader : [authzHeader];
    authzHeader.push(`Bearer ${accessToken}`);
  }
  options.headers.Authorization = authzHeader;

  return target.apply(thisArg, [url, options]);
}

export default {
  httpClient,
  ky: kyOriginal,
  DEFAULT_HEADERS,
  createBearerTokenClient
};
