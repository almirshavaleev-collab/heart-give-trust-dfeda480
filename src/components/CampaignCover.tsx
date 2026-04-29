import { CropSettings, COVER_ASPECT, getCoverImageStyle, parseCropSettings } from "@/lib/cropImage";
import { cn } from "@/lib/utils";

interface CampaignCoverProps {
  src: string | null | undefined;
  alt: string;
  /** Сырые crop_settings из БД (jsonb). */
  cropSettings?: unknown;
  /** Если задано — используется этот объект напрямую (для live preview в админке). */
  crop?: CropSettings | null;
  /** Соотношение сторон контейнера. По умолчанию COVER_ASPECT (16:9). */
  aspect?: number;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "sync" | "auto";
  sizes?: string;
  fetchPriority?: "high" | "low" | "auto";
  /** Контент поверх обложки (например, badge "Сбор завершён"). */
  children?: React.ReactNode;
  /** Заглушка, если src отсутствует. */
  placeholder?: React.ReactNode;
}

/**
 * Универсальный компонент обложки сбора. Поддерживает crop_settings из БД.
 * Применяется во ВСЕХ местах сайта, где показывается обложка кампании,
 * чтобы кадрирование, настроенное в админке, выглядело одинаково везде.
 */
const CampaignCover = ({
  src,
  alt,
  cropSettings,
  crop,
  aspect,
  className,
  imgClassName,
  loading = "lazy",
  decoding = "async",
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw",
  fetchPriority = "auto",
  children,
  placeholder,
}: CampaignCoverProps) => {
  const effectiveCrop =
    crop !== undefined ? crop : parseCropSettings(cropSettings);
  const style = getCoverImageStyle(effectiveCrop);
  const ratio = aspect ?? effectiveCrop?.aspect ?? COVER_ASPECT;

  return (
    <div
      className={cn("relative w-full overflow-hidden bg-secondary", className)}
      style={{ aspectRatio: String(ratio) }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          sizes={sizes}
          // @ts-expect-error fetchpriority is a valid HTML attr
          fetchpriority={fetchPriority}
          draggable={false}
          className={cn("absolute inset-0 w-full h-full select-none", imgClassName)}
          style={style}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          {placeholder ?? "Нет фото"}
        </div>
      )}
      {children}
    </div>
  );
};

export default CampaignCover;
