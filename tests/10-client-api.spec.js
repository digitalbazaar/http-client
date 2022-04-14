/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {kyPromise, httpClient, DEFAULT_HEADERS} from '../lib/index.js';
import isNode from 'detect-node';
import {test} from './10-client-api.spec.common.cjs';

test({kyPromise, httpClient, DEFAULT_HEADERS, isNode});
