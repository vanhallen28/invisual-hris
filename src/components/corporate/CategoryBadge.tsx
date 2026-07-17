// src/components/corporate/CategoryBadge.tsx
import type { Category } from "@/lib/corporate/types";
import { cn } from "@/lib/corporate/utils";

/**
 * Chip taksonomi yang diberi warna sesuai kategori (categories.color dari DB),
 * jadi badge konsisten di mana pun kategori muncul.
 */
export function CategoryBadge({
  category,
  className,
}: {
  category: Pick<Category, "name" | "color"> | null;
  className?: string;
}) {
  if (!category) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium text-gray-500",
          className,
        )}
      >
        Tanpa kategori
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: category.color,
        backgroundColor: `${category.color}1a`, // ~10% alpha
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: category.color }} />
      {category.name}
    </span>
  );
}
