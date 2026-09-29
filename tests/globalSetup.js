/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
// starts the local HTTP/HTTPS test servers once per project and hands their
// ephemeral hosts to the tests via `inject()`; the servers must start here,
// on the Node.js side, because the browser project cannot run them itself
import {startServers} from './utils.js';

export default async function setup(project) {
  const {httpServer, httpsServer, httpHost, httpsHost} = await startServers();

  project.provide('httpHost', httpHost);
  project.provide('httpsHost', httpsHost);

  return async () => {
    httpServer.close();
    httpsServer.close();
  };
}
