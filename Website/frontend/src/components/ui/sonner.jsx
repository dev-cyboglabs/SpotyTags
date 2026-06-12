import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!bg-cream group-[.toaster]:!text-ink-900 group-[.toaster]:!shadow-apple-lg group-[.toaster]:!rounded-xl group-[.toaster]:p-4 group-[.toaster]:font-sans",
          title: "font-display font-semibold text-[14px] tracking-tight !text-ink-900",
          description: "group-[.toast]:!text-ink-500 font-sans text-[13px] mt-0.5",
          icon: "!text-status-success !text-xl",
          success: "group-[.toast]:!text-status-success group-[.toast]:!text-xl",
          actionButton:
            "group-[.toast]:bg-brand group-[.toast]:text-cream group-[.toast]:font-semibold group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs transition-colors hover:group-[.toast]:bg-brand/90 shadow-apple-sm",
          cancelButton:
            "group-[.toast]:bg-ink-100 group-[.toast]:text-ink-700 group-[.toast]:font-semibold group-[.toast]:rounded-lg group-[.toast]:px-3 group-[.toast]:py-1.5 group-[.toast]:text-xs transition-colors hover:group-[.toast]:bg-ink-200",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
