# App Store Connect — Screenshots

## What Apple actually requires (as of 2026)

You only have to upload **two** sizes. Apple scales them down for smaller
devices automatically.

| Display          | Required?      | Portrait px | Simulator device           |
| ---------------- | -------------- | ----------- | -------------------------- |
| 6.9" iPhone      | **Required**   | 1320 × 2868 | iPhone 17 Pro Max          |
| 6.5" iPhone      | **Required**   | 1242 × 2688 | iPhone 11 Pro Max / XS Max |
| 6.7", 6.1", 5.5" | Optional       | —           | scaled from the above      |
| iPad             | **Not needed** | —           | `supportsTablet: false`    |

Minimum 3 screenshots per size, maximum 10. Ship 5–6: more than that and the
later ones are rarely seen.

## Ready to upload — `screenshots/`

Captured 2026-09-28 from a Release build on the iPhone 17 Pro Max simulator
(iOS 26), signed in to the local demo society, so every name and number on
screen is fictional. Status bar set to 9:41, full signal and battery.
JPEG with no alpha channel (App Store Connect rejects PNGs with alpha).

| #   | File                      | Shows                                                    |
| --- | ------------------------- | -------------------------------------------------------- |
| 1   | `01-home.jpg`             | Home: Emergency SOS, quick actions, active requests      |
| 2   | `02-visitor-approval.jpg` | Guest at the gate with Approve entry / Reject            |
| 3   | `03-maintenance.jpg`      | Maintenance dues, due date, pay-at-office note, history  |
| 4   | `04-services.jpg`         | Book a plumber / carpenter / electrician; active request |
| 5   | `05-canteen.jpg`          | Today's breakfast menu with calories and veg tags        |
| 6   | `06-notices.jpg`          | Notice board                                             |

- `screenshots/6.9/` — 1320 × 2868, upload to the **6.9" Display** slot.
- `screenshots/6.5/` — 1242 × 2688, upload to the **6.5" Display** slot.
  Scaled from the 6.9" captures (the aspect ratios differ by under 0.5%; about
  5 px was trimmed from the top and bottom). Apple accepts 6.9" alone; upload
  the 6.5" set only if App Store Connect asks for it.

Upload them in the order above; the first two are what search results show.

## Retaking them

Run the API locally with `OTP_PROVIDER=local` (dev OTP is `1234`), build with
`EXPO_PUBLIC_API_URL=http://localhost:<port>/v1 expo run:ios --configuration
Release`, sign in as a seeded resident (`9100000001`), then:

```bash
xcrun simctl status_bar booted override --time "9:41" --dataNetwork wifi \
  --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100
xcrun simctl io booted screenshot 01-home.png
sips -s format jpeg -s formatOptions 95 01-home.png --out 01-home.jpg
```

The local seed's dates go stale (bills overdue, menus empty). Move the bill
due dates, canteen menu dates and notice dates to the current week first.

## Rules that get screenshots rejected

- No device frames, no drop shadows, no "Download now" badges.
- No Apple hardware imagery.
- The status bar must look real — full signal and battery is fine, a
  half-drawn one is not. `xcrun simctl status_bar` can set a clean one:
  ```bash
  xcrun simctl status_bar booted override --time "9:41" \
    --cellularBars 4 --batteryState charged --batteryLevel 100
  ```
- Content must match the live app. Screenshots of features that are not in the
  build are a Guideline 2.3.3 rejection.
- Real names/numbers in the visitor and directory screens are a privacy problem
  — use demo data.

## App Preview video

Optional. Skip it for 1.0.14; it is a separate production effort and its absence
does not affect review.
