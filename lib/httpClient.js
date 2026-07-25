/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {convertAgent} from './agentCompatibility.js';
import ky from 'ky';

export {ky};

export const DEFAULT_HEADERS = {
  Accept: 'application/ld+json, application/json'
};

/*
Methods to proxy from `ky`. This must mirror `ky`'s own helper registry
(`requestMethods` in its `core/constants.js`), because proxying indexes into
`ky[method]` -- a name `ky` does not implement would throw on first call.

`ky` accepts more methods than it exposes helpers for: `options` and `trace`
are in its `HttpMethod` type and its retry defaults, and `query` is on `ky`'s
main branch but unreleased as of `ky@2.0.2`. Those are reached through
`httpClient(url, {method})`, which falls through to `ky` directly, rather
than by being listed here.
*/
const PROXY_METHODS = new Set([
  'get', 'post', 'put', 'patch', 'head', 'delete'
]);

/**
 * Returns a custom httpClient instance. Used to specify default headers and
 * other default overrides.
 *
 * @param {object} [options={}] - Options hashmap.
 * @param {object} [options.parent] - The ky instance to inherit from.
 * @param {object} [options.headers={}] - Default header overrides.
 * @param {object} [options.params] - Other default overrides.
 *
 * @returns {Function} Custom httpClient instance.
 */
export function createInstance({
  parent = ky, headers = {}, ...params
} = {}) {
  // convert legacy agent options
  params = convertAgent(params);

  // create new ky instance
  let _ky;
  if(parent === ky) {
    // ensure default headers, allow overrides
    _ky = parent.create({
      // use a `Headers` instance (instead of a plain object) so ky merges
      // per-request headers case-insensitively; ky's plain-object merge
      // path does a `{...a, ...b}` spread, which does not dedupe header
      // names that differ only by case (e.g. `Accept` vs `accept`)
      headers: new Headers({...DEFAULT_HEADERS, ...headers}),
      ...params
    });
  } else {
    // extend parent
    _ky = parent.extend({headers: new Headers(headers), ...params});
  }

  return _createHttpClient(_ky);
}

function _createHttpClient(ky) {
  async function httpClient(...args) {
    const method = ((args[1] && args[1].method) || 'get').toLowerCase();
    if(PROXY_METHODS.has(method)) {
      return httpClient[method].apply(ky[method], args);
    }

    // convert legacy agent options
    args[1] = convertAgent(args[1]);
    return ky.apply(ky, args);
  }

  for(const method of PROXY_METHODS) {
    httpClient[method] = async function(...args) {
      return _handleResponse(ky[method], ky, args);
    };
  }

  httpClient.create = function({headers = {}, ...params}) {
    return createInstance({headers, ...params});
  };

  httpClient.extend = function({headers = {}, ...params}) {
    return createInstance({parent: ky, headers, ...params});
  };

  // default async `stop` signal getter
  Object.defineProperty(httpClient, 'stop', {
    async get() {
      return ky.stop;
    }
  });

  return httpClient;
}

async function _handleResponse(target, thisArg, args) {
  // convert legacy agent options
  args[1] = convertAgent(args[1]);

  let response;
  const [url] = args;
  try {
    response = await target.apply(thisArg, args);
  } catch(error) {
    return _handleError({error, url});
  }
  const {parseBody = true} = args[1] || {};
  // always set 'data', default to undefined
  let data;
  if(parseBody) {
    // a 204 will not include a content-type header
    const contentType = response.headers.get('content-type');
    if(contentType && contentType.includes('json')) {
      data = await response.json();
    }
  }
  Object.defineProperty(response, 'data', {value: data});
  return response;
}

/**
 * @param {object} options - Options hashmap.
 * @param {Error} options.error - Error thrown during http operation.
 * @param {string} options.url - Target URL of the request.
 *
 * @returns {Promise} Rejects with a thrown error.
 */
async function _handleError({error, url}) {
  error.requestUrl = url;

  // handle network errors and system errors that do not have a response
  if(!error.response) {
    if(error.message === 'Failed to fetch' ||
      error.cause?.message === 'Failed to fetch') {
      // ky@2 wraps the browser's underlying `TypeError: Failed to fetch`
      // in its own `NetworkError`, with the original error as `cause`
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
    // the HTTPError received from ky has a generic message based on status
    // use that if the JSON body does not include a message
    error.message = error.data?.message || error.message;
  }
  throw error;
}
