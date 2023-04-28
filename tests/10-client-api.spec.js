/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {
  DEFAULT_HEADERS,
  httpClient,
  kyPromise
} from '../lib/index.js';
import isNode from 'detect-node';
import {test} from './10-client-api.spec.common.cjs';
import utils from './utils.cjs';

test({kyPromise, httpClient, DEFAULT_HEADERS, isNode, utils});
