# App Store Connect — Age Rating

Answer the questionnaire as follows. Expected result: **4+**.

| Question                      | Answer   |
| ----------------------------- | -------- |
| Cartoon or Fantasy Violence   | None     |
| Realistic Violence            | None     |
| Sexual Content or Nudity      | None     |
| Profanity or Crude Humor      | None     |
| Alcohol, Tobacco, or Drug Use | None     |
| Mature/Suggestive Themes      | None     |
| Horror/Fear Themes            | None     |
| Medical/Treatment Information | **None** |
| Gambling                      | No       |
| Contests                      | No       |
| Unrestricted Web Access       | **No**   |
| User Generated Content        | **No**   |

## Two answers that need care

**User Generated Content — No (for this build).** On iOS the community feed
and other residents' review comments are gated off by `UGC_ENABLED`
(`src/lib/features.ts`), because Guideline 1.2 requires report + block and
neither exists yet. Complaints and requests go only to the society office and
are not shown to other residents.

⚠️ When `UGC_ENABLED` is turned on for iOS, this answer becomes **Yes** and
report + block must ship in the same build.

**Medical/Treatment Information — None.** The app stores vitals and lets a
resident book a visiting doctor, but it does not diagnose, dose, or give
treatment advice. If the app ever offers guidance rather than record-keeping,
this must change to "Infrequent/Mild" and the rating rises.

**Unrestricted Web Access — No**, provided in-app links open only your own
domains. The app uses `expo-web-browser`; if it can open arbitrary URLs from
user content, this becomes Yes and the rating rises to 17+.
