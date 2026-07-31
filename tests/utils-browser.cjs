/*!
 * Copyright (c) 2023-2026 Digital Bazaar, Inc.
 */
'use strict';

const api = {};
module.exports = api;

api.startServers = async () => {
  return {
    // mock server
    // karma will startup real server
    httpServer: {
      close: async () => {}
    },
    // mock server
    // karma will startup real server
    httpsServer: {
      close: async () => {}
    },
    // get host string from server karma started
    httpHost: process.env.TEST_HTTP_HOST,
    httpsHost: process.env.TEST_HTTPS_HOST
  };
};
