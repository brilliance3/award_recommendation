import { ReactNode } from "react";

interface Props {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}

export default function Field({ label, required, hint, children, htmlFor }: Props) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-semibold text-ink-800">
        {label}
        {required && (
          <span aria-label="필수 입력" className="text-danger-500 ml-0.5">
            *
          </span>
        )}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-ink-300 bg-white px-3 py-2.5 text-sm text-ink-900 " +
  "placeholder:text-ink-400 transition " +
  "hover:border-ink-400 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 " +
  "disabled:bg-ink-100 disabled:text-ink-400 disabled:cursor-not-allowed";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props} className={`${inputBase} ${props.className || ""}`} />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputBase} leading-relaxed resize-y ${props.className || ""}`}
    />
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type ButtonSize = "sm" | "md" | "lg";

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    block?: boolean;
  }
) {
  const {
    variant = "primary",
    size = "md",
    block = false,
    className = "",
    ...rest
  } = props;

  const base =
    "inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg " +
    "transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " +
    "disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap";

  const sizes: Record<ButtonSize, string> = {
    sm: "px-2.5 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
    lg: "px-5 py-3 text-base",
  };

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 " +
      "focus-visible:ring-brand-500",
    accent:
      "bg-accent-600 text-white hover:bg-accent-700 active:bg-accent-800 " +
      "focus-visible:ring-accent-500",
    secondary:
      "bg-white text-ink-800 border border-ink-300 " +
      "hover:bg-ink-50 hover:border-ink-400 " +
      "focus-visible:ring-brand-500",
    ghost:
      "bg-transparent text-ink-700 hover:bg-ink-100 " +
      "focus-visible:ring-brand-500",
    danger:
      "bg-white text-danger-600 border border-danger-500/40 " +
      "hover:bg-danger-50 hover:border-danger-500 " +
      "focus-visible:ring-danger-500",
  };

  return (
    <button
      {...rest}
      className={`${base} ${sizes[size]} ${variants[variant]} ${
        block ? "w-full" : ""
      } ${className}`}
    />
  );
}
