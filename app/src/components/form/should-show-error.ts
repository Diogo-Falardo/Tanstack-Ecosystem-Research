// The single error-timing policy for every field in the kit: stay quiet while
// the user is still typing, show once they leave the field or try to submit.
// (Not shadcn's `isTouched` gate — touched flips on the first keystroke.)
export function shouldShowError(
  meta: { isValid: boolean; isBlurred: boolean },
  submissionAttempts: number,
) {
  return !meta.isValid && (meta.isBlurred || submissionAttempts > 0)
}
