# @digitalbazaar/http-client ChangeLog

## 2.0.0 -

### Changed
- **BREAKING**: Include full URL in `Possible CORS error.` type errors.
- **BREAKING**: For `TimeoutError`, change the error message to include the
  request's url. Was: `Request timed out`, 
  now: `Request to "example.com" timed out.`

### Added
- Add a `.requestUrl` property to all errors, for easier logging/diagnostics.

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
