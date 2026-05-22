# SocietyOS — Full Design Prompt
## For: AI Design Tools, Figma, v0, Implementation Engineers

---

## 1. PRODUCT IDENTITY

**Product Name:** SocietyOS  
**Brand Name (app-facing):** Marzi  
**Tagline:** Your community, simplified.  
**Personality:** Calm authority. Like a trusted building manager — reliable, clear, never loud. Zero ads, zero clutter.  
**Inspiration references:** Linear (clarity), Zepto (Indian mobile UX speed), Notion (information hierarchy), Apple Health (data presentation).

---

## 2. DESIGN SYSTEM — GLOBAL TOKENS

### 2.1 Color System

```
PRIMARY PALETTE
  Primary-900   #1e2275   (dark press states)
  Primary-700   #2d31a6   (hover states)
  Primary-500   #3B3FBF   (default primary — buttons, links, active nav)
  Primary-300   #818cf8   (secondary UI, light borders)
  Primary-100   #e0e7ff   (tinted backgrounds, badges)
  Primary-50    #eef2ff   (subtle highlights)

NEUTRAL PALETTE (Slate-based)
  Neutral-950   #0f172a   (never use as bg, use for high-contrast text only)
  Neutral-900   #1e293b   (headings)
  Neutral-700   #334155   (body text)
  Neutral-500   #64748b   (secondary text, labels)
  Neutral-400   #94a3b8   (placeholder text)
  Neutral-300   #cbd5e1   (borders, dividers)
  Neutral-200   #e2e8f0   (input borders idle)
  Neutral-100   #f1f5f9   (page background)
  Neutral-50    #f8fafc   (surface/card background, very light)
  White         #ffffff   (card surface)

SEMANTIC COLORS
  Success-500   #22c55e   (Completed, Resolved, Approved)
  Success-100   #dcfce7   (success badge background)
  Success-700   #15803d   (success badge text)

  Warning-500   #f59e0b   (In Progress, Pending, Due Soon)
  Warning-100   #fef3c7   (warning badge background)
  Warning-700   #b45309   (warning badge text)

  Error-500     #ef4444   (Rejected, Overdue, SOS, Urgent)
  Error-100     #fee2e2   (error badge background)
  Error-700     #b91c1c   (error badge text)

  Info-500      #3b82f6   (Requested, Assigned, Info)
  Info-100      #dbeafe   (info badge background)
  Info-700      #1d4ed8   (info badge text)

SOS RED (special — more vivid than Error)
  SOS           #dc2626   (SOS button fill)
  SOS-hover     #b91c1c
  SOS-glow      rgba(220,38,38,0.25)

GRADIENT (use sparingly — hero sections, onboarding only)
  Primary gradient: linear-gradient(135deg, #2d31a6 0%, #4f46e5 50%, #7c3aed 100%)
```

### 2.2 Typography

```
FONT FAMILIES
  Display / Heading:  "Inter", "Noto Sans" (fallback for Indic scripts)
  Body:               "Inter", "Noto Sans"
  Monospace:          "JetBrains Mono" (receipt amounts, IDs only)

SCALE (Mobile — Resident & Staff)
  Display-2xl   32px / 40px lh / Bold     (SOS screen title)
  Display-xl    28px / 36px lh / Bold     (onboarding headers)
  Display-lg    24px / 32px lh / SemiBold (section page titles)
  Heading-md    20px / 28px lh / SemiBold (card headers, modal titles)
  Heading-sm    17px / 24px lh / SemiBold (list item headings)
  Body-lg       16px / 24px lh / Regular  (primary body — Resident app)
  Body-md       14px / 20px lh / Regular  (secondary body, labels)
  Body-sm       12px / 16px lh / Regular  (captions, timestamps, metadata)
  Label         11px / 16px lh / Medium   (all-caps status badges, tab labels)

STAFF APP OVERRIDES (larger for ease of use)
  Body-lg       18px / 28px lh / Regular
  Body-md       16px / 24px lh / Regular
  Body-sm       14px / 20px lh / Regular
  Touch targets: minimum 56dp (vs 48dp for Resident)

SCALE (Web Admin Portal)
  Display-xl    36px / 44px lh / Bold
  Heading-lg    24px / 32px lh / SemiBold
  Heading-md    20px / 28px lh / SemiBold
  Heading-sm    16px / 24px lh / SemiBold
  Body-lg       15px / 22px lh / Regular
  Body-md       14px / 20px lh / Regular
  Body-sm       12px / 16px lh / Regular
  Table-cell    14px / 20px lh / Regular
  Table-header  12px / 16px lh / SemiBold + uppercase + letter-spacing 0.05em
```

### 2.3 Spacing & Grid

```
BASE UNIT: 4px

SPACING SCALE
  2    8px    (tight label gaps, icon-to-text)
  3    12px   (within-component padding)
  4    16px   (standard component padding, list item vertical padding)
  5    20px   (card internal padding)
  6    24px   (section gaps)
  8    32px   (section top padding)
  10   40px   (large section breaks)
  12   48px   (page top padding on mobile)
  16   64px   (bottom padding above tab bar)

MOBILE LAYOUT
  Screen horizontal padding:  16px (left + right)
  Card internal padding:       20px all sides
  Section gap (between cards): 12px
  Section header margin-top:   24px
  Bottom tab bar height:       83px (includes home indicator area)
  Safe area top:               respect StatusBar height

ADMIN WEB LAYOUT
  Sidebar width:               240px (collapsed: 64px)
  Content area max-width:      1280px, centered
  Content padding:             24px top, 32px sides
  Table row height:            52px
  Card padding:                24px
  Grid gap:                    16px
```

### 2.4 Border Radius

```
None       0px   (dividers, full-width elements)
XS         4px   (chips inside forms, inline code)
SM         8px   (buttons, input fields, small cards)
MD         12px  (standard cards, modals)
LG         16px  (bottom sheets, large modals)
XL         24px  (feature cards, hero cards)
Full       9999px (avatar, pill badge, toggle)
```

### 2.5 Shadows / Elevation

```
Level 0    none                                (flat, on-page elements)
Level 1    0 1px 3px rgba(0,0,0,0.06),        (cards on white bg)
           0 1px 2px rgba(0,0,0,0.04)
Level 2    0 4px 6px rgba(0,0,0,0.05),        (dropdowns, hover cards)
           0 2px 4px rgba(0,0,0,0.04)
Level 3    0 10px 15px rgba(0,0,0,0.07),      (modals, bottom sheets)
           0 4px 6px rgba(0,0,0,0.05)
Level 4    0 20px 25px rgba(0,0,0,0.09),      (full-screen overlays)
           0 8px 10px rgba(0,0,0,0.04)
SOS Glow   0 0 0 4px rgba(220,38,38,0.2),     (SOS button pulse ring)
           0 8px 24px rgba(220,38,38,0.4)
```

### 2.6 Iconography

```
Library:      Lucide Icons (outlined, consistent stroke width 1.5)
Sizes:
  16dp — metadata, inline text icons
  20dp — form field icons, compact list items
  24dp — standard UI icons (nav, actions)
  32dp — empty state illustration icons
  48dp — feature illustrations, large states

Active nav tab:  filled variant of icon + Primary-500 color
Inactive nav:    outlined variant + Neutral-400 color
```

### 2.7 Component Library — Core

**Buttons**
```
Primary Button
  bg: Primary-500 | text: White | height: 52px | radius: SM (8px)
  padding: 0 24px | font: Body-lg SemiBold
  hover: Primary-700 | pressed: Primary-900 | disabled: Neutral-300 bg + Neutral-400 text
  loading state: spinner replaces label, same width (no layout shift)
  full-width on mobile (most CTAs)

Secondary Button
  bg: Primary-50 | text: Primary-500 | border: 1.5px Primary-300 | same sizing

Destructive Button
  bg: Error-100 | text: Error-700 | hover bg: Error-500, text White

Ghost / Text Button
  bg: transparent | text: Primary-500 | underline on hover
  use for: Cancel, Skip, secondary actions

Icon Button
  44x44dp tappable area (visual 32x32dp) | radius: Full
  variants: primary (indigo bg), ghost (transparent), danger (red)
```

**Input Fields**
```
Text Input
  height: 52px | border: 1.5px Neutral-200 | radius: SM (8px)
  padding: 0 16px | bg: White
  label: Body-sm SemiBold Neutral-700, positioned above (never placeholder-as-label)
  placeholder: Neutral-400
  focus: border Primary-500, subtle Primary-50 bg tint, Level-1 shadow
  error: border Error-500, error message below in Error-700 Body-sm
  success: border Success-500, checkmark icon trailing
  with leading icon: icon 20dp Neutral-400, 12px gap to text

Textarea
  min-height: 100px | padding: 16px | same border/radius as text input
  Character counter bottom-right when near limit

OTP Input
  6 individual boxes | each: 52x56dp | border: 1.5px Neutral-200 | radius: SM
  active box: border Primary-500 + Level-1 shadow
  filled: bg Neutral-50, text Neutral-900 bold
  error state: all boxes border Error-500 + shake animation

Phone Input
  Country code prefix (+91 in flag chip) | separator divider | number field
  Flag: 24dp emoji | code: Body-lg Neutral-700

Date Picker
  Use native bottom sheet calendar style (iOS) / dialog (Android)
  Selected date: Primary-500 circle fill, White text
  Today: underlined with Primary-500 dot below

Time Slot Picker
  Horizontal scroll of pill chips
  Available: border Neutral-200, Neutral-700 text
  Selected: bg Primary-500, White text
  Unavailable: bg Neutral-100, Neutral-400 text, strikethrough
```

**Cards**
```
Standard Card
  bg: White | radius: MD (12px) | shadow: Level-1
  padding: 20px | margin-bottom: 12px

Interactive Card (tappable)
  same as Standard + pressed state: bg Neutral-50, slight scale(0.98)
  right chevron icon (16dp Neutral-400) to indicate navigability

Feature Card (hero)
  bg: gradient (Primary gradient) | text: White | radius: XL (24px) | padding: 24px
  use for: SOS, highlighted payment due, important alerts

Status Card
  left border accent: 4px solid [status color] | rest same as Standard Card
  header row: [Icon] [Title] on left, [StatusBadge] on right

Info Strip / Banner
  full-width | height: 48px | padding: 0 16px
  bg: [semantic-100] | text: [semantic-700] | left icon 20dp [semantic-500]
  dismiss X button right side
  use for: payment reminders, offline mode notice, pending approval notice
```

**Badges / Status Pills**
```
Format: bg [semantic-100], text [semantic-700], Body-sm Medium, radius Full
padding: 4px 10px | icon (12dp) + label, 4px gap

Status mappings:
  Requested / Pending    → Info-100 bg / Info-700 text
  Assigned              → purple-100 / purple-700
  In Progress           → Warning-100 / Warning-700
  Completed / Resolved  → Success-100 / Success-700
  Rejected / Overdue    → Error-100 / Error-700
  Closed / Inactive     → Neutral-100 / Neutral-500
  Approved              → Success (same as Completed)
  Under Review          → Info (same as Pending)
```

**List Items**
```
Standard List Item (tappable row)
  height: 64px (56px Staff app) | padding: 0 16px
  left: avatar/icon (40dp circle) | center: [title Body-Heading-sm] over [subtitle Body-md Neutral-500]
  right: timestamp Body-sm Neutral-400 + chevron OR action icon
  divider: 1px Neutral-100 at bottom (except last item)
  pressed: bg Neutral-50

Two-line List Item
  height: 72px | same structure with 2 subtitle lines max

Avatar
  40dp circle | bg: [color based on name initial] from a fixed 8-color palette
  initials: Body-md White Bold | or photo (object-fit cover, circle clip)
  Sizes: 32dp (compact), 40dp (list), 48dp (detail), 80dp (profile)
```

**Progress / Stepper**
```
Status Stepper (horizontal, 4-5 steps)
  Each step: circle (20dp) + label below (Body-sm) + connecting line
  Completed step: filled Primary-500 circle + checkmark icon
  Current step: ring Primary-500 (2px stroke) + pulsing dot inside
  Future step: Neutral-200 circle + Neutral-400 text
  Connecting line: solid Primary-500 (done), dashed Neutral-200 (future)
  Use in: service requests, complaints, travel pause

Star Rating Input
  5 stars, 32dp each, 8dp gap
  Empty: Neutral-200 | Filled: amber #f59e0b | Half: half-fill
  Tap-to-select with micro-bounce animation

Progress Bar
  height: 6px | radius: Full | bg Neutral-200
  fill: Primary-500 (linear gradient: Primary-500 → Primary-300 from left)
  use for: payment summary, event capacity
```

**Bottom Sheet**
```
Handle bar: 4px x 36px Neutral-300 radius-full, centered 12px from top
Drag dismiss: swipe down to 40% of screen height → dismiss
Content padding: 24px
Header: Heading-md + optional close X top-right
Max height: 85% screen height | Scrollable content inside
Overlay: rgba(0,0,0,0.4) blur(2px)
Spring animation: overshoot 4px on open, smooth on dismiss
```

**Empty States**
```
Layout: centered column, icon (48dp outlined Neutral-300) + title (Heading-md Neutral-700) +
        body (Body-md Neutral-500, max 2 lines) + optional CTA button
Vertical position: 30% from top of content area (not true center — looks high)
Background: page bg (no card wrapper)
Icons: specific to context (no generic empty boxes)
  No visitors: door icon
  No complaints: shield-check icon
  No tasks: clipboard icon
  No payments: receipt icon
  No events: calendar icon
  No messages: message-circle icon
```

**Skeleton Loaders**
```
Use instead of spinners for content areas
Color: Neutral-200 base, Neutral-100 shimmer
Shimmer animation: left-to-right, 1.5s loop
Match exact shape of content: text lines (variable width, 12px height), avatars (circle), cards (full width, match expected height)
Show max 3 skeleton items (don't fill entire screen)
```

**Toasts / Snackbars**
```
Position: bottom, 16px above tab bar, 16px horizontal margin
Min-width: full width minus margins | max-height: 56px
Radius: MD | shadow: Level-3
bg: Neutral-900 | text: White | auto-dismiss: 3s
Success variant: bg Success-500
Error variant: bg Error-500 | includes "Retry" action link
Action text: Primary-300 (light indigo on dark bg)
Slide up on show, fade + slide down on dismiss
```

### 2.8 Motion & Animation

```
Standard transitions:
  Page navigation:   slide-left (forward) / slide-right (back) — 280ms ease-out
  Modal open:        slide-up from bottom — 320ms spring(damping: 28, stiffness: 350)
  Modal dismiss:     slide-down — 250ms ease-in
  Tab switch:        crossfade — 200ms ease

Micro-interactions:
  Button press:      scale(0.97) 80ms → scale(1) 120ms spring
  Card press:        scale(0.98) 80ms → scale(1) 150ms spring
  Star rating:       each star scale-bounce on select (stagger 40ms)
  Checkmark:         draw animation (stroke-dashoffset) 400ms ease-out
  Success screen:    checkmark draw → scale-in card → fade-in text (staggered)

SOS specific:
  SOS button idle:   subtle pulsing ring glow (scale 1→1.15→1, 2s infinite)
  SOS countdown:     circular progress ring depleting, 5s
  SOS activated:     flash red full-screen → fade to SOS status screen

Loading states:
  Skeleton shimmer:  1.5s loop, ease-in-out
  Pull to refresh:   rubber-band physics, standard platform behavior
  Infinite scroll:   bottom spinner (24dp) — appears 200px before end

Number animations:
  Dashboard stats:   count-up animation on mount, 800ms ease-out
  Payment amount:    no animation (clarity over flair for money)
```

### 2.9 Illustration Style

```
Use for: Empty states, onboarding screens, success/error states, Pending Approval
Style: Flat illustration, geometric, 2-3 colors from palette
Primary colors: Primary-100, Primary-300, Neutral-200, accent Amber for highlights
No photorealistic imagery. No stock photos.
Size: 140-180dp on mobile, centered
Line art alternative: 48dp outlined icon in Neutral-300 (simpler, loads instantly)
```

---

## 3. APP 1 — RESIDENT MOBILE APP

**Navigation:** Bottom Tab Bar (5 tabs)
```
Tab 1: Home        — home icon
Tab 2: Visitors    — users icon
Tab 3: Services    — tool icon (wrench + screwdriver)
Tab 4: Community   — message-circle icon
Tab 5: Account     — user-circle icon

Tab bar: bg White, top border 1px Neutral-100, shadow Level-2 (upward)
Active tab: icon filled Primary-500 + label Primary-500 Body-sm Medium
Inactive tab: icon outlined Neutral-400 + label Neutral-400 Body-sm Regular
Tab bar height: 83px (content 49px + 34px home indicator area)
Notification badge: red circle (8dp dot for unread / count badge for >1)
```

---

### AUTH & ONBOARDING

---

**R-01: Splash Screen**
```
Full screen bg: Primary-500 (deep indigo)
Center: "Marzi" wordmark — Inter 700, 36px, White + tagline "Your community, simplified." Body-lg White/70 below
Logo animation: fade-in 400ms + subtle scale 0.9→1 spring
Duration: 1.8s → auto-navigate to R-02 or Home (if token valid)
Bottom: "Powered by SocietyOS" Body-sm White/40 (16px from bottom safe area)
```

**R-02: Welcome / Society Selection**
```
LAYOUT: Full-page scroll. No tab bar. Back button top-left (hidden on first screen).

Top section (non-scroll):
  Padding-top: 60px
  Marzi wordmark (smaller, 24px) + tagline

Search bar:
  Margin-top: 32px
  Full-width | height: 52px | leading search icon (Primary-500) | placeholder "Search your society..."
  Radius: SM | border: 1.5px Neutral-200

Results section (appears after 1+ char):
  Grouped by City (section header: Body-sm SemiBold Neutral-500 uppercase)
  Each society card: 
    height: 64px | padding: 0 16px
    Left: 40dp square logo/initial avatar (Primary-100 bg, Primary-500 initial)
    Center: society name (Heading-sm) | address (Body-md Neutral-500)
    Right: chevron

Empty/default state:
  3 sample society cards with "Loading..." skeleton
  Below: "Don't see your society?" link → "Register your society" form (separate flow)

Bottom CTA strip (fixed, above keyboard):
  "Is your society not listed?" text + "Contact Us" ghost button
```

**R-03: Phone Number Entry**
```
LAYOUT: Single-focus screen. Progress dots top (1 of 4 active).

Illustration: 120dp — simple flat art of a phone with signal waves (indigo + amber)
Margin-top from illustration: 32px

Heading: "Enter your mobile number" (Display-xl, Neutral-900)
Subtext: "We'll send a 6-digit verification code." (Body-lg Neutral-500) 12px below

Phone input:
  Margin-top: 32px
  Country code chip: flag emoji + "+91" + dropdown chevron | 1.5px right divider
  Number field: full flex-1 | numeric keyboard
  Full component height: 56px

Privacy note: margin-top 16px
  lock icon (16dp Neutral-400) + "No spam. No ads. Ever." Body-sm Neutral-400
  
CTA: "Send OTP" Primary Button full-width | fixed 16px above keyboard
```

**R-04: OTP Verification**
```
LAYOUT: Same progress dots (2 of 4).

Header: back arrow top-left (goes to R-03, pre-fills phone)
Heading: "Enter verification code" Display-xl
Subtext: "Sent to +91 98765 43210  ✏️ change" — tap pencil navigates back

OTP boxes:
  Margin-top: 40px
  6 boxes, horizontal, 8dp gap, each 48x56dp
  Auto-focus first box | auto-advance on input | paste detection fills all
  Error state: all boxes border Error-500 + shake (translateX ±8px, 4 cycles, 300ms) + "Incorrect code. Try again." Error message below

Resend:
  60s countdown: "Resend OTP in 0:42" Body-md Neutral-500
  After expiry: "Resend OTP" link (Primary-500, underlined)

Auto-verify: detects OTP from SMS (on Android via SMS Retriever API)

Loading: spinner overlays boxes, boxes opacity 0.5
```

**R-05: Flat Verification**
```
LAYOUT: Progress dots (3 of 4).

Heading: "Which flat is yours?" Display-xl
Subtext: "Admin will verify your details before you get access." Body-lg Neutral-500

Form (vertical stack, 16px gaps):
  Block / Building dropdown:
    Custom picker bottom sheet — scrollable list of blocks (A, B, C... or "Tower 1" etc.)
    Selected shows block name with building icon leading

  Floor selector:
    Segmented or number stepper if < 10 floors | dropdown if more

  Flat / Unit number:
    Text input | numeric keyboard | placeholder "e.g. 304"

  Owner / Tenant toggle:
    Two pills side-by-side | selected: Primary-500 bg White text | unselected: Neutral-100 bg Neutral-500 text
    Width: 50% each

Primary Button: "Submit for Approval" — fixed bottom

Below button: "Wrong society?" text link → back to R-02
```

**R-06: Profile Setup**
```
LAYOUT: Progress dots (4 of 4).

Heading: "Set up your profile" Display-xl
Subtext: "This is how your neighbours will see you." Body-lg Neutral-500

Avatar section:
  80dp avatar circle | default: initials from name | "Edit" chip overlay bottom-right
  Tap: bottom sheet with "Camera" and "Gallery" options

Form (16px gaps):
  Full name — text input (required)
  Email address — email input (optional) + "(optional)" label suffix
  
Biometric toggle row:
  Left: fingerprint icon (24dp) + "Enable Face ID / Fingerprint Login" Heading-sm
  Right: toggle switch (Primary-500 when on)
  Subtext below: Body-sm Neutral-500 "Skip anytime in Settings"

Consent checkbox:
  Standard checkbox + "I agree to the Terms of Service and Privacy Policy" Body-md
  Links underlined Primary-500

CTA: "Complete Setup" Primary Button full-width fixed bottom
```

**R-07: Pending Approval**
```
LAYOUT: Centered content. No back navigation possible (pending state).

Illustration: 160dp — flat art: person standing at a gate, security guard with checklist, indigo + amber palette
Margin-top: 48px from top safe area

Title: "You're on the list" Display-xl (or "Almost there!")
Body: "Your request has been sent to [Society Name] admin. We'll notify you once approved. This usually takes a few hours." Body-lg Neutral-500 center-aligned max-width 300px

Info card (Status Card style):
  Left border: Warning-500
  "Flat [Block] [Number] • [Owner/Tenant]" Heading-sm
  "Verification Pending" Warning badge

Push notification prompt (if not yet granted):
  Margin-top: 32px
  "Get notified when approved" card with bell icon + "Allow Notifications" Primary Button

Bottom: "Wrong details? Start over" ghost/text button (Error-700 color)
```

---

### HOME

**R-08: Home Dashboard**
```
LAYOUT: ScrollView. Header fixed (not sticky). Tab bar fixed bottom.

HEADER (fixed, bg White, bottom border 1px Neutral-100):
  Height: 56px | padding: 0 16px
  Left: "Good morning, [Name]" Body-md Neutral-500 + below "Flat A-304" Body-sm Neutral-400
       (or time-based: Good morning / afternoon / evening)
  Right: Notification bell (24dp icon) + unread dot badge

ABOVE FOLD (visible without scroll):

  SOS Button — Feature Card style:
    Full-width | height: 80px | bg: linear-gradient(135deg, #dc2626, #b91c1c)
    Radius: XL (24px) | margin: 16px horizontal
    Left: "Medical Emergency" Body-md White/90 + "Tap and hold for SOS" Body-sm White/60
    Right: large red circle button (64dp) with heartbeat icon (white, 28dp) + pulsing ring animation
    Tap to navigate to SOS flow | Long-press also works

  Pending Actions Banner (conditional — shows if dues overdue / complaint pending response):
    Info Strip style | bg Warning-100 | amber left border
    "Maintenance dues of ₹3,200 are overdue" | "Pay Now →" link right

  Quick Actions:
    Label: "Quick Actions" Body-md SemiBold Neutral-500 uppercase letter-spacing
    2x3 grid | each cell: 100% ÷ 3 width | aspect ~1:1
    Each action card:
      bg White | radius MD | shadow Level-1 | padding: 16px
      Icon: 32dp [action-specific color] circle bg (Primary-50/Success-50 etc) + icon inside
      Label: Body-sm SemiBold Neutral-700 below, center-aligned
    Actions: Visitor Pass (indigo), Pay Dues (green), Raise Complaint (orange),
             Book Service (blue), Canteen Menu (amber), Book Appointment (purple)

  Activity Feed:
    Label: "Recent Activity" Body-md SemiBold Neutral-500 uppercase
    Stack of list items (Standard List Item style):
      Icon left (service type / visitor / complaint — color-coded 40dp circle)
      Title + subtitle + relative timestamp (Body-sm Neutral-400)
      Unread: White bg + thin left border Primary-300 or bold title
    "View All" text link right-aligned below last item
    Max 5 items shown | rest in Notification Center

STATE HANDLING:
  Loading: skeleton for quick actions grid (3 boxes) + 3 skeleton list items
  Empty (new user): welcome card with "Get started" checklist (add visitor, pay dues...)
  Offline: top banner "You're offline — showing cached data" Info strip Neutral bg
```

**R-09: Notification Center**
```
LAYOUT: Full-page list. Nav bar with "Notifications" heading + "Mark all read" text button right.

Group headers: "Today", "Yesterday", "This Week", "Earlier"
  Header: Body-sm SemiBold Neutral-500 uppercase | bg Neutral-50 | full-width | padding: 8px 16px

Notification item (list item style):
  Height: auto (72px min) | padding: 12px 16px
  Left: 40dp icon circle (bg varies by type, see below) + icon 20dp White
  Center: title (Heading-sm, bold if unread) + body (Body-md Neutral-500, 2-line clamp)
  Right: relative time (Body-sm Neutral-400) + unread dot (8dp Primary-500) if unread
  Pressed: bg Neutral-50

Notification type → icon circle color:
  Visitor arrival:   Primary-100 bg + users icon Primary-500
  Payment reminder:  Warning-100 bg + credit-card icon Warning-500
  Complaint update:  Info-100 bg + alert-circle icon Info-500
  SOS ack:           Error-100 bg + heart icon Error-500
  Event reminder:    Success-100 bg + calendar icon Success-500
  Society notice:    Neutral-100 bg + megaphone icon Neutral-500
  Canteen update:    amber-100 bg + utensils icon amber-500

Empty state: bell icon (48dp Neutral-300) + "You're all caught up" + "No new notifications"
Swipe-left to dismiss individual notification
```

---

### VISITORS & GATE MANAGEMENT

**R-10: Visitors Home**
```
LAYOUT: Tab screen. Header "Visitors" Display-lg. Segmented tabs below header.

Tabs: "Active" | "Scheduled" | "History"
  Tab bar: below header | pill style | bg Neutral-100 | selected: White bg + shadow Level-1

FAB: "+" button bottom-right | 56dp circle | bg Primary-500 | icon White | shadow Level-3
     Label "New Pass" to left of FAB | tap → R-11

ACTIVE TAB:
  Live visitor log — real-time updates via WebSocket
  Top: "Gate status" strip — "Main Gate: Open" Success-100 banner
  List of current visitors inside society (still checked in)
  Each card (Status Card with left Success border):
    Visitor name, visiting flat | "Checked in at 2:30 PM" | duration "1h 20m ago"

SCHEDULED TAB:
  Upcoming approved visitors, sorted by date
  Each card: visitor name, date/time, flat | QR chip button right (tap → R-12)
  Past-due scheduled (not yet arrived): Warning border + "Not yet arrived" warning

HISTORY TAB:
  Paginated list (infinite scroll) | Group by date
  Each: name, date, duration, entry method (QR / OTP / Manual)
  Filter FAB: filter by date range or visitor type
```

**R-11: Pre-Approve Visitor (Form)**
```
LAYOUT: Bottom sheet (full height, scrollable). Handle bar at top. "Pre-Approve Visitor" heading.

FORM:
  Visitor's name — text input (required)
  Phone number — phone input (optional, helps guard contact)
  
  Visit type toggle:
    "One-time" | "Recurring"
    (Recurring shows: day-of-week multi-select checkboxes)

  Expected date — date picker | default: today
  Visit window — time range picker (From: To:) | 2 time pickers side by side

  Note for guard — textarea (optional) | placeholder "e.g. Delivering a package"

  "Generate Visitor Pass" Primary Button full-width | margin-top: 24px

On success: brief success toast + auto-opens R-12 (the QR pass)
```

**R-12: Visitor Pass / QR Code**
```
LAYOUT: Full screen. Close X top-right (dismiss). Share icon top-right.

TOP SECTION (bg Primary-500, rounded bottom XL):
  Padding: 32px 24px
  "Visitor Pass" label Body-sm White/60 uppercase letter-spacing
  Visitor name Display-xl White
  "Visiting [Flat Block-Number]" Body-lg White/80
  Valid period: "Today, 3 PM – 7 PM" Body-md White/70

QR CODE (center, white card):
  QR code 220x220dp | radius MD | bg White | shadow Level-2
  Padding: 24px around QR | Society logo watermark bottom-center of QR (20dp)

BELOW QR:
  "Show this QR at the gate" Body-md Neutral-500 center
  
ACTIONS ROW:
  Share (WhatsApp icon + label) | Copy Link | Download
  Each: ghost button style | icons 20dp | 3 columns

BOTTOM:
  "Revoke Access" text button (Error-700) | confirmation modal on tap:
    "Revoke visitor pass for [Name]?" → "Revoke" (Error button) / "Cancel"
```

**R-13: Visitor Arrival Notification (Fullscreen)**
```
LAYOUT: Appears as fullscreen overlay when visitor arrives (even from background via push).
  Triggered by WebSocket + FCM push notification.

BG: rgba(0,0,0,0.85) blur(8px)

Center card (radius XL, White bg, padding 32px, shadow Level-4):
  Top: "Someone's at the gate" Body-sm Neutral-500 uppercase
  
  Visitor photo / avatar: 80dp circle | center
  Name: Display-xl margin-top: 12px
  "Requesting entry to [Flat A-304]" Body-lg Neutral-500
  
  Gate info: "Main Gate • Just now" Body-sm Neutral-400 | gate icon leading
  
  Guard name: "Guard: Ramesh Kumar" Body-md Neutral-500 (if available)

ACTIONS:
  "Allow Entry" button: Success-500 bg White text | full-width | height: 56px
  "Deny Entry" button: Error-100 bg Error-700 text | full-width | height: 52px
  8px gap between

TIMER:
  "Auto-dismissing in 28s" Body-sm Neutral-400 center below buttons
  Thin progress bar (Success-500) depleting under card

On tap "Allow": checkmark animation on card → fades out → success toast
On tap "Deny": entry denied → guard receives "Denied" notification
```

**R-14: Delivery Management**
```
LAYOUT: Full screen. Header "Deliveries". Two sections.

EXPECTED DELIVERIES (section at top):
  Subheader: "Expected"
  Cards per delivery:
    Package icon (amber 40dp circle) | Courier name + tracking (if added) | Expected date/time chip
    "Arrived" chip if confirmed | "Mark as Received" action on arrived

MISSED DELIVERIES (conditional section):
  Subheader: "Missed" | warning banner if any
  "Left at gate on [time] — collect before [time]" cards

"Add Expected Delivery" FAB bottom-right:
  Bottom sheet form:
    Courier selector: grid of courier logos (Amazon, Flipkart, Swiggy, Zomato, other)
    Tracking ID (optional)
    Expected date (date picker)
    Note (optional)
    "Save" Primary Button
```

**R-15: Cab / Vehicle Pre-Approval**
```
LAYOUT: Bottom sheet form. "Cab / Vehicle Pass" heading.

Vehicle type selector (horizontal scroll, icon chips):
  App Cab (car icon) | Personal Car | Bike | Auto | Truck / Moving vehicle
  Each: 80x80dp card | icon 32dp | label below | tap to select (Primary-500 border + bg Primary-50)

FORM below selector:
  Vehicle registration number — text input | "DL 01 AB 1234" placeholder
  Driver name (optional) — text input
  Valid from — date + time picker
  Valid until — date + time picker

"Generate Gate Pass" Primary Button

Optional: "Share with Driver" row at bottom of success state:
  WhatsApp icon + "Send pass to driver on WhatsApp" Body-md | arrow icon right
```

**R-16: Domestic Help & Frequent Visitors**
```
LAYOUT: Full screen. "Frequent Visitors" header. FAB "Add New".

FILTERS (horizontal chips below header):
  All | Maid | Cook | Driver | Nurse | Security | Other

LIST: each card (Standard Card):
  Left: 48dp avatar (photo or initials) with status dot (green: approved, yellow: pending)
  Center: Name (Heading-sm) | Category chip | "Daily" or "Mon, Wed, Fri" schedule tag
  Right: Enable/disable toggle (Primary-500 on) | chevron to detail

"Add Frequent Visitor" bottom sheet:
  Photo upload (camera/gallery) — avatar style picker
  Name, phone number
  Category selector (same chips as filter)
  Visit schedule: day-of-week checkbox grid (M T W T F S S)
  "Save & Send for Approval" Primary Button
  Note: "Admin will approve this visitor" body-sm neutral-500

Detail screen per visitor:
  Large avatar top | name | category | schedule
  "Approval history" section: dates approved/denied
  Edit button | "Remove" destructive button bottom
```

---

### SOCIETY NOTICES & COMMUNICATION

**R-20 to R-28: Community Hub**
```
LAYOUT: Tab screen. "Community" header. 4 tabs.

TAB BAR (pills style, horizontally scrollable if needed):
  Notices | Polls | Forum | Messages

--- NOTICES TAB ---

R-21: Notices List
  Pinned section (if any): pin icon badge on card top-right
  Each notice card (Status Card style):
    Category badge (pill): Maintenance / Finance / Events / General / Emergency
    Category colors:
      Maintenance: Warning | Finance: Info | Events: Success | General: Neutral | Emergency: Error
    Title: Heading-sm | Posted: "Admin • 2 hours ago" Body-sm Neutral-400
    Snippet: 2-line clamp Body-md Neutral-500
    Attachment indicator if any: paperclip icon + "1 attachment" Body-sm

R-22: Notice Detail
  Header: back arrow + "Notice" + share icon
  Category badge + Posted date
  Title: Display-lg Neutral-900
  Author: avatar (40dp) + "Posted by Society Admin" Body-md Neutral-500 + timestamp
  Divider 1px Neutral-100
  Body: Body-lg Neutral-700, line-height 1.6, full rich text rendering
  Attachments: card with file icon + filename + "Download" action

--- POLLS TAB ---

R-23: Polls List
  Active section header + Closed section header
  Active poll card (interactive):
    Deadline chip (Error if < 24h: "Closes in 3 hours" warning)
    Question: Heading-md
    Options preview (2 lines) + "X people voted" Body-sm
    "Vote Now" Primary Button (small, right-aligned)
  Voted poll card:
    Same but shows bar chart results + "You voted: [option]" indicator + closed badge if done
  Closed poll card: greyed out badge + final results bar chart

R-24: Poll Voting Screen (Bottom sheet or full-screen)
  Question: Display-lg, centered
  Subtext: "X people have voted • Closes [date]" Body-md Neutral-500
  Options: radio button list
    Each option: Standard List Item style | radio left | option text Body-lg | tap to select
    Selected: Primary-500 radio fill + row bg Primary-50
  "Submit Vote" Primary Button | disabled until option selected
  Post-vote: animated bar chart reveals with count per option
  Own vote highlighted with dot indicator

--- MESSAGES TAB ---

R-25: Neighbour Messaging (Chat List)
  Search bar at top
  Each conversation (Standard List Item):
    Avatar | Name + "Flat A-201" below | last message snippet | timestamp | unread badge

R-26: Chat Thread
  Nav: back arrow + avatar + Name + "Flat A-201" (subtext)
  Message bubbles:
    Sent (right): Primary-500 bg White text | radius 12px 12px 4px 12px
    Received (left): Neutral-100 bg Neutral-700 text | radius 12px 12px 12px 4px
    Timestamp below each bubble: Body-sm Neutral-400
  Input bar (fixed bottom):
    bg White | top border 1px Neutral-100 | padding 12px 16px
    Text input (flex-1) + Send button (Primary-500 circle 40dp, paper-plane icon)

--- FORUM TAB ---

R-27: Forum Thread List
  Horizontal category chip scroll (All, General, Maintenance, Events, Kids, Pets, Buy/Sell)
  Each thread card:
    Left: avatar (40dp) | category chip top-right
    Title: Heading-sm | author + flat + "3 hours ago" Body-sm Neutral-400
    Snippet: 2-line Body-md Neutral-500
    Bottom row: reply-count icon + views icon + upvote count — all Body-sm Neutral-400
  FAB: compose icon + "New Topic"

R-28: Forum Thread Detail
  Header: back + "Forum" + share icon
  Original post:
    Author avatar (48dp) | name + flat | timestamp
    Title: Display-lg
    Body: Body-lg line-height 1.6
    Upvote button (thumbs-up icon + count) + "Reply" action
  Divider: "X Replies"
  Reply list: same as list items, indented 8px for sub-replies
  Reply input (fixed bottom): text input + send icon
```

---

### UTILITY SERVICES

**R-29: Services Catalog**
```
LAYOUT: Full screen. "Book a Service" header.

Search bar: sticky at top | "Search services..." placeholder

FEATURED SERVICES (horizontal scroll):
  Large cards 140x100dp:
    bg: gradient per category | icon 32dp White | label White below
    Categories: Plumber (blue), Electrician (yellow), Carpenter (brown),
                Painter (purple), Pest Control (green), Appliance Repair (indigo)

ALL SERVICES GRID:
  3-column grid | each cell: card 100dp square
    bg White | radius MD | shadow Level-1
    Icon 32dp (color per category) on Primary-50 circle bg
    Label Body-sm SemiBold below center
    "X available" Body-sm Success-700 (or "None available" Neutral-400)
    Tap: navigates to R-30

Empty (no services configured): illustration + "Services coming soon" + "Contact admin"
```

**R-30: Service Provider List**
```
LAYOUT: Full screen. "[Category] Providers" header. Back arrow.

Sort/Filter row: "Sort: Best Rated" chip + "Available Now" chip (toggles)

Provider cards (Standard Card):
  Top: 
    Left: 52dp avatar (photo or initials) | Name Heading-sm | designation Body-md Neutral-500
    Right: star rating (amber star + "4.8" Body-md SemiBold) + total count below "(124 jobs)"
  Tags row: specialisation chips (e.g. "Leaks", "Pipe fitting", "Gas") — pill Neutral-100 style
  Availability: "Available today" Success-500 dot + label (or "Next: Tomorrow" Neutral-400)
  "Book Service" secondary button bottom-right of card (small)

Empty: "No providers available" + "Admin will assign automatically" info text
```

**R-31: Service Provider Profile**
```
LAYOUT: Full screen. Back arrow. "Book This Staff" FAB fixed bottom.

HERO:
  80dp avatar centered (photo quality preferred) | shadow Level-2
  Name: Display-lg center | Designation: Body-lg Neutral-500 center
  Overall rating: 5 amber stars + "4.8 / 5.0" Display-xl center | "(238 reviews)" below

STATS ROW (3 cols):
  "238 Jobs" | "4 yrs exp" | "97% completed"
  Each: Heading-md Primary-500 (number) + Body-sm Neutral-500 (label)

Specialisations:
  "Skills" section header
  Horizontal scroll of pill chips (Neutral-100 bg, Neutral-700 text)

Recent Reviews:
  "Reviews" section header + "See all" link
  3 most recent review cards:
    Star rating + Body-md review text + "Flat [XX]" + relative date
    No full resident name shown (privacy)

FAB: "Book This Staff" Primary-500 | fixed bottom 16px margin
```

**R-32: Book Service (Form)**
```
LAYOUT: Full screen form. "Book [Service]" header. Back arrow.

Sticky summary strip at top (if provider selected):
  Avatar (32dp) + name + "4.8★" in Neutral-50 strip with Primary-100 left border

FORM:

  Provider selection:
    "Any Available Staff" default radio | "[Name]" radio if came from profile
    Inline toggle

  Problem description:
    Textarea label "Describe the issue" | placeholder "e.g. Tap is leaking, kitchen sink..."
    Min 3 lines | char counter 0/300

  Photos (optional):
    "Add Photos" row: camera icon + "Tap to add photos (max 3)"
    After adding: horizontal scroll of thumbnail previews (80x80dp radius SM) with remove X

  Preferred date:
    "When do you need this?" label
    Horizontal scroll of date chips (Today | Tomorrow | [Day+2] | [Day+3] | Pick date...)
    Each chip: day-of-week + date | selected: Primary-500 bg

  Time slot:
    3 large tiles side by side:
      Morning: 8AM–12PM | Afternoon: 12PM–4PM | Evening: 4PM–7PM
      Each: pill shape 100% ÷ 3 | icon (sun/sun-medium/moon) | time label
      Selected: Primary-500 bg White text | Unselected: Neutral-100 Neutral-700

CTA: "Confirm Request" Primary Button fixed bottom | shows request summary (service, date, time)
```

**R-33: Service Request Status**
```
LAYOUT: Full screen. "[Service Type] Request" header + request ID subtext. Back arrow.

STATUS STEPPER:
  Full-width horizontal stepper (4 steps):
    Requested → Assigned → In Progress → Completed
  Current step: pulsing dot indicator

PROVIDER CARD (appears after Assigned):
  Status Card (left border Primary-500 if assigned, Warning if in progress)
  Left: 48dp avatar | center: name + designation + "ETA: 30 mins" Body-sm Warning-700
  Right: call icon (24dp) if phone available + chat icon

REQUEST DETAILS CARD:
  Service type, description, date requested, preferred time
  Photos thumbnail row (tap to expand)

TIMELINE:
  "Activity" section header
  Each event:
    Dot on vertical line | left: timestamp Body-sm Neutral-400 | right: event description Body-md
    Status transitions: "Request assigned to [Name]" | "Staff started work" | "Work completed"
    Admin notes shown if any

DISPUTE / ESCALATE (after 48h in same status):
  "Having issues?" collapsed card | expand to show "Escalate to Admin" action

RATE & REVIEW button:
  Appears when status = Completed (Success-500 banner with "Rate your experience" + star row)
```

**R-34: Service Request History**
```
LAYOUT: Full screen. "My Service Requests" header. Filter icon top-right.

FILTER SHEET (bottom sheet on filter icon tap):
  Status: multi-select chips (All | Requested | In Progress | Completed | Rejected)
  Date range: quick picks (Last 7 days | 30 days | 3 months | Custom)
  Category: same as service grid

List of request cards:
  Left: service category icon (40dp color circle) 
  Center: service type (Heading-sm) + "Flat A-304 • [date]" Body-md Neutral-500
  Right: status badge (pill) + "Repeat" icon button (refresh icon, ghost style, 32x32dp)
  
Tap card: navigates to R-33 (status detail)
"Repeat" icon: pre-fills R-32 form with same category and description

Empty state: clipboard icon + "No service requests yet" + "Book a service" CTA button
```

**R-35: Rate & Review Service**
```
LAYOUT: Bottom sheet (full height). "Rate Your Experience" heading.

Provider summary:
  Avatar (48dp) | name | service type | "Completed on [date]"

Star rating:
  "How would you rate [Name]'s work?" label
  5 stars | 48dp each | 12dp gap | amber color on select
  Tap animation: each star bounces scale 1→1.3→1 spring
  Label below stars: "1=Terrible" ... "5=Excellent"

Was completed? (radio):
  "Was the work completed satisfactorily?"
  Yes (checkmark) | No (X) — pill toggles

Review text (optional):
  Textarea | "Tell others about this service..." placeholder | 0/300 chars

"Submit Review" Primary Button full-width

On submit: success state overlay:
  checkmark lottie animation | "Thanks for your review!" | "Your feedback helps the community" | auto-dismiss 2s
```

---

### COMMUNITY CANTEEN

**R-36: Canteen Home**
```
LAYOUT: Tab-style inner tabs. "Today" | "This Week". Tab bar pill style under "Canteen" header.

TODAY TAB:
  Date display: "Wednesday, 30 April" Body-md Neutral-500 center, below tab bar

  Meal sections (vertical stack):
    Section header: meal icon + meal name + time range
      Breakfast (☀️) | 7:00 AM – 9:00 AM
      Lunch (🍛) | 12:00 PM – 2:00 PM
      Snacks (🫖) | 4:00 PM – 5:30 PM
      Dinner (🌙) | 7:00 PM – 9:00 PM

    Dish cards (horizontal scroll within each section):
      Card: 160x120dp | radius MD | shadow Level-1
      Top: dish photo if available (120x80dp cover, radius MD top) | placeholder: gradient bg + utensils icon
      Bottom pad 12px:
        Dish name: Body-md SemiBold
        Veg/Non-veg dot (green or red, 8dp circle) + Body-sm label
        Calorie count: Body-sm Neutral-400 (if provided)
        Allergen icons row: small icon badges (Gluten G, Dairy D, Nuts N)
        Rating row: amber star + "4.2" Body-sm + "(38)" Body-sm Neutral-400
        "Rate" ghost chip (if not rated today)

  "Pre-order" strip (if enabled): full-width Warning-100 banner "Pre-order dinner by 5 PM"

EMPTY / WEEKEND: 
  "No menu posted yet" illustration + "Check back later" + Admin contact note
```

**R-37: Weekly Menu**
```
LAYOUT: Full screen. Horizontal day tabs (scroll).

Day tabs (scrollable, pill style):
  Mon | Tue | Wed | Thu | Fri | Sat | Sun
  Today underlined with Primary-500 dot
  Selected: Primary-500 bg White text

Content per day: same meal sections as R-36 Today tab
If no menu: "Menu not set for this day" neutral placeholder
```

**R-38: Dish Detail**
```
LAYOUT: Bottom sheet (85% height). Pull to dismiss.

HERO:
  Dish photo (if available): full-width 240px | radius LG top only
  If no photo: centered utensils icon on gradient bg (amber gradient, 240px)

INFO:
  Padding: 24px
  Name: Display-lg
  Meal type + day: "Lunch • Today" Body-md Neutral-500

NUTRITION & ALLERGENS:
  Row of 3 stat chips:
    Calories: "320 kcal" | Veg/Non-veg badge | Meal time
  Allergen tags: pill chips with icon — "Contains Gluten", "Contains Dairy"

COMMUNITY RATING:
  Large star display: amber 5-star row + "4.2 / 5.0" Display-xl + "(128 ratings)" below
  Rating breakdown bars (5★ to 1★, horizontal bars, small)

RECENT REVIEWS (3 most recent):
  Each: star row + review text Body-md + "• 2 days ago" timestamp
  Flat number (not name): "Flat A-204" Body-sm Neutral-400

CTA: "Rate This Dish" Primary Button full-width
```

**R-39: Rate a Dish**
```
LAYOUT: Bottom sheet (half height).

Dish name + meal type header
Star rating selector (same as R-35, amber stars, 48dp, bounce animation)
Comment field: textarea, optional, "What did you think?" placeholder, 0/200 chars
"Submit Rating" Primary Button
Post-submit: brief success toast, sheet dismisses
```

**R-40: Pre-Order Meal**
```
LAYOUT: Bottom sheet (full height). "Pre-Order Meal" heading.

Date row: "Tomorrow, 1 May" Body-md center | "< >" arrows to change day

Meal slot selector:
  2-column grid: Breakfast | Lunch | Dinner
  Each: card with meal icon + time range | selected: Primary-500 border + bg Primary-50

Dish selection (appears after meal slot):
  "Available dishes" label
  List of dishes with radio select | dish name + veg dot + calorie

Cutoff time notice:
  Warning strip: "Pre-order closes at [cutoff time]" | clock icon

Confirm card (summary):
  "You're ordering: [Dish] for [Meal] on [Date]"
  "Collect from Canteen" note

"Confirm Pre-Order" Primary Button | "Cancel" ghost below
```

---

### EVENTS

**R-42: Events List**
```
LAYOUT: Full screen. "Events" header. Filter chip row.

FILTER CHIPS (horizontal scroll, below header):
  All | Upcoming | Fitness | Cultural | Kids | Society Meeting | Other

UPCOMING section:
  Featured event (first upcoming): Large hero card
    Full-width | Height: 200dp | Cover photo (or color gradient bg)
    Bottom overlay (gradient to black): 
      Event name Display-lg White | Date + venue Body-md White/80
      "X going" chip (Success) | "Register" button (White bg Primary-500 text, small)

  Remaining events (standard cards, 2-column grid or single column):
    Card: radius MD shadow Level-1
    Top: 140dp image area (photo or gradient)
    Category chip top-left (absolute, on image)
    Body pad 16px:
      Name Heading-md | Date Body-md Neutral-500 | Venue Body-sm Neutral-400
      Bottom row: [avatar stack of 3 attendees] + "and 24 others" | "Register →"

MY RSVPs section:
  Horizontal scroll of compact cards (upcoming only)
  Each: narrow card 140dp wide | event name | date | "You're going" Success badge

Empty: calendar icon + "No upcoming events" + "Check back soon"
```

**R-43: Event Detail**
```
LAYOUT: Full screen. Transparent nav bar over hero. Back arrow (White, bg circle for contrast).

HERO:
  Full-width | 260dp height | Cover photo (object-cover) or gradient bg
  Bottom: event title Display-xl White (with gradient overlay for readability)

CONTENT (scrollable):
  Padding: 24px

  Info strip row:
    Calendar icon + date/time | Map-pin icon + venue | Users icon + "34 registered (50 max)"
    Each in small Info strip card (3 per row or stacked)

  Capacity bar:
    "34/50 spots taken" label | Progress bar (Primary-500 fill) | "16 left" Body-sm right

  Organiser:
    "Organised by: [Name/Admin]" with avatar (32dp) + name Body-md

  Description:
    Body-lg Neutral-700 line-height 1.6 | "Read more" toggle if > 4 lines

  Attendees preview:
    "34 neighbours going" heading
    Avatar stack (5 overlapping circles) + "[Name], [Name], and 29 others"
    "See all" link

  Post-event section (if event is past):
    Rating card: avg rating stars + "Share your feedback" CTA

CTA (fixed bottom strip, bg White):
  If not registered: "Register (Free)" Primary Button full-width
  If registered: "You're Registered" Success-100 bg + Success-700 text + "Cancel RSVP" ghost right
  If full: "Join Waitlist" Warning-500 button
  If past: "Leave Feedback" Secondary Button
```

**R-44: RSVP Confirmation**
```
LAYOUT: Full screen success state (not a modal — feels more celebratory).

BG: soft indigo gradient (Primary-50 to White)

CENTER:
  Animated confetti burst (lottie, 1.5s) fading out
  Checkmark circle: 80dp | Success-500 bg | White checkmark (draw animation)
  "You're going!" Display-xl center | margin-top 16px
  Event name: Heading-md Neutral-700 center
  Date + venue: Body-lg Neutral-500 center

ACTIONS (stacked):
  "Add to Calendar" Secondary Button (calendar icon leading)
  "Share with Neighbours" ghost Button (share icon leading)
  "Done" Primary Button

Bottom: "We'll remind you 24 hours and 1 hour before" Body-sm Neutral-400 center
```

**R-45: Attendees List**
```
LAYOUT: Bottom sheet (70% height).

Header: "[Event Name] Attendees" | "34 going" count right

List: Standard List Item per attendee
  Avatar (40dp, initials or photo) | Name (Body-Heading-sm) | "Flat [Block-Num]" (Body-sm Neutral-400)
  No phone numbers shown (privacy)

Search input at top of list: "Search neighbours..." placeholder

Note: "Only first name and flat number shown for privacy" Body-sm Neutral-400 at bottom
```

---

### MEDICAL SOS

**R-47: SOS Activation Screen**
```
LAYOUT: Triggered by tap on SOS button on Home screen. Full screen overlay.

INITIAL STATE (0–5 seconds):
  BG: Error-500 (#dc2626) full screen
  Center: 
    "SENDING SOS" Display-2xl White Bold center | margin-top: 80px
    "Medical Emergency Alert" Body-lg White/70 center

  Circular countdown:
    120dp circle | stroke: White (12px stroke-width) | depleting clockwise in 5s
    Inside: countdown number "5" → "4" → "3" → "2" → "1" (Display-2xl White)
    
  CANCEL button:
    "CANCEL" | 56dp height | White bg + Error-700 text | radius SM | full-width minus 48px margin
    Position: bottom 20% of screen
    Body-sm below: "Tap to cancel before 0"

  Alert recipients shown below "Sending to:":
    "Medical Desk • Security Gate • [Admin Name]" Body-md White/70

SENT STATE (after 5s, no cancel):
  BG transitions to Error-700 (darker)
  Icon: heartbeat icon (48dp White) animating (pulse)
  "SOS Sent" Display-xl White
  "Help is being dispatched" Body-lg White/80
  Sending to list (same as above)
  "Cancel — False Alarm" ghost button (White border) at bottom
```

**R-48: SOS Status / Acknowledgement**
```
LAYOUT: Replaces SOS sent screen after acknowledgement received (WebSocket).

BG: Transitions from Error-700 to Neutral-900 (less alarming once acknowledged)

TOP SECTION (Success green strip when acknowledged):
  checkmark icon (32dp) + "Help Acknowledged" Display-lg White
  
RESPONDER CARD:
  White card, radius XL, padding 24px
  "Responding" body-sm neutral-500 uppercase
  Responder name: Heading-md | Role: "Medical Desk Staff" Body-md Neutral-500
  "Acknowledged at 2:34 PM" + "Response time: 1m 12s" Body-sm
  Status: [green dot] "On the way"

YOUR LOCATION SHARED:
  "Your location sent: [Building name, Flat A-304]" info strip (White/20 bg)

CANCEL SOS (if false alarm):
  "Cancel SOS" button | Error bg | height 52px | full-width minus margin
  On tap: confirmation modal "Are you sure this was a false alarm?"
  → "Cancel SOS" Error button | "Keep Active" Primary button

SOS LOG note: "This alert has been recorded for admin review"
```

---

### MEDICAL APPOINTMENTS

**R-49: Medical Help Desk Home**
```
LAYOUT: Full screen. "Medical Help Desk" header.

INFO BANNER (Primary-50 bg):
  "On-site medical support for [Society Name] residents"
  Walk-in hours: "Mon–Fri, 9 AM – 1 PM" Body-md
  Emergency: "For emergencies, use SOS button" — link back to home

DOCTORS / STAFF list (section headers: "Available Today" / "Visiting Doctors"):
  Provider card (Standard Card):
    Left: 52dp avatar | center: Name Heading-sm + Designation Body-md Neutral-500
    Availability chip: "Next slot: Today 11 AM" Success chip or "Next: Thursday" Neutral chip
    Specialisation Body-sm Neutral-400
    "Book Appointment" Secondary Button (small) bottom-right

TELEHEALTH BANNER (if enabled):
  Info strip: video icon + "Video consultation available" + "Book →" link
```

**R-50: Doctor / Nurse Profile**
```
LAYOUT: Bottom sheet (85% height) or full screen.

HERO (center):
  64dp avatar | Name Display-lg | Designation Body-lg Neutral-500
  Hospital/clinic icon: "Society Health Centre" Body-md Neutral-500

VISITING SCHEDULE:
  "Schedule" section header
  Week grid (Mon–Sun row):
    Available days: Primary-100 pill with time "9–1 PM"
    Unavailable: Neutral-100 pill with dash

SPECIALISATIONS:
  Pill chips (Neutral-100 bg) — e.g. "General Medicine", "Geriatric Care", "First Aid"

LANGUAGES: "Speaks: English, Hindi, Kannada" Body-md

"Book Appointment" Primary Button full-width bottom
```

**R-51: Book Appointment**
```
LAYOUT: Full screen form. "Book Appointment" header.

Doctor card at top (compact):
  Neutral-50 strip | 40dp avatar + name + next slot chip

FORM:
  Date selection:
    Horizontal scroll of available date chips (only shows available days per schedule)
    Each chip: day-name + date | selected: Primary-500 bg
    "No availability" chips are greyed out + strikethrough

  Time slot grid (2x3 or 3x2):
    Available slots: "10:00 AM" | "10:30 AM" etc
    Each: 52dp height chip | radius SM | selected Primary-500 bg
    Full slots: Neutral-200 bg + "Full" label Neutral-400

  Reason for visit (optional):
    Dropdown: General Checkup / Follow-up / Prescription / Vaccination / Other
    Text field below for notes (optional)

"Confirm Appointment" Primary Button fixed bottom
  Below: "Free cancellation up to 24 hours before" Body-sm Neutral-400
```

**R-52: My Appointments**
```
LAYOUT: Full screen. "My Appointments" header. Tabs: "Upcoming" | "Past"

UPCOMING TAB:
  Appointment card (Status Card, left Success border if confirmed):
    Doctor avatar (40dp) + Name Heading-sm | Date + time Body-md | Status badge
    "Reschedule" ghost button | "Cancel" ghost button (Error-700 text, small)
    "Add to Calendar" text link
    
  Reminder strip: "Reminder will be sent 24 hours before" (if > 24h away)

PAST TAB:
  Same cards, greyed out status | "Completed" or "Cancelled" badge
  No action buttons
  "Book Again" text link right-aligned

Empty (upcoming): calendar icon + "No upcoming appointments" + "Book Now" CTA
```

---

### COMPLAINTS

**R-55: My Complaints**
```
LAYOUT: Full screen. "My Complaints" header. FAB "+ Raise Complaint" bottom-right.

TABS: "Active" | "Resolved"

ACTIVE TAB:
  Each card (Status Card, left border matches status color):
    Top row: [Category icon circle] [Category label chip] [Status badge right]
    Title: Heading-sm
    "Raised [relative time]" Body-sm Neutral-400
    Last update row: "Updated 2 hours ago — [Status change description]" Body-sm Neutral-500
    If overdue: Warning strip below "Pending resolution for 5 days — Escalate?"
    Photo count badge if photos attached

RESOLVED TAB:
  Same cards | Resolution quality badge if rated | "View Resolution" action link
```

**R-56: Raise Complaint (Form)**
```
LAYOUT: Full screen form (or tall bottom sheet). "Raise Complaint" header.

CATEGORY GRID (2x3 or 3x3, icon cards):
  Each: 90dp square | category icon (28dp, category color circle bg) | label below
  Water | Electricity | Lift | Parking | Noise | Cleanliness | Security | Internet | Other
  Selected: Primary-500 border (2px) + Primary-50 bg

FORM (below grid):
  Title — text input | "Brief description" placeholder | max 80 chars
  
  Description — textarea | "Describe the issue in detail..." | min 80px height | required

  Photo attachments:
    Row of 3 empty squares (80dp each) with + icon | camera icon bottom-right of row
    After adding: thumbnail previews with X remove button top-right each

  Anonymous toggle:
    Row: "Submit anonymously" label | toggle right
    Below: "Your flat number will not be visible to staff, only to admin" Body-sm Neutral-400

"Submit Complaint" Primary Button fixed bottom
After submit: brief success animation → navigates to R-57 (status screen)
```

**R-57: Complaint Detail / Status Tracking**
```
LAYOUT: Full screen. "[Category] Complaint" header + "#COMP-1234" id subtitle.

STATUS STEPPER:
  5 steps: Raised → Under Review → Assigned → Resolved → Closed
  Full-width | scrollable if needed | current step pulsing

COMPLAINT INFO CARD:
  Category + title Heading-md
  Description Body-lg Neutral-700 (expandable if long)
  Photo thumbnails (horizontal scroll)
  "Submitted [date] [time]" + anonymous badge if applicable

ASSIGNMENT CARD (appears after Assigned):
  Status Card left-border Assigned color (purple)
  "Assigned to: [Staff Name]" + role Body-md Neutral-500

TIMELINE (Activity):
  Vertical timeline | each event:
    Dot (color per status) + connecting line
    Left: "[Status] — [Actor]" Heading-sm | "2 hours ago" Body-sm Neutral-400
    Admin notes: indented below in italic Body-md Neutral-500

ESCALATE CTA (conditional):
  If same status > SLA: Error-100 banner "This complaint has exceeded the expected resolution time"
  "Escalate to Senior Admin" Error button (secondary style)

RATE RESOLUTION (on Closed):
  Success-100 banner "Complaint Closed" + checkmark
  "Rate resolution quality" stars inline | Submit button
```

---

### MAINTENANCE PAYMENTS

**R-62: Payments Dashboard**
```
LAYOUT: Full screen. "Maintenance" header.

CURRENT DUE CARD (Feature Card, gradient bg — Primary or Error if overdue):
  Amount due: "₹3,450" Display-2xl White Bold
  "Due by 5 May 2026" Body-md White/70
  Status: "OVERDUE" red badge or "DUE IN 4 DAYS" warning badge
  "Pay Now" White bg Primary-500 text button (full-width, inside card)

AUTO-PAY STRIP:
  If not set: Neutral-50 card | "Enable auto-pay to never miss a due date" | "Set Up" link
  If set: Success-100 strip | "Auto-pay active — next debit 1 May" + "Manage" link

ITEMISED BREAKDOWN (expandable accordion):
  "View Breakdown" row with chevron toggle
  Expanded:
    Line items table (2 columns: label, amount):
      Base Maintenance     ₹2,800
      Water Charges        ₹350
      Parking Fee          ₹200
      Late Fee + Interest  ₹100 (Error-700 colored if late)
      TOTAL                ₹3,450 (Bold)

PAYMENT HISTORY (section header):
  Last 3 payments compact list | "View all →" link right
  Each: month label + amount + "Paid" badge + date + receipt download icon

UPCOMING BILLS section:
  3 months preview: "June 2026 — ₹3,200 (estimated)"
```

**R-63: Payment History**
```
LAYOUT: Full screen. "Payment History" header. Year filter dropdown top-right.

SUMMARY strip at top:
  "₹38,400 paid in FY 2025–26" Body-md Neutral-500

LIST grouped by month:
  Month header: Body-sm SemiBold uppercase Neutral-500 | total for month right
  Each payment row:
    Left: payment method icon (UPI / card / netbanking — 40dp)
    Center: "Maintenance — [Month] [Year]" Heading-sm | date + time Body-sm Neutral-400
    Right: "₹3,200" Body-md SemiBold | download icon (receipt PDF)
    Status badge: "Paid" Success | "Failed" Error | "Refunded" Info

Tap row: payment receipt detail bottom sheet
```

**R-64: Payment Flow**
```
LAYOUT: Full screen. "Pay Maintenance" header. Back arrow.

PAYMENT SUMMARY CARD (top, Neutral-50 bg):
  Society name Body-sm Neutral-500
  "April 2026 Maintenance" Heading-md
  Amount: "₹3,450" Display-xl Primary-500 Bold

PAYMENT METHOD LIST:
  Section header: "Choose Payment Method"
  Method rows (Standard List Item tappable):
    UPI row: UPI icon 40dp | "UPI" Heading-sm | "PhonePe, GPay, Paytm" Body-sm Neutral-400 | radio right
    Net Banking: bank icon | list of banks (dropdown on tap)
    Debit / Credit Card: card icon | "Enter card details" Body-sm
    Wallet: wallet icon | "Available balance: ₹240" Body-sm Success-700

  Selected method: Primary-500 radio fill + Primary-50 bg on row

"Proceed to Pay ₹3,450" Primary Button fixed bottom
  → Razorpay SDK sheet opens (standard Razorpay UI, full-screen)
```

**R-65: Payment Success**
```
LAYOUT: Full screen success. No tab bar visible.

BG: soft Success-50 gradient

CENTER:
  Animated confetti (green + indigo, 2s lottie)
  Checkmark circle: 80dp | Success-500 bg | White checkmark (draw animation 500ms)
  "Payment Successful!" Display-xl center margin-top 16px
  "₹3,450 paid for April 2026 Maintenance" Heading-md Neutral-700 center
  Transaction ID: "TXN: RZP12345678" Body-sm Neutral-400 center | copy icon inline

ACTIONS:
  "Download Receipt" Primary Button full-width (PDF)
  "Share Receipt" Secondary Button full-width
  "Back to Payments" ghost button

Footer note: "Confirmation sent to [email] and [phone]" Body-sm Neutral-400 center
```

**R-66: Auto-Pay Setup**
```
LAYOUT: Bottom sheet (full height). "Set Up Auto-Pay" heading.

Info card (Primary-50):
  "Never miss your maintenance due date"
  "We'll debit on the 1st of each month, or as configured"

FORM:
  Payment method: same method list as R-64 | UPI recommended
  Preferred debit date: day picker (1st / 5th / 10th / 15th)
  
  Confirm toggle:
    "I authorise SocietyOS to debit ₹[estimated] monthly from the above method"
    Toggle (required to be ON to proceed)

"Activate Auto-Pay" Primary Button
Below: "Cancel anytime from Payments settings" Body-sm Neutral-400
```

---

### PROPERTY SALE

**R-67: My Property Listing**
```
LAYOUT: Full screen. "Property Listing" header.

NO LISTING STATE:
  Illustration: house with "For Sale" sign (150dp, flat style, indigo + amber)
  "List your property" Heading-md center
  "Let neighbours know your flat is for sale before going to open market." Body-lg Neutral-500 center
  "Create Listing" Primary Button center

ACTIVE LISTING STATE (card):
  Feature Card (Primary gradient bg) — the property listing:
    Top row: "Flat [Block]-[Num] • [sqft] sq.ft" Body-md White/70
    Price: "₹[X]L / ₹[X]Cr" Display-xl White
    Furnished: "Semi-Furnished" chip White/20 bg
    Status badge: current status pill
  
  Stats row (below card):
    "12 views" | "3 interested" | "Listed 5 days ago"
  
  Admin note (if pending): "Awaiting admin approval" Warning strip
  
  Actions: "Edit Listing" Secondary Button | "Remove Listing" Destructive Button (small)
```

**R-68: Submit Property Listing**
```
LAYOUT: Full screen form. "Create Property Listing" header.

FORM:
  Flat details (auto-filled):
    "Your flat: [Block]-[Number]" info strip (non-editable) | Neutral-50 bg

  Carpet area: numeric input | "sq.ft" trailing label | number keyboard

  Asking price: 
    ₹ leading icon | numeric input | formatted with commas
    Below: "[Price] Lakhs / [Price] Crores" auto-calculated display Body-sm Primary-500

  Furnished status: 3-option toggle
    Fully Furnished | Semi-Furnished | Unfurnished

  Description (optional): textarea | "Highlight key features..." | 0/500 chars

  Contact preference:
    "How should interested parties reach you?"
    Radio: "Through admin (recommended)" | "Share my phone number directly"

  Photos (optional): 
    "Add photos to attract more interest" label
    Grid of 4 empty squares + icon (camera) | max 8 photos

Info notice: "Listing will go live only after admin approval" Warning strip

"Submit for Review" Primary Button fixed bottom
```

**R-69: Community Property Board**
```
LAYOUT: Full screen. "Properties for Sale" header. Filter icon.

FILTER sheet:
  Area range: min-max slider (sqft)
  Price range: min-max slider (₹)
  Floor: any / ground / upper

LISTING CARDS (single column):
  Card (Standard Card):
    Top: photo strip (if photos available, horizontal scroll 3:2 ratio thumbnails)
    Body:
      "[Block]-[Num] • [Floor] Floor" Body-md Neutral-500
      "₹[X] Lakhs" Display-lg Primary-500 Bold
      "[X] sq.ft • Semi-Furnished" Body-md Neutral-700
      "Listed [X] days ago" Body-sm Neutral-400
      "X people interested" Success-500 if > 0
    Footer: "Express Interest" Secondary Button right-aligned

EMPTY: house icon + "No properties listed" + "Be the first to list your flat"
```

---

### TRAVEL MODE

**R-71: Travel Mode Home**
```
LAYOUT: Full screen. "Travel Mode" header.

NO ACTIVE PAUSE:
  Illustration: plane icon or suitcase (150dp flat, indigo + amber)
  "Going away?" Heading-md center
  "Request a pause on variable charges while you're travelling" Body-lg center
  "Submit Travel Request" Primary Button

ACTIVE PAUSE STATE:
  Status card (Success border):
    "Active Travel Pause" Success badge
    Travel dates: "[Start] → [Return]" Heading-md
    "Services paused: Canteen, Newspaper" Body-md chips
    Countdown: "Returns in 12 days" Body-sm Neutral-400
  
  "I'm back early" Warning button (marks return)

PAST REQUESTS (section below):
  Compact list: date range + status + savings "Saved ₹450"
```

**R-72: Submit Travel Request**
```
LAYOUT: Bottom sheet (full height). "Submit Travel Request" heading.

FORM:
  Travel start date: date picker | default tomorrow
  Expected return date: date picker | min: start+1 day
  Duration display: "12 days" auto-calculated Body-md Primary-500

  Reason (optional): 
    Text input | "Work trip, vacation..." placeholder

  Services to pause (multi-select checklist):
    Each service: checkbox + service icon + service name Body-md
    Canteen Meals | Newspaper Delivery | Milk Delivery | [society-specific]
    Note: "Service availability varies by your society settings"

  Note about billing: Info strip Primary-50
    "Maintenance due reduction is subject to admin approval as per society rules"

"Submit Request" Primary Button
```

---

### PROFILE & SETTINGS

**R-74: My Profile**
```
LAYOUT: Full screen. "Account" header (from tab bar).

PROFILE HEADER:
  bg: Primary-gradient (100px height) | avatar overlapping below (80dp circle, border 3px White)
  Name: Display-lg Neutral-900 (below avatar, centered) | "Flat A-304 • Owner" Body-md Neutral-500

SETTINGS SECTIONS (grouped list, section headers):

  Personal Information:
    Full name | Email | Phone (non-editable, with lock icon) | Member since

  Security:
    Change PIN / Password | Enable biometric login (toggle) | Connected devices (list)

  Notifications:
    → navigates to R-75

  Language:
    Current: "English" → navigates to R-76 (language picker)

  Privacy & Data:
    Download my data | Delete my account | → navigates to R-77

  About:
    App version | Terms of Service | Privacy Policy | Help & Support
    "Report a bug" ghost link

  Logout (at bottom, Error-700 text, no icon, full-width ghost button)
```

**R-75: Notification Settings**
```
LAYOUT: Full screen. "Notification Settings" header.

INFO: "Control what you hear from us." Body-md Neutral-500

Toggle list (Standard List Item with toggle right):
  CATEGORY toggles:
    [Bell] Visitor Alerts — "When someone arrives at your gate" — ON
    [CreditCard] Payment Reminders — "Before due dates" — ON
    [AlertCircle] Complaint Updates — "Status changes" — ON
    [Calendar] Event Reminders — "24h and 1h before events" — ON
    [Megaphone] Society Notices — "Official announcements" — ON
    [Utensils] Canteen Menu — "Daily menu posted" — OFF
    [Heart] Medical Reminders — "Appointment reminders" — ON
    [Shield] Emergency Alerts — ALWAYS ON — toggle greyed out | "Cannot be disabled for your safety"

  Divider

  DELIVERY SETTINGS:
    "Quiet hours" row: "Do not disturb 11 PM – 7 AM" toggle
    "Notification sound" row: sound picker dropdown
```

**R-76: Language Settings**
```
LAYOUT: Bottom sheet or full screen. "Choose Language" heading.

Language options list:
  Each: Standard List Item | language flag emoji (32dp) | native script name + English name | radio right
  English | हिंदी (Hindi) | ಕನ್ನಡ (Kannada) | தமிழ் (Tamil) | తెలుగు (Telugu) | मराठी (Marathi)
  Selected: Primary-500 radio + row bg Primary-50

Preview note below: "The app will restart to apply the language" Info strip

"Apply Language" Primary Button
```

---

## 4. APP 2 — STAFF MOBILE APP

**Design Philosophy for Staff App:**
- Bigger everything: 18px body, 56dp touch targets, 24dp icons
- Maximum contrast: all text meets WCAG AAA
- Action-first: the most important action per screen is immediately visible
- One primary action per screen — no decision fatigue
- Status-color-coded everywhere for at-a-glance comprehension
- Offline-first thinking: always show data even if stale (with "last synced" indicator)

**Navigation:** Bottom Tab Bar (4 tabs)
```
Tab 1: Home      — home icon
Tab 2: Tasks     — clipboard-list icon
Tab 3: Attendance — clock icon
Tab 4: Profile   — user icon

Tab bar: bg White | shadow Level-3 (upward stronger than resident app)
Active tab: filled icon + label Primary-500 Bold
Inactive: outlined icon + label Neutral-400

"Staff App" displayed in header, smaller — different from Resident App visually
```

---

**S-01: Login (PIN)**
```
LAYOUT: Full screen. No back. No skip.

TOP: Society logo (or Marzi logo) + society name + "Staff Portal" Body-sm Neutral-400

Center PIN pad:
  "Enter your PIN" Heading-lg center
  6 dots (unfilled circles → filled on input) | 24dp each | 12dp gap | margin-top: 32px
  Full-screen numeric keypad (large buttons, 80px height each key)
  Delete key with backspace icon

"Use Biometric" button below dots (if enrolled) — fingerprint/face icon + label

"Forgot PIN?" text link at bottom → triggers admin reset notification
```

**S-02: First Time Setup**
```
LAYOUT: Step-by-step, 3 steps with progress bar at top.

Step 1 — Staff ID:
  "Enter your Staff ID" Display-lg
  "Your admin would have given you this" Body-md Neutral-500
  Numeric input large | full-width

Step 2 — OTP verification:
  Same as R-04 but larger text
  "OTP sent to your registered number" Body-md

Step 3 — Set PIN:
  "Create a 6-digit PIN" Display-lg
  "You'll use this to log in daily" Body-md
  PIN dots + numeric keypad
  Repeat PIN step (confirm)

Step 3b — Language:
  "Choose your language" Display-lg | full list with native script names
  Large radio buttons (56dp tap targets)
```

**S-03: Staff Home**
```
LAYOUT: ScrollView. Fixed header with check-in CTA or status.

HEADER (bg Primary-500, padding 20px):
  "Good morning, Ramesh" Display-lg White
  "[Designation] • [Society Name]" Body-md White/70
  Today's date: Body-md White/60

CHECK-IN BANNER (directly below header):
  If not checked in: full-width Error-100 strip (attention-grabbing)
    clock icon (32dp Warning-500) | "You haven't checked in yet" Heading-sm Warning-700
    "Check In Now" Warning-500 button right | large, can't miss it

  If checked in: full-width Success-100 strip
    checkmark icon (32dp Success-500) | "Checked in at 8:42 AM" Heading-sm Success-700
    "Check Out" ghost button right (neutral style — don't make it too easy to accidentally tap)

TODAY'S TASKS CARD (Standard Card, bottom Priority-500 border):
  "Today's Tasks" Heading-md | count badge right "3 pending"
  Task preview: 3 compact task rows (flat, service, status dot)
  "View All Tasks →" text link

PERFORMANCE SNAPSHOT (Standard Card):
  "This Month" Heading-md
  3 stats side by side:
    "12 Tasks" | "4.7★ Rating" | "96% Attendance"
    Each: number Heading-lg Primary-500 + label Body-sm Neutral-500

LATEST REVIEW (if new, card with amber left border):
  Star rating row + review snippet | "Flat A-204 • 2 hours ago"

NOTICE BOARD (compact, 2 items):
  "Notices" heading | "See all →"
  Each: megaphone icon + notice title + "3 hours ago"
```

**S-04: Check-In Screen**
```
LAYOUT: Full screen (navigated to from Home banner or Attendance tab).

TOP: "Attendance Check-In" Display-lg | today's date + time (live, updates every second)

LOCATION VERIFICATION:
  Large circle (140dp) — location status visual:
    Loading: spinning ring Primary-500
    Inside society (geofence): checkmark animation → Success-500 ring + "Within [Society Name]" below
    Outside: X animation → Error-500 ring + "You're outside society boundaries" below
    
  Body text below circle:
    Success: "Tap to check in" Body-lg Success-700
    Outside: "You must be inside the society to check in" Body-md Error-700

CHECK IN button:
  Only enabled when inside geofence | disabled when outside or loading
  Large: full-width | 64px height | Success-500 bg | White text Heading-md | checkin icon leading
  On tap: if biometric available → biometric prompt first
  Pressed state: brief scale + checkmark animation → success

BIOMETRIC FALLBACK:
  "Use PIN instead" text link below button (if biometric fails)

SUCCESS STATE (1.5s then auto-dismiss):
  Full-screen Success-50 bg | checkmark (100dp circle) | "Checked In!" Display-xl | time
  Auto-navigates back to Home
```

**S-05: Attendance History**
```
LAYOUT: Full screen. "Attendance" tab content. Month selector header row.

MONTH STRIP: "← April 2026 →" | arrow buttons | Body-md SemiBold center

SUMMARY CARDS (horizontal scroll, 3 cards):
  "Present: 22 days" Success-100 card
  "Absent: 2 days" Error-100 card
  "Late: 3 days" Warning-100 card
  Each: Heading-lg [semantic-700] + Body-sm [semantic-700] label

CALENDAR:
  Standard month calendar | each day cell (40dp square):
    Present (on time): Success-500 dot | dot below date number
    Present (late): Warning-500 dot
    Absent: Error-500 dot
    Holiday/Leave: Neutral-300 bg + "L" or "H" label
    Today: Primary-500 circle underline
    Future: no dot

  Tap day → bottom sheet: check-in time, check-out time, duration, any notes

DAILY LOG LIST (below calendar):
  Most recent first | date header rows
  Each row: date | check-in time | check-out time | hours | [late badge if applicable]
  Late row: Warning-100 bg tint | "Reported late: [reason]" below in italic Body-sm
```

**S-08: My Tasks List**
```
LAYOUT: Full screen. "My Tasks" header. Tabs below: Pending | In Progress | Completed.

TAB badge counts: "Pending (3)" | "In Progress (1)" | "Completed (14)"

Each task card (Status Card, left border color per status):
  TOP ROW:
    Left: service category icon circle (40dp, colored: blue for plumbing, yellow for electric etc)
    Center: "[Service type]" Heading-md
    Right: status badge (pill)

  FLAT INFO ROW:
    map-pin icon (16dp) + "Flat A-204, Floor 2" Body-md Neutral-700 | "Block B" chip
    Resident first name: "Resident: Priya" Body-sm Neutral-400

  DESCRIPTION: 2-line clamp Body-md Neutral-500
  
  BOTTOM ROW:
    clock icon + "Assigned 2h ago" Body-sm Neutral-400 | "Due: 5 PM" if SLA set (Warning-700 if near)
    [Photo icon + count] if resident attached photos

  If NEW (not yet accepted):
    Orange left border | "NEW" badge | background Warning-50 tint

  Tap card: navigates to S-09

EMPTY (pending): illustration of clipboard with checkmark + "All clear! No pending tasks." + "Pull to refresh"
```

**S-09: Task Detail**
```
LAYOUT: Full screen. "[Service Type]" header + "#TASK-001" ID subtitle. Back arrow.

TASK INFO CARD:
  Status badge (top right) + full category icon (48dp circle, colored)
  Title/description: Body-lg Neutral-700 full text (not truncated)

RESIDENT INFO (compact strip, Neutral-50 bg):
  home icon | "Flat [Block]-[Num]" Heading-sm | floor + block Body-sm Neutral-400
  Not shown: resident full name or phone (privacy unless admin enables)

RESIDENT PHOTOS (if attached):
  "Photos from Resident" subheader
  Horizontal scroll of thumbnails (80x80dp) | tap to full-screen lightbox

STATUS ACTIONS (large, clear, hard to miss):
  Based on current status, show ONE primary action:
    If New: "Accept Task" (Success-500, large) + "Reject" (Error ghost, smaller)
    If Accepted: "Start Work" (Primary-500, large) with play-circle icon
    If In Progress: "Mark as Completed" (Success-500, large) with checkmark icon
    — "Add Note" and "Add Photos" always visible as secondary actions

PROOF OF WORK SECTION (visible from In Progress onwards):
  "Before Photos" horizontal scroll | "After Photos" horizontal scroll
  + Camera button to add photos | voice note button

TIMELINE (activity log):
  Vertical | each: dot + "[Action] at [time]" | notes shown inline

REJECT TASK (bottom sheet):
  Reason selector (large radio rows for easy tapping): 
    Not my specialisation | Requires materials | Unavailable | Needs admin clarity | Other
  "Reason" textarea | "Reject Task" Error button
```

**S-10: Photo Upload (Proof of Work)**
```
LAYOUT: Full screen (camera integration) or grid if reviewing.

PHASE TABS: "Before" | "During" | "After"

BEFORE PHASE:
  Instructions strip: "Take photos BEFORE starting work" Warning-100

PHOTO GRID:
  3-column grid of added photos (existing) + [+] add button
  Each thumbnail: 
    Full-width in its cell | rounded MD | ratio 4:3
    Bottom strip: timestamp + location pin icon (geotagged indicator)
    Remove X button top-right

ADD PHOTO button: 
  Opens camera with overlay guidance grid | capture button (large circle) at bottom
  "Hold steady for geotagging" hint text | live location confirmation dot

VOICE NOTE:
  "Add voice note" row below photos
  Tap: record button (red circle) | waveform animation while recording | stop to save
  Saved note: waveform icon + duration + play button + delete

TEXT NOTE:
  Inline textarea below | "Add a note about this task" placeholder

"Upload [X] Photos" Primary Button — shows upload progress (linear bar)
Offline: "Photos saved — will upload when connected" Info strip
```

**S-13: My Ratings**
```
LAYOUT: Full screen. "My Performance" header.

HERO RATING CARD (Primary gradient bg, radius XL):
  "Your Rating" Body-sm White/70
  "4.7" Display-2xl White Bold center | 5 amber stars below | "(238 reviews)" White/60

STATS ROW (below card):
  3 cards horizontal:
    "12 This Month" | "238 Total Jobs" | "96% On-time"

RATING BREAKDOWN (Standard Card):
  Each star row (5★ → 1★):
    "5★" label | progress bar (amber fill, Neutral-100 bg) | "142 reviews" right
    Bar width proportional to count

TREND CHART:
  Line chart (avg rating by week, 8 weeks) | amber line | Primary-50 fill below line
  Axes: weeks left, rating 1-5 bottom

REVIEWS LIST:
  "Recent Reviews" header | "See All" link
  Each review card (Standard Card):
    Top: star row (read-only) + "2 days ago" right
    Review text: Body-lg italic
    "Flat [XX]" Body-sm Neutral-400 (no name)
    "Flag" icon button top-right (small, 32dp)
```

**S-15: Leave Management Home**
```
LAYOUT: Full screen. "Leave & Holidays" header.

LEAVE BALANCE CARDS (horizontal scroll, 3 cards):
  Each card (100px height, radius LG):
    Leave type heading | "[X] days left" Display-lg [semantic color] | "[Y] used of [Z]" Body-sm
    Progress arc (semicircle) showing used/remaining
    Colors: Casual (Primary) | Medical (Success) | Privilege (Info)

PENDING REQUESTS (if any):
  "Pending Approval" section header
  Each: Standard Card, Warning left border | dates + type + "Pending Admin Approval" badge

APPLY BUTTON:
  "Apply for Leave" Primary Button | full-width | margin-top 24px

HOLIDAY CALENDAR link:
  "View Holiday Calendar" Secondary Button or text link with calendar icon
```

**S-16: Apply for Leave**
```
LAYOUT: Bottom sheet (full height). Large touch targets throughout.

"Apply for Leave" heading

LEAVE TYPE:
  3 large toggle cards (row of 3, equal width):
    Casual | Medical | Privilege
    Each: 100% ÷ 3 | 72px height | leave icon + label Body-md SemiBold
    Selected: Primary-500 bg White text
    Below selected: "X days remaining" Body-sm (Primary-200 text on dark bg)

DATE RANGE:
  "From" date picker chip | "To" date picker chip (side by side)
  "Duration: 3 days" auto-calculated below | Body-md Primary-500

REASON:
  Textarea | "Describe reason for leave..." | large (min 5 rows) | Body-lg size

"Submit Leave Request" Primary Button (Success-500 bg — positive action)
Below: "Admin will approve within [X] hours as per society policy" Body-sm Neutral-400
```

---

## 5. APP 3 — ADMIN PORTAL (Web)

**Layout Philosophy:**
- Sidebar left (240px) + top header (64px) + content area
- Content area max-width 1280px, centered with 32px padding
- Data-dense but breathing room between sections
- Tables as primary data view with inline actions
- Charts above the fold on dashboard, tables below
- Every list view has export button
- Color-coded status throughout

**Sidebar:**
```
Top: Marzi/SocietyOS logo (40px) + society name + admin role chip
Nav sections (with section headers in Body-sm uppercase Neutral-400):
  OVERVIEW: Dashboard
  RESIDENTS: Residents, Visitors Log
  STAFF: Staff, Attendance, Leave Requests
  OPERATIONS: Service Requests, Complaints, Events, Canteen
  MEDICAL: Appointments, SOS Alerts, Medical Staff
  FINANCE: Payments, Billing Config, Reports
  PROPERTY: Property Listings, Travel Pauses
  COMMUNICATION: Notices, Polls, Push Notifications, Archive
  SETTINGS: Society Settings, Roles, Integrations, Audit Trail

Active nav item: Primary-50 bg | left border 3px Primary-500 | text Primary-500 Bold
Hover: Neutral-50 bg

Bottom: "Help & Support" + "Logout" (separated by divider)
Collapse button → icon-only sidebar (64px)
```

**Top Header:**
```
Height: 64px | bg White | bottom border 1px Neutral-100 | shadow Level-1
Left: Breadcrumb: Home > Staff Management > [Staff Name]
Right: Search icon | notification bell (badge count) | admin avatar (32dp) + name + dropdown
```

---

**A-04: Main Dashboard**
```
LAYOUT: Full page. 32px padding. Grid-based layout.

ROW 1 — STAT CARDS (5 columns, 16px gap):
  Each card (Standard Card, 100% height):
    Metric: Display-xl Primary-500 (or semantic color)
    Label: Body-md Neutral-500
    Trend: "+3 since yesterday" Body-sm with up/down arrow (Success/Error colored)
    Icon: 40dp circle bg [primary-100] + icon [primary-500] top-right corner
  Cards: Total Residents | Active Staff | Open Complaints | Pending Service Requests | Today's Attendance %

ROW 2 — FINANCIAL SNAPSHOT (3 columns):
  Card 1 (2/3 width): "This Month's Collections"
    Large donut chart (Recharts): Paid (Success) / Outstanding (Warning) / Overdue (Error)
    Legend below with amounts
  Card 2 (1/3 width): key numbers
    "₹2.4L collected" Display-lg Success-700
    "₹45K outstanding" Heading-md Warning-700
    "₹12K overdue (3 flats)" Heading-md Error-700

ROW 3 — CHARTS (2 columns, equal):
  Chart 1: "Complaints by Category (30 days)" — horizontal bar chart
    Categories on Y axis | count on X | color-coded bars per category
  Chart 2: "Service Requests Trend (14 days)" — line chart
    Received (Primary) vs Completed (Success) lines | X = days | Y = count

ROW 4 — SPLIT (3/2 ratio):
  Left (3/5): Activity Feed (real-time, WebSocket)
    Scrollable feed | each event: icon + description + time
    Color dot per event type | "Load more" pagination at bottom
  Right (2/5): Quick Actions
    Grid 2x3: Post Notice | Create Event | Assign Request | Send Alert | Approve Leave | View SOS Log
    Each: icon card, standard admin style

ROW 5 — TABLES (2 columns):
  Left: "Upcoming Events" — mini table (name, date, registered/capacity)
  Right: "SLA Breaches" — mini table (request ID, category, hours overdue, "Assign" action)
```

**A-05: Residents List**
```
LAYOUT: Full page.

TOP BAR:
  "Residents" heading (Heading-lg) + count badge (Neutral-100 pill "234 residents")
  Right: Search input + "Filter" button + "Add Resident" Primary Button + "Export CSV" Secondary Button

FILTER DRAWER (slides from right, 320px):
  Block / Building: multi-select chips
  Type: Owner / Tenant / Both
  Status: Active / Pending / Inactive
  Dues Status: Paid / Due / Overdue
  Apply Filters / Clear All buttons

TABLE:
  Column headers (sortable — chevron up/down on active sort):
    [] Checkbox | Flat | Resident | Type | Status | Last Active | Dues | Phone | Actions
  
  Row (52px height):
    Checkbox | "A-304" Body-md | Avatar (24dp) + Name Body-md | Owner/Tenant chip | Status badge | "2 days ago" | Dues badge | phone | Edit icon + ⋯ more
  
  Bulk action bar (appears when rows selected):
    bg Primary-50 | "[X] selected" | "Send Message" | "Export" | "Deactivate" buttons
  
  Pagination: "Showing 1-25 of 234" + prev/next + page size selector

Row click → R-07 (Resident Profile detail page)
```

**A-07: Resident Profile (Admin View)**
```
LAYOUT: Full page. Back breadcrumb. Action buttons top-right.

TOP SECTION (profile header card):
  Large avatar (64dp) | Name Display-xl | "Flat A-304 • Owner" Heading-md Neutral-500
  Status badge (Active/Pending/Inactive) | "Member since [date]"
  Top-right: "Send Message" Secondary Button | "Deactivate" Destructive Button | ⋯ more

TABS:
  Overview | Payment History | Complaints | Service Requests | Visitor Log

OVERVIEW TAB:
  2-column grid of info cards:
    Personal Info: name, phone, email, flat, type, move-in date
    Dues Summary: current due, last payment date, total paid YTD, overdue count

PAYMENT HISTORY TAB:
  Table: Month | Amount | Paid On | Method | Transaction ID | Receipt icon
  Summary row at top: total paid, % on time

COMPLAINTS TAB:
  Table: Date | Category | Status | Resolution time | Rating
  Charts: complaints by category pie (if > 3 complaints)

VISITOR LOG TAB:
  Table: Date | Visitor Name | Entry Time | Exit Time | Method | Gate
```

**A-09: Staff List**
```
LAYOUT: Same structure as Residents List.

TABLE columns: Checkbox | Staff ID | Name | Designation | Category | Status | Today's Attendance | Rating | Actions

Category column: colored service chips (plumber=blue, security=orange, etc.)
Attendance column: "Checked In 08:42" Success-700 | "Not In" Neutral-400 | "On Leave" Warning-700

Row actions (⋯ dropdown): View Profile | Edit | Assign Task | Deactivate | View Attendance
```

**A-15: Service Requests (All)**
```
LAYOUT: Full page.

PRIORITY VIEW TOGGLE: List view | Board view (Kanban by status)

LIST VIEW TABLE:
  Columns: ID | Flat | Category | Resident | Status | Assigned To | Raised | SLA Deadline | Actions

  SLA Deadline column:
    > 8h remaining: Green "In 8 hours"
    < 4h remaining: Warning "In 2 hours"
    Breached: Error "Overdue 3h" + red row bg tint

  Actions per row: "Assign" button (Primary, small) if unassigned | "View" icon | ⋯

BOARD VIEW (Kanban):
  5 columns: Open | Assigned | In Progress | Completed | Disputed
  Cards in each column (compact):
    Service type + flat | resident name | time | assignee avatar (if assigned)
  Drag-to-assign: drag card to "Assigned" column → triggers assign modal

ASSIGN MODAL:
  Selected request summary (compact card)
  "Assign to Staff" dropdown (searchable):
    Options: available staff in relevant category | avatar + name + current load count
    "Available now" dot indicator
  "Assign" Primary Button | "Cancel" ghost

BULK ASSIGN:
  Select multiple → "Bulk Assign" bar → select staff → confirm
```

**A-16: Service Request Detail (Admin)**
```
LAYOUT: Full page (or slide-in panel 640px from right — no full navigate).

LEFT PANEL (60% width):
  Request info: category, flat, description, raised time, SLA deadline
  Status timeline (vertical, same as R-33 but with admin actions visible)
  Resident photos (grid)
  Staff proof-of-work photos (grid, after completion)
  
  Dispute section (if Disputed):
    Split view: "Resident says:" card | "Staff says:" card
    "Resolve in favor of:" radio + resolution note textarea + "Resolve" button

RIGHT PANEL (40% width):
  STATUS BOX:
    Status dropdown (inline edit) | Update button
    Admin note textarea | "Add Note" button
  
  ASSIGNMENT BOX:
    Current assignee avatar + name
    "Reassign" dropdown + confirm
  
  SLA BOX:
    SLA deadline | "Extend SLA" link (date-time picker inline)
  
  ACTIONS:
    "Mark Completed" (Success button) | "Escalate" | "Close" | "Send to Resident"
```

**A-18: Menu Editor (Daily)**
```
LAYOUT: Full page. "Canteen Menu" header. Date navigation.

DATE PICKER (top, centered):
  "← Yesterday  |  Today, 30 Apr  |  Tomorrow →" | "Jump to date" link
  "Published" / "Draft" badge next to date

4 SECTIONS (vertical stack with section headers):
  Each section: "Breakfast (7:00 – 9:00 AM)" section header with collapse toggle + "Add Dish" button

  DISH ROW (within section):
    Drag handle ⠿ left | dish photo thumbnail (40x40dp) or food icon | Dish name (editable inline) | Veg dot | Calories | Price | Allergen chips | Edit pencil icon | Delete X icon
    
  ADD DISH inline form (expands below last dish in section):
    Name | Calories | Price | Veg toggle | Allergens (tag input) | Photo upload | Add button | Cancel

FOOTER ACTIONS:
  "Save as Draft" Secondary Button | "Publish Menu" Primary Button (Success-500)
  "Copy from [previous day]" ghost button
  
PUBLISH confirmation modal:
  "Publish this menu? Residents will be notified." | Publish / Cancel
```

**A-22: Create / Edit Event**
```
LAYOUT: Right-side slide-in panel (720px) or full page.

FORM (2-column on wide screens):
  LEFT COLUMN:
    Event title (large text input, placeholder "Community Yoga Session")
    Category (dropdown: Fitness / Cultural / Kids / Society Meeting / General / Other)
    Description (rich text editor: bold, italic, bullet list — keep it simple)
    Cover image (upload with drag-drop zone, 16:9 preview)

  RIGHT COLUMN:
    Date: date picker | Start time + End time (time pickers side by side)
    Venue: text input
    Registration limit: numeric input | "Unlimited" toggle if no limit
    Enable waitlist: toggle
    Target audience: All residents / Specific blocks (multi-select)
    Send notification on publish: toggle

  PREVIEW card (below form):
    Shows how the event card will look in the resident app

STATUS toggle at top:
  "Draft" (default) | "Published" — switch to publish
  Warning: "Once published, residents will be notified. Are you sure?"

"Save Draft" Secondary | "Publish Event" Primary (Success-500)
```

**A-31: All Complaints (Admin)**
```
LAYOUT: Same list structure as service requests.

TABLE columns: ID | Category (icon + name) | Title | Flat | Raised | Status | Assigned To | SLA | Priority | Actions

PRIORITY column:
  Auto-calculated: High (> 48h open or escalated) | Medium (24-48h) | Low (<24h)
  Color badge: High=Error / Medium=Warning / Low=Success

FILTER OPTIONS (sidebar or dropdown):
  Status multi-select | Category multi-select | Priority | SLA Status | Date range | Anonymous only toggle

ASSIGN MODAL: same as A-16 (pick staff/committee member)

ROW click → A-32 (Complaint Detail)
```

**A-35: Billing Configuration**
```
LAYOUT: Full page. "Billing Settings" header. Two sections.

CHARGE STRUCTURE TABLE:
  Left: "Flat Type" (1BHK / 2BHK / 3BHK / Penthouse)
  Columns: Base Maintenance | Parking (per vehicle) | Water | Total
  Each cell: inline editable number field (click to edit, Enter to confirm)
  "Add Flat Type" row at bottom

BILLING RULES (form cards):
  Billing cycle: Monthly / Quarterly toggle
  Due date: day-of-month slider (1–28)
  Late payment interest: % per month numeric input
  Grace period: days numeric input (0–15)

PENALTY CONFIG:
  Late fee type: Fixed amount or Percentage radio
  Amount / percentage: numeric input

Preview card:
  "A 2BHK flat owner will be billed ₹3,200/month, due on the 1st, with ₹100 late fee after 3 days grace."
  Auto-updates as form changes

"Save Configuration" Primary Button | "Cancel" ghost
Confirmation modal: "This will affect [X] active residents. Are you sure?" + effective date picker
```

**A-36: Payments Overview**
```
LAYOUT: Full page. Tabs: All | Received | Pending | Overdue

SUMMARY BAR (top, 4 stat boxes):
  "₹2.4L Received" Success | "₹85K Pending" Warning | "₹45K Overdue" Error | "94% Collection Rate" Primary

OVERDUE TAB (most used by admin):
  Sort by: Days Overdue (default, descending)
  Table: Flat | Resident | Amount | Due Date | Days Overdue | Last Reminder | Actions
  
  Row with > 30 days: Error-50 row bg tint
  Row with 8-30 days: Warning-50 tint
  
  Actions: "Send Reminder" (ghost button, email/SMS icon) | "View" | ⋯
  
  Bulk: Select multiple → "Send Reminders (12)" button

SEND REMINDER MODAL:
  Preview of reminder message (editable)
  Channel: SMS + Push / Email / All
  Confirm button
```

**A-44: Create Poll**
```
LAYOUT: Slide-in panel or modal (640px wide).

"Create Poll" heading

Question input: large textarea | placeholder "What should we name the new park?"

Options (dynamic list):
  Option 1: text input + drag handle + remove X
  Option 2: text input + drag handle + remove X
  "+ Add Option" ghost button | max 6 options

Settings (below):
  Answer type: Single choice / Multiple choice toggle
  Anonymous voting: toggle | "(Voters identities will be hidden)" subtext
  Deadline: date + time picker
  Target: All Residents / Specific blocks

Preview: shows how poll looks on resident app (compact card preview)

"Publish Poll" Primary Button | "Save Draft" Secondary
On publish: "X residents will be notified" confirmation modal
```

**A-51: Audit Trail**
```
LAYOUT: Full page.

FILTERS (top bar):
  Admin user (dropdown) | Module (dropdown) | Action type | Date range picker | "Apply" button

TABLE:
  Columns: Timestamp | Admin | Action | Module | Entity | Old Value | New Value
  
  Action column color coding:
    Create: Success-100 badge | Update: Warning-100 | Delete: Error-100 | Approve: Info-100
  
  Old/New Value: collapsed by default | "View diff" link expands inline diff view
    Diff: red strikethrough for old, green for new (git-diff style)
  
  Timestamp: full ISO format on hover | relative time displayed

Export: "Export Audit Log (CSV)" button | date range required for large exports
```

---

## 6. CROSS-APP PATTERNS

### 6.1 Screens Present Across All 3 Apps

**Loading / Splash:**
- Each app: branded splash → transitions to appropriate home within 2s

**Error States (standardised):**
```
Network error: wifi-off icon + "No internet connection" + "Try Again" button
Server error: server icon + "Something went wrong" + "Try Again" + "Contact Support" link
Empty search: search icon + "No results for '[query]'" + "Clear search" link
Permission denied: lock icon + "You don't have permission" + "Contact admin" info
```

**Pull to Refresh:** standard platform behavior (iOS rubber-band, Android spinner)

**Offline Mode:**
```
Top banner: "You're offline — showing saved data" | Neutral-900 bg White text | full-width | non-dismissable
Stale data indicator: "(last updated 3 hours ago)" Body-sm Neutral-400 below section headers
Offline-capable actions: view tasks (Staff), view past data (Resident), view dashboard (Admin)
Write actions: queued locally, synced on reconnect with toast "3 actions synced"
```

### 6.2 Status Color Reference (Unified)

| Status | Bg | Text | Border |
|---|---|---|---|
| Requested / Pending | #dbeafe | #1d4ed8 | #93c5fd |
| Assigned | #ede9fe | #6d28d9 | #c4b5fd |
| In Progress | #fef3c7 | #b45309 | #fcd34d |
| Completed / Resolved / Approved | #dcfce7 | #15803d | #86efac |
| Rejected / Overdue | #fee2e2 | #b91c1c | #fca5a5 |
| Closed / Inactive | #f1f5f9 | #64748b | #cbd5e1 |
| Under Review | #dbeafe | #1d4ed8 | #93c5fd |
| Under Negotiation | #fef9c3 | #a16207 | #fde047 |
| Sold | #d1fae5 | #065f46 | #6ee7b7 |

### 6.3 Form Validation Patterns

```
Validation timing: on blur (not on every keystroke) + on submit attempt
Error placement: below the specific field (never toast for field errors)
Error style: Body-sm Error-700 | alert-circle icon 12dp left | 4px margin-top
Success validation: checkmark-circle icon trailing (for name, email, phone after blur)
Inline hint: Neutral-400 Body-sm below field before any interaction
Required fields: asterisk * in label (not placeholder) | "* Required" note at form bottom
Submit with errors: focuses first errored field + scrolls to it + shakes submit button once
```

### 6.4 Photo Viewer / Lightbox

```
Full-screen overlay: bg rgba(0,0,0,0.9)
Photo: centered, pinch-to-zoom (2x max), double-tap to zoom toggle
Navigation: swipe left/right between photos in same set | photo count top-center "2 of 5"
Close: X button top-right (White, 44dp tap target) | swipe-down to dismiss
Download button: bottom-right (if user has permission)
Caption: bottom of screen, White text (timestamp + geotag info for staff proof photos)
```

### 6.5 Navigation Transitions

```
Mobile (React Navigation):
  Stack push: slide-left (new screen) / slide-right (back) | 280ms ease-out
  Modal/sheet: slide-up | 320ms spring | dismiss: swipe-down or slide-down 250ms
  Tab switch: fade (instant, no slide — avoids motion sickness)
  
Web Admin (Next.js):
  Route change: fade 150ms (no full-page slide on web)
  Panel open (service request detail etc): slide-in from right 280ms ease-out
  Modal: scale-in from center 200ms ease-out + overlay fade
  Table row expand: height animation 200ms ease-out
```

---

## 7. DESIGN COVERAGE CHECKLIST

### Resident App — 77 Screens
Auth & Onboarding: R-01 to R-07 (7 screens) ✓  
Home & Notifications: R-08 to R-09 (2 screens) ✓  
Visitors & Gate: R-10 to R-16 (7 screens) ✓  
Security & Alerts: R-17 to R-19 (3 screens) ✓  
Community: R-20 to R-28 (9 screens) ✓  
Utility Services: R-29 to R-35 (7 screens) ✓  
Canteen: R-36 to R-41 (6 screens) ✓  
Events: R-42 to R-46 (5 screens) ✓  
Medical SOS: R-47 to R-48 (2 screens) ✓  
Medical Appointments: R-49 to R-54 (6 screens) ✓  
Complaints: R-55 to R-58 (4 screens) ✓  
Staff Help Requests: R-59 to R-61 (3 screens) ✓  
Maintenance Payments: R-62 to R-66 (5 screens) ✓  
Property Sale: R-67 to R-70 (4 screens) ✓  
Travel Mode: R-71 to R-73 (3 screens) ✓  
Profile & Settings: R-74 to R-77 (4 screens) ✓  

### Staff App — 25 Screens
Auth: S-01 to S-02 (2 screens) ✓  
Home: S-03 (1 screen) ✓  
Attendance: S-04 to S-07 (4 screens) ✓  
Tasks: S-08 to S-12 (5 screens) ✓  
Reviews: S-13 to S-14 (2 screens) ✓  
Leave: S-15 to S-18 (4 screens) ✓  
Community: S-19 to S-22 (4 screens) ✓  
Profile & Documents: S-23 to S-25 (3 screens) ✓  

### Admin Portal — 52 Screens
Auth: A-01 to A-03 (3 screens) ✓  
Dashboard: A-04 (1 screen) ✓  
Residents: A-05 to A-08 (4 screens) ✓  
Staff: A-09 to A-14 (6 screens) ✓  
Service Requests: A-15 to A-17 (3 screens) ✓  
Canteen: A-18 to A-21 (4 screens) ✓  
Events: A-22 to A-25 (4 screens) ✓  
Medical: A-26 to A-30 (5 screens) ✓  
Complaints: A-31 to A-34 (4 screens) ✓  
Financial: A-35 to A-39 (5 screens) ✓  
Property & Travel: A-40 to A-41 (2 screens) ✓  
Notices & Communication: A-42 to A-47 (6 screens) ✓  
Admin Settings: A-48 to A-52 (5 screens) ✓  

**TOTAL: 154 screens fully specified**

### BRD Gaps Covered (screens BRD implies but doesn't name)
- Society selection (multi-tenant onboarding) ✓
- Pending approval waiting state ✓  
- Global notification center ✓  
- Payment success/receipt screen ✓  
- Visitor arrival full-screen notification ✓  
- QR pass generation ✓  
- Event RSVP confirmation ✓  
- Post-event feedback ✓  
- SOS countdown + acknowledgement (2 separate states) ✓  
- Canteen pre-order ✓  
- Property community board (separate from my listing) ✓  
- Push notification composer (distinct from notices) ✓  
- Communication archive ✓  
- Audit trail ✓  
- Backup & data export ✓  
