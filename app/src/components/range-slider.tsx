import { useEffect, useRef, useState } from 'react'
import { useRanger } from '@tanstack/react-ranger'

type RangeSliderProps = {
  label: string
  min: number
  max: number
  stepSize?: number
  steps?: readonly number[]
  value: [number, number]
  onCommit: (value: [number, number]) => void
  formatValue: (value: number) => string
  disabled?: boolean
}

// Two-handle slider on Ranger. Presentational: it reports committed values
// and leaves URL writes and debouncing to the caller.
// Ranger commits a mouse/touch drag once on release (no onDrag passed), but
// every Left/Right arrow press commits right away — callers should debounce.
// Ranger ships no ARIA, roles or tabIndex; they're added here.
export function RangeSlider({
  label,
  min,
  max,
  stepSize,
  steps,
  value,
  onCommit,
  formatValue,
  disabled = false,
}: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [local, setLocal] = useState<[number, number]>(value)

  // Back/forward or a Clear button can change the value without dragging.
  const [low, high] = value
  useEffect(() => {
    setLocal([low, high])
  }, [low, high])

  const stepOptions = steps ? { steps } : { stepSize: stepSize ?? 1 }

  const ranger = useRanger<HTMLDivElement>({
    getRangerElement: () => trackRef.current,
    values: local,
    min,
    max,
    ...stepOptions,
    onChange: (instance) => {
      const [nextLow, nextHigh] = instance.sortedValues
      const next: [number, number] = [nextLow, nextHigh]
      setLocal(next)
      onCommit(next)
    },
  })

  const segments = ranger.getSteps()
  const handles = ranger.handles()

  return (
    <div className="w-64" aria-disabled={disabled || undefined}>
      <div className="mb-1 text-sm">{label}</div>
      <div
        ref={trackRef}
        className="relative h-2 rounded bg-gray-200"
        style={{ pointerEvents: disabled ? 'none' : undefined }}
      >
        {segments.map(({ left, width }, index) => (
          <div
            key={index}
            className={`absolute h-full rounded ${index === 1 ? 'bg-gray-700' : ''}`}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        ))}
        {handles.map(
          (
            {
              value: handleValue,
              isActive,
              onKeyDownHandler,
              onMouseDownHandler,
              onTouchStart,
            },
            index,
          ) => (
            <button
              key={index}
              type="button"
              role="slider"
              aria-label={`${index === 0 ? 'Minimum' : 'Maximum'} ${label.toLowerCase()}`}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={handleValue}
              aria-valuetext={formatValue(handleValue)}
              disabled={disabled}
              onKeyDown={onKeyDownHandler}
              onMouseDown={onMouseDownHandler}
              onTouchStart={onTouchStart}
              className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white ${isActive ? 'z-10 border-gray-900' : 'border-gray-500'}`}
              style={{ left: `${ranger.getPercentageForValue(handleValue)}%` }}
            />
          ),
        )}
      </div>
      <div className="mt-2 text-sm">
        {formatValue(local[0])} – {formatValue(local[1])}
      </div>
    </div>
  )
}
