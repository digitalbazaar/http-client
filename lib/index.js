/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {
  createInstance,
  DEFAULT_HEADERS,
  kyOriginalPromise
} from './httpClient.js';

export {kyOriginalPromise as kyPromise, DEFAULT_HEADERS};

export const httpClient = createInstance();
