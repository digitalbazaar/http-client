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
  const {host} = new URL(url);

  error.requestHost = host;

  // handle network errors and system errors that do not have a response
  if(!error.response) {
    if(error.message === 'Failed to fetch') {
      error.message = `Failed to fetch host "${host}". Possible CORS error.`;
    }
    // ky's TimeoutError class
    if(error.name === 'TimeoutError') {
      error.message = `Request to host "${host}" timed out.`;
    }

    // node-fetch's FetchError (wraps Node.js system errors)
    if(error.name === 'FetchError') {
      // override error message to remove the full url
      const reason = error.message.split('reason: ')[1];
      error.message = `Request to host "${host}" failed, reason: ${reason}.`;
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

export default {
  httpClient,
  ky: kyOriginal,
  DEFAULT_HEADERS,
};
