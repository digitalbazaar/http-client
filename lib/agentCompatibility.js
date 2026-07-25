/*!
 * Copyright (c) 2022 Digital Bazaar, Inc. All rights reserved.
 */
import {Agent} from 'undici';

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
function createFetch(dispatcher) {
  return function fetch(...args) {
    dispatcher = (args[1] && args[1].dispatcher) || dispatcher;
    args[1] = {...args[1], dispatcher};
    return globalThis.fetch(...args);
  };
}
