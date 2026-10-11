/**
 * What other people may see of a person attached to a record (a task, a
 * visitor, an alert): who they are, how to reach them, which flat.
 *
 * Responses used to `include: { user: true }` / `{ resident: { include: { user:
 * true } } }`, sending staff phones the resident's email, date of birth, PAN
 * number, Aadhaar and ID-proof URLs and emergency contact (and, until the
 * response backstop in strip-secrets.ts, their TOTP secret and push tokens).
 * Use these instead whenever a record is shown to someone other than its
 * owner.
 */
export const PERSON_BRIEF_SELECT = { id: true, name: true, phone: true } as const;

/** Colleagues see each other's names, not phone numbers (recognitions, chat). */
export const COLLEAGUE_SELECT = { id: true, name: true } as const;

/** A resident on someone else's screen: name, phone, flat. No KYC data. */
export const RESIDENT_BRIEF = {
  select: {
    id: true,
    userId: true,
    flatId: true,
    user: { select: PERSON_BRIEF_SELECT },
    flat: true,
  },
} as const;
