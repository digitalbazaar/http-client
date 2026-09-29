/*!
 * Copyright (c) 2026 Digital Bazaar, Inc.
 */
// vitest re-exports chai's `should` interface; expose it as a global so the
// existing `should`-style assertions work unchanged
import {should} from 'vitest';

globalThis.should = should();
