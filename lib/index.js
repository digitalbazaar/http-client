/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import {
  kyOriginalPromise, DEFAULT_HEADERS, createInstance
} from './httpClient.js';

export {kyOriginalPromise as kyPromise, DEFAULT_HEADERS};

export const httpClient = createInstance();
