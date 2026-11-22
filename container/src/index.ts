import { DurableObject } from "cloudflare:workers";

interface Env {
  SEARCH: DurableObjectNamespace<SearchContainer>;
  DATA_BASE: string;
  JEV_MODEL: string;
  JEV_MAX_ROWS_PER_STATEMENT: string;
  TYPESAFE_API_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  DEMO_TOKEN?: string;
}

const PORT = 8080;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export class SearchContainer extends DurableObject<Env> {
  private starting: Promise<void> | undefined;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (container?.running) {
      void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS));
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Concurrent requests share one startup and readiness check.
    this.starting ??= this.startAndWaitForPort().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");
    return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
  }

  private async startAndWaitForPort(): Promise<void> {
    const container = this.ctx.container!;
    if (!container.running) {
      container.start({
        image: container.images.base,
        instance: "standard-1",
        // The container calls the TypeSafe API and reads R2 over HTTPS.
        enableInternet: true,
        env: {
          DATA_BASE: this.env.DATA_BASE,
          JEV_MODEL: this.env.JEV_MODEL,
          JEV_MAX_ROWS_PER_STATEMENT: this.env.JEV_MAX_ROWS_PER_STATEMENT,
          TYPESAFE_API_KEY: this.env.TYPESAFE_API_KEY,
          R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
          R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
          R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,
        },
      });
    }
    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

    const port = container.getTcpPort(PORT);
    let lastError: unknown;
    for (let attempt = 0; attempt < 150; attempt++) {
      try {
        const res = await port.fetch("http://container/health", { signal: AbortSignal.timeout(1000) });
        await res.body?.cancel();
        if (res.ok) return;
        lastError = new Error(`health check returned ${res.status}`);
      } catch (error) {
        lastError = error;
      }
      await scheduler.wait(200);
    }
    throw new Error(`container did not become ready on port ${PORT}`, { cause: lastError });
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-demo-token",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const { pathname } = new URL(request.url);
    if (!["/health", "/questions", "/search"].includes(pathname)) {
      return new Response("not found", { status: 404, headers: CORS });
    }
    // Searches call the TypeSafe API and cost money; require a token when DEMO_TOKEN is set.
    if (pathname === "/search" && env.DEMO_TOKEN && request.headers.get("x-demo-token") !== env.DEMO_TOKEN) {
      return new Response("forbidden", { status: 403, headers: CORS });
    }
    // One container instance is enough for a demo.
    const res = await env.SEARCH.getByName("search").fetch(request);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },
} satisfies ExportedHandler<Env>;
