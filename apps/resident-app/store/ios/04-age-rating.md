# App Store Connect — Age Rating

Answer the questionnaire as follows. Expected result: **4+**.

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | **None** |
| Gambling | No |
| Contests | No |
| Unrestricted Web Access | **No** |
| User Generated Content | **Yes** |

## Two answers that need care

**User Generated Content — Yes.** The community feed lets residents post and
comment. Apple requires (Guideline 1.2) that any app with UGC provides:
1. a method to filter objectionable content,
2. a mechanism to **report** offensive content,
3. the ability to **block abusive users**,
4. published contact information so users can reach you.

⚠️ Confirm the community feed has report-and-block before submitting. This is
the second most common rejection for community apps after sign-in. If it does
not, either add it or remove the feed from this release.

**Medical/Treatment Information — None.** The app stores vitals and lets a
resident book a visiting doctor, but it does not diagnose, dose, or give
treatment advice. If the app ever offers guidance rather than record-keeping,
this must change to "Infrequent/Mild" and the rating rises.

**Unrestricted Web Access — No**, provided in-app links open only your own
domains. The app uses `expo-web-browser`; if it can open arbitrary URLs from
user content, this becomes Yes and the rating rises to 17+.
