interface Env {
  ASSETS: Fetcher;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/api\//, "");

  let staticPath: string;
  if (apiPath === "manifest" || apiPath === "manifest/") {
    staticPath = "/bibles/manifest.json";
  } else if (apiPath.startsWith("bibles/")) {
    staticPath = `/bibles/${apiPath.slice(7)}.json`;
  } else {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const assetUrl = new URL(staticPath, url.origin);
    const response = await env.ASSETS.fetch(assetUrl);
    if (response.status === 200) {
      return new Response(response.body, {
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch {}

  return new Response(JSON.stringify({ error: `Bible version "${apiPath}" not found` }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}
