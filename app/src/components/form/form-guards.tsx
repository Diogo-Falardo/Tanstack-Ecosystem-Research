import { useBlocker } from '@tanstack/react-router'

// Focus the first control the kit marked invalid. Deferred one frame: form
// state updates synchronously, but React hasn't re-rendered `aria-invalid`
// yet when `onSubmitInvalid` runs.
export function focusFirstInvalid(formElement: HTMLFormElement | null) {
  requestAnimationFrame(() => {
    formElement?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}

// "Unsaved changes" is `!isDefaultValue`, not `isDirty` (which stays true
// after the user reverts a value). Read at navigation time, so no
// subscription. Navigate with `ignoreBlocker: true` after a successful save.
export function useUnsavedChangesBlocker(form: {
  state: { isDefaultValue: boolean }
}) {
  return useBlocker({
    shouldBlockFn: () => !form.state.isDefaultValue,
    enableBeforeUnload: () => !form.state.isDefaultValue,
    withResolver: true,
  })
}

export function UnsavedChangesPrompt({
  blocker,
}: {
  blocker: ReturnType<typeof useUnsavedChangesBlocker>
}) {
  if (blocker.status !== 'blocked') return null
  return (
    <div
      role="alertdialog"
      aria-labelledby="unsaved-changes-title"
      className="mt-4 border p-4"
    >
      <p id="unsaved-changes-title" className="font-medium">
        You have unsaved changes. Leave anyway?
      </p>
      <div className="mt-2 flex gap-4">
        <button
          type="button"
          className="border px-3 py-1"
          onClick={blocker.reset}
        >
          Stay
        </button>
        <button
          type="button"
          className="border px-3 py-1"
          onClick={blocker.proceed}
        >
          Leave
        </button>
      </div>
    </div>
  )
}
