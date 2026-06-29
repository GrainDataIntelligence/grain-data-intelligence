// Cache-busted entrypoint for the current deliveries dashboard build.
// Keep the implementation in deliveries.js and load it through this file name
// when a browser is holding onto an older deliveries.js response.
import("./deliveries.js?v=20260601-grade-panel-fix");
