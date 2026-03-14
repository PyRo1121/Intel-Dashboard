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
        return new Response(JSON.stringify({
          unreadCount: 2,
          items: [],
          degraded: {
            materializationFailed: true,
            message: "Alert refresh failed. Showing the latest available inbox snapshot.",
          },
        }), {
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
    assert.equal(alerts.ok, true);
    if (alerts.ok) {
      assert.equal(alerts.data.unreadCount, 2);
      assert.equal(alerts.data.degraded?.materializationFailed, true);
    }
    const preferences = await fetchSubscriberAlertPreferences();
    assert.equal(preferences.ok, true);
    if (preferences.ok) {
      assert.equal(preferences.data.minimumTelegramHighSignalGrade, "B");
    }
    assert.equal(
      (await saveSubscriberAlertPreferences({
        firstReportRegionEnabled: true,
        highSignalRegionEnabled: false,
        firstReportChannelEnabled: true,
        highSignalSourceEnabled: true,
        minimumTelegramHighSignalGrade: "A",
      })).ok,
      true,
    );
    const saved = await saveSubscriberAlertPreferences({
      firstReportRegionEnabled: true,
      highSignalRegionEnabled: false,
      firstReportChannelEnabled: true,
      highSignalSourceEnabled: true,
      minimumTelegramHighSignalGrade: "A",
    });
    assert.equal(saved.ok, true);
    if (saved.ok) {
      assert.equal(saved.data.minimumTelegramHighSignalGrade,
      "B",
      );
    }
    assert.equal((await markSubscriberAlertsRead(["a1"])).ok, true);
    assert.equal((await markAllSubscriberAlertsRead()).ok, true);

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    const failedAlerts = await fetchSubscriberAlerts("all");
    assert.deepEqual(failedAlerts, { ok: false, error: "forbidden", status: 403 });
    const failedPreferences = await fetchSubscriberAlertPreferences();
    assert.deepEqual(failedPreferences, { ok: false, error: "forbidden", status: 403 });
    const failedSave = await saveSubscriberAlertPreferences({
      firstReportRegionEnabled: true,
      highSignalRegionEnabled: true,
      firstReportChannelEnabled: true,
      highSignalSourceEnabled: true,
      minimumTelegramHighSignalGrade: "B",
    });
    assert.deepEqual(failedSave, { ok: false, error: "forbidden", status: 403 });
    assert.deepEqual(await markSubscriberAlertsRead(["a1"]), { ok: false, error: "forbidden", status: 403 });
    assert.deepEqual(await markAllSubscriberAlertsRead(), { ok: false, error: "forbidden", status: 403 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
