/*!
 * Copyright (c) 2022-2026 Digital Bazaar, Inc.
 */
import {Agent, fetch as undiciFetch, Request as UndiciRequest} from 'undici';
import undiciPkg from 'undici/package.json' with {type: 'json'};
import {versions} from 'node:process';

/*
Background: node ships its own copy of undici in the platform but does not
expose it (there is no `node:undici`), so this package installs its own. A
dispatcher only works with the undici that created it -- the handler contract
changed across majors, so handing an installed v6 dispatcher to a platform v7
or v8 `fetch` fails with "invalid onError method". Which major the platform
provides varies by release line (node 22 has 6, node 24 has 7, node 26 has 8),
so no single installed version matches every supported runtime -- with undici 6
installed, both node 24 and node 26 take the fallback path below. See
digitalbazaar/http-client#43.
*/

// as long as an agent has a reference to it, its associated dispatcher will
// be kept in this cache for reuse
const DISPATCHER_CACHE = new WeakMap();

// on the fallback path, the `fetch` override built for a dispatcher is kept
// here for reuse; the dispatcher is held by DISPATCHER_CACHE for as long as
// its agent lives, so the override has the same lifetime as the agent
const FETCH_CACHE = new WeakMap();

// can only convert agent to dispatcher option on node 18.2+
const [major, minor] = versions.node.split('.').map(v => parseInt(v, 10));
const canConvert = (major > 18) || (major === 18 && minor >= 2);

/*
True when the installed and platform undici majors match, meaning their
dispatchers are interchangeable. Both reads are guarded: a future undici could
hide `package.json` behind an `exports` map, and `versions.undici` may be
absent. Either way fall back to `false` and use the installed undici's own
fetch -- the always-safe path -- rather than throwing at module load and
breaking `import` for every consumer.
*/
const platformFetchCompatible = (() => {
  try {
    const installedMajor = parseInt(undiciPkg.version, 10);
    const platformMajor = parseInt(versions.undici, 10);
    return platformMajor === installedMajor;
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
  let dispatcher = DISPATCHER_CACHE.get(agent);
  if(!dispatcher) {
    dispatcher = new Agent({connect: agent.options});
    DISPATCHER_CACHE.set(agent, dispatcher);
  }

  // drop the converted legacy options so they are not forwarded to `fetch`
  const rest = {...options};
  delete rest.agent;
  delete rest.httpsAgent;

  // majors match: hand the dispatcher to `ky`, which forwards it to the
  // platform `fetch` (`ky` deliberately keeps `dispatcher` out of its
  // request-option registry so it reaches fetch) -- no wrapper needed
  if(platformFetchCompatible) {
    return {...rest, dispatcher};
  }

  // incompatible platform `fetch` that rejects this dispatcher, so route
  // through the installed undici's own fetch via an override
  let fetch = FETCH_CACHE.get(dispatcher);
  if(!fetch) {
    fetch = createFetch(dispatcher);
    fetch._httpClientCustomFetch = true;
    FETCH_CACHE.set(dispatcher, fetch);
  }
  return {...rest, fetch};
}

/*
Create fetch override uses custom `dispatcher`; when incompatible, the platform
`Request` that `ky` creates cannot be consumed by the installed undici's fetch
directly, so it is rebuilt as the installed undici's own `Request` here.

Passing the platform `Request` as undici's `Request` *init* (its second
constructor argument) works because undici's own `Request` constructor performs
its own `RequestInit` dictionary conversion -- it reads exactly the fields its
own implementation understands directly off the object it's given, duck-typed
rather than `instanceof`-checked, so it stays correct automatically as undici's
own supported fields evolve. No manual allow/deny-list of `RequestInit` fields
is needed or maintained here.
*/
function createFetch(defaultDispatcher) {
  return function fetch(input, init) {
    const dispatcher = init?.dispatcher || defaultDispatcher;
    if(input && typeof input === 'object' && typeof input.url === 'string') {
      input = new UndiciRequest(input.url, input);
    }
    return undiciFetch(input, {...init, dispatcher});
  };
}
