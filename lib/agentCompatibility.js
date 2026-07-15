/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
import {Agent, fetch as undiciFetch} from 'undici';
import {createRequire} from 'node:module';
import {versions} from 'node:process';

// as long as an agent has a reference to it, its associated dispatcher will
// be kept in this cache for reuse
const AGENT_CACHE = new WeakMap();

// can only convert agent to dispatcher option on node 18.2+
const [major, minor] = versions.node.split('.').map(v => parseInt(v, 10));
const canConvert = (major > 18) || (major === 18 && minor >= 2);

// A dispatcher built from the bundled undici's `Agent` shares a handler
// contract with the runtime's `fetch` only when their undici majors match. The
// contract that breaks (the dispatcher handler's `onError`) changed between
// undici 6 and 8, so node<=24 (built-in undici 6) accepts the bundled v6
// dispatcher while node 26 (built-in undici 8) rejects it with
// "invalid onError method". When they match we hand the dispatcher to `ky`,
// which forwards it to the runtime fetch (ky deliberately keeps `dispatcher`
// out of its request-option registry so it reaches fetch). When they differ we
// call the bundled undici's own fetch, which cannot consume the runtime's
// `Request` class and so needs it decomposed to (url, init). This skew only
// exists because node does not expose its built-in undici (`node:undici`); see
// digitalbazaar/http-client#43.
// The version read is guarded: if a future undici hides `package.json` behind
// an `exports` map, or `process.versions.undici` is absent, default to the
// bundled undici's own fetch (the always-safe path) rather than throwing at
// module load and breaking `import` for every consumer.
const nativeFetchCompatible = (() => {
  try {
    const require = createRequire(import.meta.url);
    const bundledMajor = parseInt(require('undici/package.json').version, 10);
    const runtimeMajor = parseInt(versions.undici, 10);
    return runtimeMajor === bundledMajor;
  } catch{
    return false;
  }
})();

// converts `agent`/`httpsAgent` option to a dispatcher option
export function convertAgent(options) {
  if(!canConvert) {
    return options;
  }

  // do not override custom fetch function from another lib
  if(options?.fetch && !options.fetch._httpClientCustomFetch) {
    return options;
  }

  // only override if an agent option is present
  const agent = options?.agent || options?.httpsAgent;
  if(!agent) {
    return options;
  }

  // reuse the dispatcher built for this agent
  let dispatcher = AGENT_CACHE.get(agent);
  if(!dispatcher) {
    dispatcher = new Agent({connect: agent.options});
    AGENT_CACHE.set(agent, dispatcher);
  }

  // drop the converted legacy options so they are not forwarded to `fetch`
  const rest = {...options};
  delete rest.agent;
  delete rest.httpsAgent;

  // compatible runtime: let `ky` forward the dispatcher to the native `fetch`,
  // which consumes the runtime `Request` natively — no wrapper, native perf
  if(nativeFetchCompatible) {
    return {...rest, dispatcher};
  }

  // incompatible runtime (e.g. node 26): the runtime fetch rejects this
  // dispatcher, so route through the bundled undici's own fetch via an override
  let fetch = AGENT_CACHE.get(dispatcher);
  if(!fetch) {
    fetch = createFetch(dispatcher);
    fetch._httpClientCustomFetch = true;
    AGENT_CACHE.set(dispatcher, fetch);
  }
  return {...rest, fetch};
}

// create fetch override uses custom `dispatcher`; on an incompatible runtime
// `ky`'s runtime `Request` cannot be consumed by the bundled undici's fetch, so
// it is decomposed to url + init here. A `Request`'s fields are prototype
// getters with no own-enumerable properties, so it cannot be spread-copied —
// the reads must be explicit, and they mirror the RequestInit fields `ky`
// applies to the Request so no request semantics are dropped.
function createFetch(defaultDispatcher) {
  return function fetch(input, init) {
    const dispatcher = init?.dispatcher || defaultDispatcher;
    if(input && typeof input === 'object' && typeof input.url === 'string') {
      const req = input;
      const reqInit = {
        method: req.method,
        headers: req.headers,
        mode: req.mode,
        credentials: req.credentials,
        cache: req.cache,
        redirect: req.redirect,
        referrer: req.referrer,
        referrerPolicy: req.referrerPolicy,
        integrity: req.integrity,
        keepalive: req.keepalive,
        signal: req.signal
      };
      if(req.body) {
        reqInit.body = req.body;
        reqInit.duplex = 'half';
      }
      return undiciFetch(req.url, {...reqInit, ...init, dispatcher});
    }
    return undiciFetch(input, {...init, dispatcher});
  };
}
