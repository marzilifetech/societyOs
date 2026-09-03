# App Store Connect — Screenshots

## What Apple actually requires (as of 2026)
You only have to upload **two** sizes. Apple scales them down for smaller
devices automatically.

| Display | Required? | Portrait px | Simulator device |
|---|---|---|---|
| 6.9" iPhone | **Required** | 1320 × 2868 | iPhone 17 Pro Max |
| 6.5" iPhone | **Required** | 1242 × 2688 | iPhone 11 Pro Max / XS Max |
| 6.7", 6.1", 5.5" | Optional | — | scaled from the above |
| iPad | **Not needed** | — | `supportsTablet: false` |

Minimum 3 screenshots per size, maximum 10. Ship 5–6: more than that and the
later ones are rarely seen.

## The six screens to capture, in order
Order matters — the first two are all most people see in search results.

1. **Home** — the dashboard, showing the resident's flat and quick actions.
2. **Visitor approval** — a pending entry with Approve / Deny. This is the
   feature that sells the app; lead with it after Home.
3. **Maintenance bill** — the bill with its breakdown and Pay action.
4. **Service request** — an open request with its status timeline.
5. **Canteen menu** — a meal with dishes, showing daily usefulness.
6. **Notices / Community** — proves it is more than a gate app.

## Capturing them
The app must have realistic data on screen — an empty state makes a poor
screenshot and Apple rejects placeholder/lorem content. Sign the simulator in
to the demo society first, then:

```bash
# 6.9" — iPhone 17 Pro Max
xcrun simctl boot "iPhone 17 Pro Max"
xcrun simctl io booted screenshot ~/Desktop/appstore/6.9/01-home.png

# 6.5" — iPhone 11 Pro Max (add the runtime in Xcode if absent)
xcrun simctl boot "iPhone 11 Pro Max"
xcrun simctl io booted screenshot ~/Desktop/appstore/6.5/01-home.png
```

Verify the pixel size of every file before uploading — App Store Connect
rejects anything off by even one pixel:

```bash
sips -g pixelWidth -g pixelHeight ~/Desktop/appstore/6.9/*.png
```

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
