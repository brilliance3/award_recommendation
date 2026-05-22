import { ReactNode } from "react";

interface Props {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export default function Field({ label, required, hint, children }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded border border-slate-300 px-3 py-2 text-sm " +
        "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
        (props.className || "")
      }
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded border border-slate-300 px-3 py-2 text-sm " +
        "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
        (props.className || "")
      }
    />
  );
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }
) {
  const { variant = "primary", className = "", ...rest } = props;
  const base = "inline-flex items-center px-3 py-2 text-sm rounded font-medium transition";
  const styles = {
    primary: "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400",
    secondary: "bg-white border border-slate-300 text-slate-800 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
  }[variant];
  return <button {...rest} className={`${base} ${styles} ${className}`} />;
}
