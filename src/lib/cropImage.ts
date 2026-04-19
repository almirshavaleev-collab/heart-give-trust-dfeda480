/**
 * Утилиты для работы с настройками кадрирования обложки сбора.
 *
 * Стратегия:
 *  - В админке используется react-easy-crop (drag + zoom).
 *  - Мы НЕ обрезаем картинку перед загрузкой в Storage — сохраняем оригинал
 *    + JSON-настройки (x%, y% offset от центра, scale, aspect).
 *  - На сайте все обложки рендерятся через единый <CampaignCover />,
 *    который применяет crop через CSS transform внутри контейнера
 *    с фиксированным aspect-ratio. Это даёт идентичный результат и в админ-превью,
 *    и на публичной странице.
 *
 * Базовое поведение, если crop_settings отсутствует:
 *  - object-cover, центр (как сейчас).
 */

export interface CropSettings {
  /** Смещение по X в процентах от центра, диапазон [-100, 100]. */
  x: number;
  /** Смещение по Y в процентах от центра, диапазон [-100, 100]. */
  y: number;
  /** Масштаб >= 1. */
  scale: number;
  /** Соотношение сторон рамки кадрирования (ширина / высота). */
  aspect: number;
}

/** Соотношение сторон обложки сбора — единое во всех местах сайта. */
export const COVER_ASPECT = 16 / 9;

export const DEFAULT_CROP: CropSettings = {
  x: 0,
  y: 0,
  scale: 1,
  aspect: COVER_ASPECT,
};

export function parseCropSettings(value: unknown): CropSettings | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const x = Number(v.x);
  const y = Number(v.y);
  const scale = Number(v.scale);
  const aspect = Number(v.aspect);
  if (![x, y, scale].every((n) => Number.isFinite(n))) return null;
  return {
    x: clamp(x, -100, 100),
    y: clamp(y, -100, 100),
    scale: Math.max(1, Number.isFinite(scale) ? scale : 1),
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : COVER_ASPECT,
  };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Преобразование результата react-easy-crop в наши настройки.
 * react-easy-crop отдаёт `crop = { x, y }` (px-смещения) и `zoom`.
 * Мы нормализуем смещение в проценты от стороны рамки, чтобы
 * результат не зависел от размера превью в админке.
 */
export interface EasyCropResult {
  cropPercent: { x: number; y: number };
  zoom: number;
}

export function buildCropSettings({ cropPercent, zoom }: EasyCropResult, aspect: number): CropSettings {
  return {
    x: clamp(cropPercent.x, -100, 100),
    y: clamp(cropPercent.y, -100, 100),
    scale: Math.max(1, zoom),
    aspect,
  };
}

/**
 * CSS-стили для применения crop к <img> внутри контейнера с заданным aspect-ratio.
 * Контейнер должен быть `overflow-hidden` и `relative`, изображение —
 * `absolute inset-0 w-full h-full`.
 */
export function getCoverImageStyle(crop: CropSettings | null): React.CSSProperties {
  if (!crop) {
    return { objectFit: "cover", objectPosition: "center" };
  }
  // x/y в процентах от центра кадра. translate работает относительно
  // размера самого <img>, а так как img растянут на 100% контейнера,
  // проценты эквивалентны процентам кадра.
  return {
    objectFit: "cover",
    objectPosition: "center",
    transform: `translate(${crop.x}%, ${crop.y}%) scale(${crop.scale})`,
    transformOrigin: "center",
    willChange: "transform",
  };
}
