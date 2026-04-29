import { cn } from "@/lib/utils";

interface ResponsiveImageProps {
  /** URL картинки для маленьких экранов (≤ 640px). Должен быть webp/avif. */
  mobileSrc: string;
  /** URL картинки для больших экранов. */
  desktopSrc: string;
  /** Fallback на случай отсутствия webp-поддержки (jpg/png). Опционально. */
  fallbackSrc?: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "async" | "sync" | "auto";
  sizes?: string;
  /** Точка переключения mobile→desktop, по умолчанию 640px. */
  breakpoint?: number;
}

/**
 * Лёгкий <picture> с двумя источниками: маленький webp для мобильных
 * и большой для десктопа. Всегда задаёт width/height — без layout shift.
 */
const ResponsiveImage = ({
  mobileSrc,
  desktopSrc,
  fallbackSrc,
  alt,
  width,
  height,
  className,
  loading = "lazy",
  fetchPriority = "auto",
  decoding = "async",
  sizes,
  breakpoint = 640,
}: ResponsiveImageProps) => (
  <picture>
    <source
      media={`(min-width: ${breakpoint + 1}px)`}
      srcSet={desktopSrc}
      type="image/webp"
    />
    <source srcSet={mobileSrc} type="image/webp" />
    <img
      src={fallbackSrc ?? mobileSrc}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
      // @ts-expect-error fetchpriority is a valid HTML attr
      fetchpriority={fetchPriority}
      sizes={sizes}
      className={cn(className)}
    />
  </picture>
);

export default ResponsiveImage;