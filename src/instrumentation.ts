// Runs once when the server starts. The Node-only warm-up lives in its own file so it is never bundled for the edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
