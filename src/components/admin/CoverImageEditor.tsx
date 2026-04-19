import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Upload, RotateCcw, Replace, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import CampaignCover from "@/components/CampaignCover";
import {
  COVER_ASPECT,
  CropSettings,
  DEFAULT_CROP,
  parseCropSettings,
} from "@/lib/cropImage";
import { toast } from "sonner";

interface CoverImageEditorProps {
  /** Текущее изображение (URL). */
  imageUrl: string | null | undefined;
  /** Текущие crop_settings из БД (jsonb). */
  cropSettings: unknown;
  /** Новый файл, выбранный пользователем (ещё не загруженный). */
  pendingFile: File | null;
  /** Сообщает наверх о выборе нового файла. */
  onFileChange: (file: File | null) => void;
  /** Сообщает наверх о новых crop_settings. */
  onCropChange: (crop: CropSettings) => void;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

/**
 * Редактор обложки с drag + zoom и live preview "как на сайте".
 * - До загрузки нового файла редактирует существующее изображение.
 * - После выбора нового файла редактирует его (URL.createObjectURL).
 */
const CoverImageEditor = ({
  imageUrl,
  cropSettings,
  pendingFile,
  onFileChange,
  onCropChange,
}: CoverImageEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);

  // Локальное состояние редактора
  const initialCrop = useMemo(
    () => parseCropSettings(cropSettings) ?? DEFAULT_CROP,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [zoom, setZoom] = useState<number>(initialCrop.scale);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [areaPercent, setAreaPercent] = useState<{ x: number; y: number } | null>(
    initialCrop.x === 0 && initialCrop.y === 0 ? null : { x: initialCrop.x, y: initialCrop.y },
  );

  // Object URL для нового файла
  useEffect(() => {
    if (!pendingFile) {
      setPendingPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPendingPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const editingSrc = pendingPreview || imageUrl || null;

  // При смене источника сбрасываем zoom/положение
  useEffect(() => {
    if (pendingFile) {
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setAreaPercent({ x: 0, y: 0 });
      onCropChange({ ...DEFAULT_CROP, aspect: COVER_ASPECT });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFile]);

  /**
   * react-easy-crop отдаёт `croppedAreaPercentage`: { x, y, width, height } в %
   * относительно изображения. Нам нужно смещение центра кадра относительно центра
   * изображения, в % от стороны кадра — оно эквивалентно тому, как мы позже
   * применим transform к <img> на сайте.
   *
   * Идея: мы рендерим <img> в контейнере с aspect-ratio = COVER_ASPECT,
   * с object-fit: cover (центр) и применяем transform: translate(x%, y%) scale(zoom).
   * Поскольку <img> растянут на весь контейнер, проценты translate относительно
   * размера img == проценты относительно кадра.
   *
   * Связь:
   *   centerImageX% = croppedArea.x + croppedArea.width / 2
   *   offsetFromCenter% = (centerImageX% - 50) — но в системе координат изображения,
   *   а не контейнера. Чтобы сместить ВИДИМЫЙ центр кадра на этот пиксель,
   *   нужно сдвинуть изображение в обратную сторону на эту долю.
   *
   * После умножения на zoom (scale применяется к img) получаем итоговое
   * translate в % контейнера:
   *   tx% = -(centerImageX% - 50) * zoom
   *   ty% = -(centerImageY% - 50) * zoom
   */
  const onCropComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      // не используем pixels — нам нужны проценты
    },
    [],
  );

  const onCropAreaChange = useCallback(
    (croppedAreaPercentage: Area) => {
      const centerX = croppedAreaPercentage.x + croppedAreaPercentage.width / 2;
      const centerY = croppedAreaPercentage.y + croppedAreaPercentage.height / 2;
      const offX = -(centerX - 50) * zoom;
      const offY = -(centerY - 50) * zoom;
      setAreaPercent({ x: offX, y: offY });
      onCropChange({
        x: clamp(offX, -200, 200),
        y: clamp(offY, -200, 200),
        scale: zoom,
        aspect: COVER_ASPECT,
      });
    },
    [zoom, onCropChange],
  );

  const handlePickFile = (file: File | null) => {
    if (!file) {
      onFileChange(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Допустимы только JPEG, PNG и WebP");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Размер файла не должен превышать 5 МБ");
      return;
    }
    onFileChange(file);
  };

  const handleReset = () => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setAreaPercent({ x: 0, y: 0 });
    onCropChange({ ...DEFAULT_CROP, aspect: COVER_ASPECT });
  };

  const livePreviewCrop: CropSettings = {
    x: areaPercent?.x ?? 0,
    y: areaPercent?.y ?? 0,
    scale: zoom,
    aspect: COVER_ASPECT,
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handlePickFile(e.target.files?.[0] || null)}
      />

      {!editingSrc ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-foreground/30 hover:bg-secondary/50 transition-colors"
        >
          <Upload className="w-6 h-6" />
          <span className="text-sm font-medium">Загрузить обложку</span>
          <span className="text-xs">JPEG, PNG, WebP · до 5 МБ · соотношение 16:9</span>
        </button>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Editor */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Кадрирование
            </p>
            <div
              className="relative w-full bg-secondary rounded-xl overflow-hidden"
              style={{ aspectRatio: String(COVER_ASPECT) }}
            >
              <Cropper
                image={editingSrc}
                crop={crop}
                zoom={zoom}
                aspect={COVER_ASPECT}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                onCropAreaChange={onCropAreaChange}
                showGrid
                objectFit="cover"
                restrictPosition={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.01}
                onValueChange={([v]) => setZoom(v)}
                className="flex-1"
              />
              <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                {zoom.toFixed(2)}x
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                <Replace className="w-4 h-4" />
                Заменить
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4" />
                Сбросить
              </Button>
              {pendingFile && (
                <span className="text-xs text-muted-foreground self-center ml-auto truncate max-w-[180px]">
                  {pendingFile.name}
                </span>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Превью на сайте
            </p>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">Hero на странице сбора (12:5)</p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <CampaignCover
                    src={editingSrc}
                    alt="Превью hero"
                    crop={livePreviewCrop}
                    aspect={12 / 5}
                    className="rounded-none"
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1.5">Карточка в списке (16:9)</p>
                <div className="rounded-xl border border-border overflow-hidden max-w-[260px]">
                  <CampaignCover
                    src={editingSrc}
                    alt="Превью карточки"
                    crop={livePreviewCrop}
                    className="rounded-none"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Так обложка будет выглядеть на странице сбора и в карточках.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default CoverImageEditor;
