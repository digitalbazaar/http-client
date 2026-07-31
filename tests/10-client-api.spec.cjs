/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
const {kyPromise, httpClient, DEFAULT_HEADERS} = require('..');
const isNode = require('detect-node');
const {test} = require('./10-client-api.spec.common.cjs');
const utils = require('./utils.cjs');

test({kyPromise, httpClient, DEFAULT_HEADERS, isNode, utils});
