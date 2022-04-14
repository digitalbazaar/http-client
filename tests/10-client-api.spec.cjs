/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
const {ky, httpClient, DEFAULT_HEADERS} = require('..');
const isNode = require('detect-node');
const {test} = require('./10-client-api.spec.common.cjs');

test({ky, httpClient, DEFAULT_HEADERS, isNode});
