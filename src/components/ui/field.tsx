import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

const control =
  'h-10 w-full rounded-md border border-border bg-card px-3 text-sm placeholder:text-muted-foreground aria-[invalid=true]:border-destructive'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'h-auto min-h-20 py-2', className)} {...props} />
}

/** Native select: fully keyboard/screen-reader accessible and works well on mobile. */
export function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'cursor-pointer', className)} {...props} />
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-sm font-medium', className)} {...props} />
}

/** Label + control + optional error, wired together with ids. */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: (props: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => React.ReactNode
}) {
  const errId = `${id}-error`
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, ...(error ? { 'aria-invalid': true as const, 'aria-describedby': errId } : {}) })}
      {error && (
        <p id={errId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
