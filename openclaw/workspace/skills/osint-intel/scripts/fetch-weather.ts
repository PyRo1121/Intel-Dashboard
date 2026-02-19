import { type IntelItem, HTTP_TIMEOUT_MS, USER_AGENT } from "./utils/types";

export async function fetchWeatherAlerts(): Promise<IntelItem[]> {
  const items: IntelItem[] = [];

  const regions = [
    { name: "US", url: "https://api.weather.gov/alerts/active?area=US" },
    { name: "Texas", url: "https://api.weather.gov/alerts/active?area=TX" },
    { name: "Florida", url: "https://api.weather.gov/alerts/active?area=FL" },
    { name: "California", url: "https://api.weather.gov/alerts/active?area=CA" },
    { name: "Gulf Coast", url: "https://api.weather.gov/alerts/active?area=GM" },
  ];

  for (const region of regions) {
    try {
      const res = await fetch(region.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const alerts = data?.features?.slice(0, 3) || [];

      for (const alert of alerts) {
        const props = alert.properties;
        if (props.event?.toLowerCase().includes("severe")) {
          items.push({
            title: `[WEATHER] ${props.event}`,
            summary: props.headline || props.description?.slice(0, 200),
            source: "NWS Weather",
            url: props.uri,
            timestamp: new Date(props.sent).getTime(),
            region: region.name.toLowerCase(),
            category: "weather",
            severity: props.severity === "Extreme" ? "critical" : "high",
          });
        }
      }
    } catch {
      // Skip failed requests
    }
  }

  return items;
}
