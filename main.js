/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import kyOriginal from 'ky-universal';

export const ky = kyOriginal;

export const DEFAULT_HEADERS = {
  Accept: 'application/ld+json, application/json'
};

const proxyMethods = new Set([
  'get', 'post', 'put', 'push', 'patch', 'head', 'delete'
]);

/**
 * Returns a custom httpClient instance. Used to specify default headers and
 * other default overrides.
 *
 * @param {object} [options={}] - Options hashmap.
 * @param {object} [options.headers={}] - Default header overrides.
 * @param {object} [options.httpsAgent] - Optional HTTPS agent.
 * @param {object} [options.params] - Other default overrides.
 *
 * @return {httpClient} Custom httpClient instance.
 */
function _proxyExtend({headers = {}, httpsAgent, ...params} = {}) {
  // Ensure default headers, allow overrides
  const ky = kyOriginal.create({
    headers: {...DEFAULT_HEADERS, ...headers},
    agent: httpsAgent,
    ...params
  });
  return _createProxy({ky});
}

export const httpClient = _proxyExtend();

function _createProxy({ky} = {}) {
  const clientProxy = new Proxy(ky, {
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
  clientProxy.extend = _proxyExtend;
  return clientProxy;
}

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
