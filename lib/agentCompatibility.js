/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
import {Agent, fetch as undiciFetch, Request as UndiciRequest} from 'undici';
import undiciPkg from 'undici/package.json' with {type: 'json'};
import {versions} from 'node:process';

// as long as an agent has a reference to it, its associated dispatcher will
// be kept in this cache for reuse
const AGENT_CACHE = new WeakMap();

// can only convert agent to dispatcher option on node 18.2+
const [major, minor] = versions.node.split('.').map(v => parseInt(v, 10));
const canConvert = (major > 18) || (major === 18 && minor >= 2);

// A dispatcher built from the bundled undici's `Agent` shares a handler
// contract with the runtime's `fetch` only when their undici majors match.
// This package installs undici 6; node's own bundled undici major varies by
// release line and does not necessarily match that -- today node 22 bundles
// undici 6 (matches), while node 24 bundles undici 7 and node 26 bundles
// undici 8 (both mismatch, so both already take the fallback path below,
// not just node 26). The contract that breaks (the dispatcher handler's
// `onError`) changed across those majors, so a mismatched pairing rejects
// the bundled v6 dispatcher with "invalid onError method". When they match
// we hand the dispatcher to `ky`, which forwards it to the runtime fetch (ky
// deliberately keeps `dispatcher` out of its request-option registry so it
// reaches fetch). When they differ we call the bundled undici's own fetch,
// which cannot consume the runtime's `Request` class directly, so it is
// rebuilt as the bundled undici's own `Request` first (see `createFetch`
// below). This skew only exists because node does not
// expose its built-in undici (`node:undici`); see
// digitalbazaar/http-client#43.
// The version read is guarded: if a future undici hides `package.json` behind
// an `exports` map, or `process.versions.undici` is absent, default to the
// bundled undici's own fetch (the always-safe path) rather than throwing at
// module load and breaking `import` for every consumer.
const nativeFetchCompatible = (() => {
  try {
    const bundledMajor = parseInt(undiciPkg.version, 10);
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

  // incompatible runtime `fetch` that rejects this dispatcher, so route
  // through the bundled undici's own fetch via an override
  let fetch = AGENT_CACHE.get(dispatcher);
  if(!fetch) {
    fetch = createFetch(dispatcher);
    fetch._httpClientCustomFetch = true;
    AGENT_CACHE.set(dispatcher, fetch);
  }
  return {...rest, fetch};
}

// create fetch override uses custom `dispatcher`; on an incompatible runtime
// `ky`'s runtime `Request` cannot be consumed by the bundled undici's fetch
// directly, so it is rebuilt as the bundled undici's own `Request` here.
// Passing the runtime `Request` as undici's `Request` *init* (its second
// constructor argument) works because undici's own `Request` constructor
// performs its own `RequestInit` dictionary conversion -- it reads exactly
// the fields its own implementation understands directly off the object it's
// given, duck-typed rather than `instanceof`-checked, so it stays correct
// automatically as undici's own supported fields evolve. No manual
// allow/deny-list of `RequestInit` fields is needed or maintained here.
function createFetch(defaultDispatcher) {
  return function fetch(input, init) {
    const dispatcher = init?.dispatcher || defaultDispatcher;
    if(input && typeof input === 'object' && typeof input.url === 'string') {
      const request = new UndiciRequest(input.url, input);
      return undiciFetch(request, {...init, dispatcher});
    }
    return undiciFetch(input, {...init, dispatcher});
  };
}
