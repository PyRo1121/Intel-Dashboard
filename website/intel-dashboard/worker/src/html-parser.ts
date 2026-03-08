// ============================================================================
// Telegram HTML Parser — ported from fetch-telegram-intel.py regex patterns
// ============================================================================

export interface ParsedMessage {
  /** Format: "channel_username/message_id" */
  id: string;
  text: string;
  datetime: string;
  views: string;
  link: string;
  media: MediaItem[];
  hasVideo: boolean;
  hasPhoto: boolean;
}

export interface MediaItem {
  type: "photo" | "video";
  url: string;
  thumbnail?: string;
}

// HTML entity decoding
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
  "&mdash;": "\u2014",
  "&ndash;": "\u2013",
  "&laquo;": "\u00AB",
  "&raquo;": "\u00BB",
  "&hellip;": "\u2026",
};

function decodeEntities(html: string): string {
  let result = html;
  for (const [entity, char] of Object.entries(ENTITIES)) {
    result = result.replaceAll(entity, char);
  }
  // Numeric entities: &#123; and &#x1F; patterns
  result = result.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10)),
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16)),
  );
  return result;
}

/**
 * Parse Telegram channel preview HTML into structured messages.
 * Mirrors the Python regex logic from fetch-telegram-intel.py lines 708-784.
 */
export function parseChannelHtml(html: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  // Split by message wrapper div (same split as Python: line 709)
  const msgWraps = html.split(/(?=<div class="tgme_widget_message_wrap)/);

  for (const wrap of msgWraps) {
    if (!wrap.includes("tgme_widget_message_wrap")) continue;

    // Extract post ID: data-post="channel/messageId" (Python: lines 715-719)
    const postMatch = wrap.match(/data-post="([^"]+)"/);
    if (!postMatch) continue;
    const postId = postMatch[1];
    const link = `https://t.me/${postId}`;

    // Extract text content (Python: lines 722-731)
    let text = "";
    const textMatch = wrap.match(
      /class="tgme_widget_message_text[^"]*"[^>]*>(.*?)<\/div>/s,
    );
    if (textMatch) {
      text = textMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .trim();
      text = decodeEntities(text);
      text = text.replace(/ +/g, " ").trim();
    }

    // Extract datetime (Python: lines 733-734)
    let datetime = "";
    const timeMatch = wrap.match(/<time[^>]*datetime="([^"]+)"/);
    if (timeMatch) datetime = timeMatch[1];

    // Extract views count (Python: lines 736-737)
    let views = "";
    const viewsMatch = wrap.match(
      /class="tgme_widget_message_views">([^<]+)/,
    );
    if (viewsMatch) views = viewsMatch[1].trim();

    // Extract media (Python: lines 739-782)
    const media: MediaItem[] = [];

    // Videos (Python: lines 742-752)
    const videoSrcs = [...wrap.matchAll(/<video[^>]+src="([^"]+)"/g)];
    for (const vs of videoSrcs) {
      const thumbMatch = wrap.match(
        /tgme_widget_message_video_thumb[^"]*"[^>]*style="background-image:url\('([^']+)'\)/,
      );
      media.push({
        type: "video",
        url: vs[1],
        thumbnail: thumbMatch?.[1],
      });
    }

    // Photos — primary selector (Python: lines 754-762)
    const photoUrls = [
      ...wrap.matchAll(
        /class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/g,
      ),
    ];
    for (const pu of photoUrls) {
      if (
        pu[1].includes("telesco.pe") ||
        pu[1].includes("telegram.org/file")
      ) {
        media.push({ type: "photo", url: pu[1] });
      }
    }

    // Photos — fallback for inline format (Python: lines 764-769)
    if (photoUrls.length === 0) {
      const inlinePhotos = [
        ...wrap.matchAll(
          /tgme_widget_message_photo[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/g,
        ),
      ];
      for (const ip of inlinePhotos) {
        if (
          ip[1].includes("telesco.pe") ||
          ip[1].includes("telegram.org/file")
        ) {
          media.push({ type: "photo", url: ip[1] });
        }
      }
    }

    // Skip completely empty messages (no text, no media)
    if (!text && media.length === 0) continue;

    messages.push({
      id: postId,
      text,
      datetime,
      views,
      link,
      media,
      hasVideo: media.some((m) => m.type === "video"),
      hasPhoto: media.some((m) => m.type === "photo"),
    });
  }

  return messages;
}
