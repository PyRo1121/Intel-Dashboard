import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchSubscriberAlertPreferences,
  fetchSubscriberAlerts,
  markAllSubscriberAlertsRead,
  markSubscriberAlertsRead,
  saveSubscriberAlertPreferences,
} from "./my-alerts-client.ts";

test("my alerts client normalizes success and failure payloads", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input) => {
      const url = String(input);
      if (url.includes("/api/subscriber/my-alerts?")) {
        return new Response(JSON.stringify({ unreadCount: 2, items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/subscriber/alert-preferences")) {
        return new Response(JSON.stringify({
          firstReportRegionEnabled: true,
          highSignalRegionEnabled: true,
          firstReportChannelEnabled: true,
          highSignalSourceEnabled: true,
          minimumTelegramHighSignalGrade: "B",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/api/subscriber/my-alerts/read") || url.endsWith("/api/subscriber/my-alerts/read-all")) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const alerts = await fetchSubscriberAlerts("unread");
    assert.equal(alerts?.unreadCount, 2);
    assert.equal((await fetchSubscriberAlertPreferences())?.minimumTelegramHighSignalGrade, "B");
    assert.equal(
      (await saveSubscriberAlertPreferences({
        firstReportRegionEnabled: true,
        highSignalRegionEnabled: false,
        firstReportChannelEnabled: true,
        highSignalSourceEnabled: true,
        minimumTelegramHighSignalGrade: "A",
      }))?.minimumTelegramHighSignalGrade,
      "B",
    );
    assert.equal(await markSubscriberAlertsRead(["a1"]), true);
    assert.equal(await markAllSubscriberAlertsRead(), true);

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.equal(await fetchSubscriberAlerts("all"), null);
    assert.equal(await fetchSubscriberAlertPreferences(), null);
    assert.equal(
      await saveSubscriberAlertPreferences({
        firstReportRegionEnabled: true,
        highSignalRegionEnabled: true,
        firstReportChannelEnabled: true,
        highSignalSourceEnabled: true,
        minimumTelegramHighSignalGrade: "B",
      }),
      null,
    );
    assert.equal(await markSubscriberAlertsRead(["a1"]), false);
    assert.equal(await markAllSubscriberAlertsRead(), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
