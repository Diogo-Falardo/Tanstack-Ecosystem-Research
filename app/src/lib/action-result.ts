// Result contract for mutating server functions. Expected domain failures
// (missing FK target, row deleted under an edit) are *returned* so they can
// land on form fields. Auth failures (middleware) and validator failures still
// throw — only a thrown error's `message` is guaranteed to reach the client.
export type ActionFailure = {
  ok: false
  formError?: string
  fieldErrors?: Partial<Record<string, string>>
}

export type ActionResult<T> = { ok: true; data: T } | ActionFailure

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(errors: {
  formError?: string
  fieldErrors?: Partial<Record<string, string>>
}): ActionFailure {
  return { ok: false, ...errors }
}

// Maps a result onto TanStack Form's form-level validator return shape
// (`{ form, fields }`). `fields` must always be present: form-core only treats
// an object with a `fields` key as a form/fields split.
export function toFormErrors(failure: ActionFailure) {
  return { form: failure.formError, fields: failure.fieldErrors ?? {} }
}

// A thrown error (auth middleware, server validator) becomes a form-level
// error. Only `message` is guaranteed to survive the trip from the server.
export function thrownToFormErrors(error: unknown) {
  return {
    form:
      error instanceof Error
        ? readableMessage(error.message)
        : 'Something went wrong',
    fields: {},
  }
}

// A server validator (Zod) failure arrives with the issues array serialized
// as JSON in `message`; show the issue messages instead of the raw JSON.
function readableMessage(message: string): string {
  try {
    const issues: unknown = JSON.parse(message)
    if (Array.isArray(issues)) {
      const messages = issues
        .map((issue: { message?: unknown }) => issue.message)
        .filter((m): m is string => typeof m === 'string')
      if (messages.length > 0) return messages.join('. ')
    }
  } catch {
    // Not JSON: a plain error message (e.g. "Forbidden").
  }
  return message
}
