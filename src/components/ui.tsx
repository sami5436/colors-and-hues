import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <Link
      href="/"
      className={`font-display leading-none tracking-tight text-ink ${size === "lg" ? "text-3xl" : "text-2xl"}`}
    >
      Colors <span className="italic text-accent">&amp;</span> Hues
    </Link>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "solid", size = "md", className = "", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" };
  const variants = {
    solid: "bg-ink text-paper hover:bg-ink-2",
    outline: "border border-rule-strong bg-card text-ink hover:border-ink",
    ghost: "text-ink-2 hover:text-ink hover:bg-paper-2",
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted">
      {children}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-md border border-rule-strong bg-card px-3 text-[15px] text-ink placeholder:text-muted/70 outline-none transition-colors focus:border-ink";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-rule bg-card ${className}`}>{children}</section>;
}

export function Initial({ name, filled, className = "" }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink text-[11px] font-semibold uppercase ${
        filled ? "bg-ink text-paper" : "bg-card text-ink"
      } ${className}`}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}
