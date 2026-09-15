# Monitor aggregate integration

The separate workbook is `Target Media — Monitor Metrics`. `Code.gs` is bound to that Sheet and deployed as a Web App. Script Properties contain `MONITOR_SPREADSHEET_ID`, `MONITOR_SERVER_TOKEN`, and `TIMEZONE`. Do not put the token in Sheets, GitHub, or browser code.

Flow: GitHub Pages dashboard → Render server-side test login/session → Monitor Apps Script → authorized Business ID/Location ID rows in the metrics workbook. The temporary login is only for development; replace it with a production identity provider and persistent server-side session storage before clients use it. The page never sends an arbitrary Business ID.

The camera/Orange Pi is not connected yet. The camera model and Device ID remain configurable. The data contract stores only aggregate intervals; no images, facial recognition, biometrics, trajectories, or persistent person IDs. `looked` and `stopped` classification rules are `v1-draft` and must be calibrated with the pilot. Demographics are off and should not be enabled merely because columns exist.

## Edge → Render payload

`POST https://target-media.onrender.com/api/monitor/ingest` with `Authorization: Bearer <device token>` and `Content-Type: application/json`. The device token is a different secret from `MONITOR_SERVER_TOKEN`. Render maps the authenticated Device ID to Business ID and Location ID from `MONITOR_DEVICE_MAP_JSON`; the device cannot choose those IDs.

```json
{
  "deviceId": "ORANGEPI-TEST-001",
  "requestId": "8acfb16a-6518-474e-a575-029ced43c2b0",
  "intervals": [
    {
      "start": "2026-09-15T10:00:00+02:00",
      "end": "2026-09-15T10:05:00+02:00",
      "passersBy": 12,
      "looked": 4,
      "stopped": 1,
      "totalLookTimeSeconds": 11.2,
      "validLookEvents": 4,
      "uptimePct": 100,
      "metricDefinitionVersion": "v1-draft",
      "ageBuckets": null,
      "genderBuckets": null
    }
  ]
}
```

Intervals are 5–60 minutes, batch size 1–48, and timestamps must be within the last 180 days (or no more than 10 minutes in the future). `requestId:index` is the idempotency key. The Sheet test dataset is synthetic hourly data and marked `SAMPLE/TEST`; when real intervals exist for that location, Apps Script excludes the synthetic rows from dashboard calculations. Age/gender fields are rejected while `demographics_enabled` is false.

For an administrator's direct Apps Script ingestion test only, `sampleData:true` marks a payload for `TM-TEST-001` / `TM-LOC-TEST-001` as `SAMPLE/TEST`. Render deliberately does not forward this flag from edge requests. Never label a camera observation as sample data.

For a production device, create a random 32-byte hex token outside the repo, SHA-256 hash it, and configure `MONITOR_DEVICE_MAP_JSON` in Render as:

```json
{"ORANGEPI-TEST-001":{"businessId":"TM-TEST-001","locationId":"TM-LOC-TEST-001","tokenHash":"<sha256-of-device-token>"}}
```

Provision the same plaintext device token only to the edge device through a secure channel. Do not reuse the Render/Apps Script server token. A multi-location installation needs a separate mapping and device credential per device.

Apps Script private JSON actions: `health`, `ingestMetrics`, `getDashboardMetrics`, `diagnostics`; all `POST` actions require `serverToken`. `GET?action=health` reveals only service/schema. The dashboard uses `7d`, `30d`, or calendar quarter, and comparisons use preceding equivalent windows. Rates and average look duration derive from sums, not rounded row averages. Strong/weak windows derive from average observed hourly traffic. Quarterly output is numeric quarter-to-date, with no invented narrative.
