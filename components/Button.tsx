import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

/**
 * Shared action-button primitive. Introduced during the clinical/minimal
 * redesign to replace the near-identical `bg-ink text-parchment ...` (and
 * friends) button markup that had been copy-pasted across the upload,
 * reports, map, and settings workspaces.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-md font-medium",
    "transition-[transform,background-color,border-color,color,opacity]",
    "duration-[var(--duration-fast)] ease-[var(--ease-out)]",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
  ].join(" "),
  {
    variants: {
      intent: {
        primary: "bg-text text-bg hover:bg-text/85 active:bg-text/90",
        accent: "bg-accent text-accent-fg hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]",
        secondary:
          "bg-surface text-text border border-border hover:border-border-strong hover:bg-surface-sunken",
        destructive: "bg-danger text-white hover:opacity-90",
        ghost: "text-text-muted hover:text-text hover:bg-surface-sunken",
      },
      size: {
        sm: "text-[12.5px] px-3 py-1.5",
        md: "text-sm px-4 py-2",
      },
    },
    defaultVariants: {
      intent: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, intent, size, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(buttonVariants({ intent, size }), "focus-ring", className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
