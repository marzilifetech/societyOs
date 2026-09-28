# App Store Connect — Version Information (1.0.14)

Every field below is inside Apple's limit; the count is shown so you can see the
headroom before editing.

## Promotional Text (170 max — this one is 156)

Can be changed any time WITHOUT a new build or review — use it for
announcements.

```
Approve visitors before they reach your door, track maintenance dues, book a service and read society notices — everything your society needs, in one place.
```

## Description (4000 max — this one is 1377)

Describes only what a reviewer can reach in this build. Amenity booking,
laundry, parking, AGM, budget, the community feed, the health module, travel
and property exist in the codebase but are not reachable on iOS 1.0, and
advertising them is a Guideline 2.3.1 (inaccurate metadata) rejection. There
is no in-app payment: maintenance is paid at the society office. Add each
feature back to the text when it ships.

```
One Community brings the everyday running of your residential society into a single app.

VISITORS & DELIVERIES
Approve or reject a visitor from your phone before they reach your door. Security logs the guest at the gate and you decide — no intercom, no waiting. Pre-approve expected guests with a shareable pass, and keep a record of who came and when.

MAINTENANCE DUES
See your maintenance bill, the amount due and the due date, and every payment your society office has recorded against your flat.

SERVICES & REQUESTS
Book a plumber, electrician, carpenter or painter, or raise a request with the society office. Track it as staff pick it up and complete it.

NOTICES, POLLS & EVENTS
Read notices from the society office the moment they are posted, vote in society polls, and see what is planned in your community.

CANTEEN
See today's breakfast, lunch and dinner menus from the society canteen, with calories and dietary information, and pre-order your meal.

SAFETY
Raise an emergency SOS that reaches the security desk and society administrators immediately, with your location attached.

FOR YOUR HOUSEHOLD
Add family members, manage domestic help, register your vehicles, and keep documents like your ID proofs in one secure place.

One Community is provided to residents by their society. You will need a mobile number registered with your society office to sign in.
```

## Keywords (100 max, comma separated, NO spaces after commas)

```
society,apartment,visitor,gate,maintenance,amenity,resident,community,housing,rwa,flat,society app
```

## What's New in This Version

Not shown for the first App Store version — App Store Connect only asks for it
from the second version onward. Leave it empty for this submission.

## Support & Contact (App Review Information)

| Field                   | Value                        |
| ----------------------- | ---------------------------- |
| Contact first/last name | _(your name)_                |
| Phone                   | _(a number Apple can reach)_ |
| Email                   | `support@marzi.in`           |

### Sign-in required — the demo account

Tick **Sign-in required** and enter:

| Field     | Value        |
| --------- | ------------ |
| User name | `9999999001` |
| Password  | `0000`       |

Then paste this into **Notes**:

```
One Community is used by residents of a registered residential society.
Sign-in is by mobile number and one-time password (OTP), so a self-service
account cannot be created. We have set up a demo society for review:

1. On the first screen, choose "Marzi Demo Residency (App Review)".
2. Enter the mobile number 9999999001 and tap "Send code".
3. Enter the code 0000. (This demo number never receives an SMS; the code
   is fixed.)

After sign-in you will see a visitor waiting at the gate with Approve /
Reject buttons — this is the app's core feature: security logs a guest at
the gate and the resident decides from their phone.

Maintenance bills are shown for information only. Residents pay at their
society office, and the app has no payment feature.

Location is requested only to attach the resident's position to an
Emergency SOS; it is never used in the background. The demo society has no
security staff, so pressing SOS alerts no one.
```

⚠️ Before submitting, run the demo-society script on **production** — see
`06-build-and-submit.md`. Then sign in once yourself with the steps above.
A reviewer who cannot sign in is a Guideline 2.1 rejection, the most common
one for an app like this.
