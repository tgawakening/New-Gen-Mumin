import { ReactNode } from "react";

/** Reusable section wrapper with consistent padding and max-width. */
export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`py-16 md:py-20 lg:py-24 ${className}`}>
      <div className="section-container">{children}</div>
    </section>
  );
}

/** Centered section heading with optional orange subtitle (live site pattern). */
export function SectionHeading({
  subtitle,
  title,
  description,
  variant = "light",
}: {
  subtitle?: string;
  title: string;
  description?: string;
  /** 'dark' for use on dark backgrounds (e.g. Instructors) */
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <div className="text-center mb-8 md:mb-10">
      {subtitle && (
        <span className={`font-bold text-lg mb-2 block ${isDark ? "text-amber-300" : "text-orange-500"}`}>
          {subtitle}
        </span>
      )}
      <h2 className={`text-3xl md:text-4xl lg:text-5xl font-serif font-bold mb-4 ${isDark ? "text-white" : "text-[#334155]"}`}>
        {title}
      </h2>
      {description && (
        <p className={`text-lg max-w-2xl mx-auto ${isDark ? "text-white/80" : "text-[#64748b]"}`}>
          {description}
        </p>
      )}
    </div>
  );
}
