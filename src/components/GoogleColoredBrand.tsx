import React from "react";

interface GoogleColoredBrandProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export const GoogleColoredGhostGuard: React.FC<GoogleColoredBrandProps> = ({
  className = "",
  size = "md",
}) => {
  const sizeClasses = {
    xs: "text-xs",
    sm: "text-sm",
    md: "text-base sm:text-lg",
    lg: "text-xl sm:text-2xl",
  }[size];

  return (
    <span
      className={`font-bold tracking-tight inline-block select-none text-slate-900 dark:text-white ${sizeClasses} ${className}`}
    >
      GhostGuard
    </span>
  );
};
