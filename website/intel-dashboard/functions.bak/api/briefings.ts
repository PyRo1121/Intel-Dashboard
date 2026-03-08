const BACKEND = "https://api-intel.pyro1121.com";
const CACHE_TTL = 300;

export const onRequestGet: PagesFunction = async (context) => {
  const cacheUrl = new URL(context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), context.request);
  const cache = caches.default;

  let response = await cache.match(cacheKey);
  if (response) return response;

  const backendRes = await fetch(`${BACKEND}/api/briefings`, {
    headers: { "User-Agent": "PyRoBOT-Edge/1.0" },
    cf: { cacheTtl: CACHE_TTL, cacheEverything: true },
  });

  response = new Response(backendRes.body, {
    status: backendRes.status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
      "Access-Control-Allow-Origin": "*",
      "X-Cache-Source": "cloudflare-edge",
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};
