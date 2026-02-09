/**
 * Global polyfills for Node.js environment.
 *
 * @hcengineering packages assume a browser-like environment.
 * These polyfills provide the minimum required browser globals
 * (indexedDB, window, navigator) so the packages work in Node.js.
 *
 * Uses Object.defineProperty to set browser globals on globalThis
 * without needing type casts, since Node.js types don't include
 * browser-only globals like indexedDB and window.
 * The eslint-disable for immutable-data is needed because polyfills
 * must mutate globalThis by definition.
 */

/* eslint-disable functional/immutable-data */
import fakeIndexedDB from "fake-indexeddb"

Object.defineProperty(globalThis, "indexedDB", {
  value: fakeIndexedDB,
  writable: true,
  configurable: true
})

// dirtiest hack here. current api package is frontend-oriented, but we somehow run it on the server and it somehow works. hooray?
const mockWindow: Record<string, unknown> = {
  addEventListener: () => {},
  removeEventListener: () => {},
  location: { href: "" },
  document: {}
}

Object.defineProperty(globalThis, "window", {
  value: mockWindow,
  writable: true,
  configurable: true
})

if (typeof globalThis.navigator === "undefined") {
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent: "node" },
    writable: true,
    configurable: true
  })
}
