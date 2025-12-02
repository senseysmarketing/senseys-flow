import * as React from "react";
import { cn } from "@/lib/utils";

interface AvatarFallbackColoredProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

// Generate a consistent color based on the name
function getColorFromName(name: string): string {
  const colors = [
    "from-blue-500 to-cyan-500",
    "from-purple-500 to-pink-500",
    "from-green-500 to-emerald-500",
    "from-orange-500 to-amber-500",
    "from-red-500 to-rose-500",
    "from-indigo-500 to-violet-500",
    "from-teal-500 to-green-500",
    "from-pink-500 to-rose-500",
    "from-amber-500 to-yellow-500",
    "from-cyan-500 to-blue-500",
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AvatarFallbackColored({
  name,
  size = "md",
  className,
}: AvatarFallbackColoredProps) {
  const initials = getInitials(name);
  const gradientColor = getColorFromName(name);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white shadow-md",
        gradientColor,
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
