/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
import {Agent, fetch as undiciFetch} from 'undici';

// as long as an agent has a reference to it, its associated dispatcher will
// be kept in this cache for reuse
const AGENT_CACHE = new WeakMap();

// converts `agent`/`httpsAgent` option to a dispatcher option
export function convertAgent(options) {
  // do not override custom fetch function from another lib
  if(options?.fetch && !options.fetch._httpClientCustomFetch) {
    return options;
  }

  // only override if an agent option is present
  const agent = options?.agent || options?.httpsAgent;
  if(!agent) {
    return options;
  }

  // use custom fetch if agent has already been converted
  let fetch = AGENT_CACHE.get(agent);
  if(!fetch) {
    const dispatcher = new Agent({connect: agent.options});
    fetch = createFetch(dispatcher);
    fetch._httpClientCustomFetch = true;
    AGENT_CACHE.set(agent, fetch);
  }

  return {...options, fetch};
}

// create fetch override uses custom `dispatcher`; since `ky` does not pass
// the dispatcher option through to `fetch`, we must use this override
//
// this uses undici's own `fetch` rather than `globalThis.fetch`. a dispatcher
// is only usable by the undici that created it: node bundles its own undici
// (node 22: 6.x, node 24: 7.x, node 26: 8.x) and the handler interface changed
// between majors, so handing an installed-undici dispatcher to node's built-in
// `fetch` throws `UND_ERR_INVALID_ARG` ("invalid onError method" on node 26).
// pairing the dispatcher with the `fetch` from the same module keeps the two
// in sync on any node version, whichever undici is installed
function createFetch(dispatcher) {
  return function fetch(...args) {
    dispatcher = (args[1] && args[1].dispatcher) || dispatcher;
    args[1] = {...args[1], dispatcher};
    // `ky` builds a global `Request`, which undici's `fetch` does not accept
    // as one of its own; unpack it into a url and init pair instead
    if(args[0] instanceof globalThis.Request) {
      args[1] = {..._requestToInit(args[0]), ...args[1]};
      args[0] = args[0].url;
    }
    return undiciFetch(...args);
  };
}

// converts a `Request` into an equivalent `fetch` init object
function _requestToInit(request) {
  const {body} = request;
  return {
    method: request.method,
    // an entry list is understood by every `Headers` implementation
    headers: [...request.headers],
    body,
    // undici requires `duplex` whenever a stream body is sent
    duplex: body ? 'half' : undefined,
    signal: request.signal,
    redirect: request.redirect
  };
}
