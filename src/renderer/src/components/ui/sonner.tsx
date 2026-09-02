import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ toastOptions, style, ...props }: ToasterProps) => {
  const centered = props.position?.endsWith('center') ?? false

  return (
    <Sonner
      theme="dark"
      className="toaster group"
      style={
        {
          '--width': 'min(30rem, calc(100vw - 2rem))',
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius)',
          ...style
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        style: {
          width: 'fit-content',
          minWidth: 'min(8rem, calc(100vw - 2rem))',
          maxWidth: 'min(30rem, calc(100vw - 2rem))',
          ...(centered
            ? { left: 0, right: 0, marginInline: 'auto' }
            : {}),
          ...toastOptions?.style
        },
        classNames: {
          toast: 'group toast shadow-xl',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          ...toastOptions?.classNames
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
