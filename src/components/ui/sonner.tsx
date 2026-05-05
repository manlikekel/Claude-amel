import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto !rounded-full !border !backdrop-blur-xl !px-4 !py-3 !shadow-[0_18px_44px_-18px_oklch(0_0_0/0.7)] group-[.toaster]:bg-[oklch(0.1_0.008_280/0.85)] group-[.toaster]:text-foreground group-[.toaster]:border-[var(--glass-border)]",
          description: "group-[.toast]:text-muted-foreground !text-xs",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!border-[color-mix(in_oklab,var(--success)_45%,transparent)] group-[.toaster]:!bg-[color-mix(in_oklab,var(--success)_18%,oklch(0.1_0.008_280/0.85))]",
          error:
            "group-[.toaster]:!border-[color-mix(in_oklab,var(--danger)_45%,transparent)] group-[.toaster]:!bg-[color-mix(in_oklab,var(--danger)_18%,oklch(0.1_0.008_280/0.85))]",
          info:
            "group-[.toaster]:!border-[color-mix(in_oklab,var(--primary)_45%,transparent)] group-[.toaster]:!bg-[color-mix(in_oklab,var(--primary)_18%,oklch(0.1_0.008_280/0.85))]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
