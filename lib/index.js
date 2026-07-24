/*!
 * Copyright (c) 2020-2026 Digital Bazaar, Inc.
 */
import {
  createInstance,
  DEFAULT_HEADERS,
  ky
} from './httpClient.js';

export {ky, DEFAULT_HEADERS};

export const httpClient = createInstance();
