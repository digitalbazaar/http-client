# @digitalbazaar/http-client ChangeLog

## 3.4.1 - 2023-04-28

### Changed
- Use a local HTTP server for most testing.
- Use httpstat.us for valid cert HTTPS testing.
- Add local server self-signed certificate HTTPS test.
- Test on Node.js 20.x.

### Fixed
- Fix Node.js 19+ compatibility bug.

## 3.4.0 - 2023-04-14

### Changed
- Update dependencies.

### Fixed
- Defer importing `ky-universal` until needed.
  - Prevents dangling `Promise` with an import in it.
  - Avoids dynamic `import` when not needed.
  - Helps address issues when using Jest.
  - [PR #35](https://github.com/digitalbazaar/http-client/pull/35)
  - [Issue #34](https://github.com/digitalbazaar/http-client/issues/34)
  - [jsonld.js Issue #519](https://github.com/digitalbazaar/jsonld.js/issues/516)

## 3.3.0 - 2023-01-17

### Changed
- Update dependencies.
  - `ky@0.33`/`ky-universal@0.11`: Fixes security issues and also changes the
    behavior of an empty response body when using `.json()`. An empty string
    will now be returned instead of throwing.
  - **NOTE**: This is a minor release but it is possible the changed empty
    response body behavior could cause compatibility issues. Please check
    your code.
- Update development dependencies.

## 3.2.0 - 2022-05-19

### Added
- Add compatibility code to convert agent options to an undici dispatcher for
  use with node 18. This code enables node 18 to be used with the legacy
  `agent` and `httpsAgent` options.

## 3.1.0 - 2022-05-03

### Removed
- Remove unused dependencies.

### Changed
- Always set response `data` field and default to `undefined`. Addresses issue
  when a non-JSON response is receieved, a caller accesses the `data` field,
  and a lower level library prints out a one-time warning to use other fields.
- Update dependencies.
- Lint module.

## 3.0.1 - 2022-04-26

### Fixed
- Fix direct calls to `httpClient()`. If the call options use a method that
  is supported as a base function helper, e.g., `httpClient.get`, then it
  will be treated as if that helper was called just like the previous
  version of this library.

## 3.0.0 - 2022-04-20

### Changed
- **BREAKING**: Convert to module (ESM) internally and use conditional exports
  to export a directory that has an entry point for CommonJS.
- Use `ky@0.30` and `ky-universal@0.10.1`.
- **BREAKING**: Only specific methods and properties are proxied from `ky`
  on `httpClient` instances now. This includes the same set of functions
  that were proxied in previous versions:

  `get`, `post`, `put`, `push`, `patch`, `head`, `delete`

  With the same caveat that these functions return a promise that resolves
  to the response (just like in previous versions, but different from `ky`
  which returns the response synchronously). This version also proxies
  `create` and `extend`, where `extend` now properly inherits options from
  the parent `ky` instance. The `stop` property is also proxied, but returns
  a promise that resolves to the `ky.stop` signal. This change was made because
  the latest version of `ky` is ESM-only -- and to continue supporting a CJS
  build, it meant importing the library dynamically. Therefore, the `ky`
  instance must settle before it can be used -- requiring all `httpClient`
  methods and accessors to be asynchronous.

### Removed
- **BREAKING**: Drop support for node 10 and 12.

## 2.0.1 - 2021-12-01

### Fixed
- Remove unused `httpsAgent` param.

## 2.0.0 - 2021-11-15

### Changed
- **BREAKING**: Include full URL in `Possible CORS error.` type errors.
- **BREAKING**: For `TimeoutError`, change the error message to include the
  request's url. Was: `Request timed out`,
  now: `Request to "example.com" timed out.`
- **BREAKING**: Remove default exports.

### Added
- Add a `.requestUrl` property to all errors, for easier logging/diagnostics.
- Add `PUT` to allowed proxied methods.

### Fixed
- Fix `.extend()` to return a proxy (with default headers, etc).

## 1.2.0 - 2021-07-19

### Added
- Ensure that body parsing will occur for JSON content types
  when individual method functions (e.g., `get`, `post`) are
  not used (e.g., `httpClient(url, {method: 'get'}`). Body
  parsing can be disabled by passing the `parseBody` option
  set to `false`.

## 1.1.0 - 2021-04-06

### Changed
- Updated `ky`, `ky-universal`, and `mocha` dependencies.

## 1.0.0 - 2020-06-18

### Added
- Add core files.

- See git history for changes previous to this release.
