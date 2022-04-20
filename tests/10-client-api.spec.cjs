/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
const {kyPromise, httpClient, DEFAULT_HEADERS} = require('..');
const isNode = require('detect-node');
const {test} = require('./10-client-api.spec.common.cjs');

test({kyPromise, httpClient, DEFAULT_HEADERS, isNode});
