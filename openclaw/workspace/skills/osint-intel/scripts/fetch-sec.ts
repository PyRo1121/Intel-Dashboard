import { type IntelItem, HTTP_TIMEOUT_MS, USER_AGENT } from "./utils/types";

const SEC_CIKS = [
  { name: "MicroStrategy", cik: "0001050446" },
  { name: "Grayscale", cik: "0001588589" },
  { name: "BlackRock", cik: "0001364742" },
  { name: "ARK Invest", cik: "0001617585" },
  { name: "Fidelity", cik: "0001035538" },
];

export async function fetchSECFilings(): Promise<IntelItem[]> {
  const items: IntelItem[] = [];

  for (const entity of SEC_CIKS.slice(0, 3)) {
    try {
      const res = await fetch(
        `https://data.sec.gov/submissions/CIK${entity.cik}.json`,
        {
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        }
      );

      if (!res.ok) continue;

      const data = await res.json();
      const recent = data?.filings?.recent?.form?.slice(0, 3) || [];
      const dates = data?.filings?.recent?.filingDate?.slice(0, 3) || [];
      const descriptions = data?.filings?.recent?.primaryDocumentDescription?.slice(0, 3) || [];

      for (let i = 0; i < recent.length; i++) {
        const form = recent[i];
        if (form === "13F-HR" || form === "10-K" || form === "10-Q") {
          items.push({
            title: `${entity.name} filed ${form}`,
            summary: descriptions[i] || `${form} filing`,
            source: "SEC EDGAR",
            url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${entity.cik}&type=${form}`,
            timestamp: dates[i] ? new Date(dates[i]).getTime() : Date.now(),
            region: "global",
            category: "institutional",
            severity: "medium",
          });
        }
      }
    } catch {
      // Skip failed requests
    }
  }

  return items;
}
