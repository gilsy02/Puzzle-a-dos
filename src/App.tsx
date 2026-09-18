import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sun,
  Moon,
  Upload,
  RotateCcw,
  Eye,
  EyeOff,
  Trophy,
  AlertCircle,
  ImageIcon,
  X
} from 'lucide-react';

type GridSize = 4 | 8;

interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
}

// Genera una imagen de muestra colorida y nítida para pruebas inmediatas
function generateSamplePattern(): ProcessedImage {
  const width = 800;
  const height = 600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', width: 800, height: 600 };

  // Fondo degradado
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#0284c7');
  grad.addColorStop(0.5, '#0d9488');
  grad.addColorStop(1, '#ea580c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Formas decorativas
  const colors = ['#fde047', '#f43f5e', '#a855f7', '#38bdf8', '#4ade80'];
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    const x = (i * 173) % (width - 100) + 50;
    const y = (i * 241) % (height - 100) + 50;
    const r = 35 + (i * 7) % 50;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // Cuadro central con texto
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(width / 2 - 160, height / 2 - 50, 320, 100);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Puzzle a Dos', width / 2, height / 2);

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width,
    height,
  };
}

// Procesa la imagen corrigiendo orientación EXIF, escalando a máx 1280px y conservando proporción exacta
async function processImage(file: File): Promise<ProcessedImage> {
  if (typeof window.createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const sourceWidth = bitmap.width;
      const sourceHeight = bitmap.height;

      if (sourceWidth > 0 && sourceHeight > 0) {
        const maxDim = 1280;
        const longest = Math.max(sourceWidth, sourceHeight);
        const scale = longest > maxDim ? maxDim / longest : 1;
        const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          bitmap.close();
          throw new Error('No se pudo inicializar el lienzo.');
        }

        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
        bitmap.close();

        return {
          dataUrl: canvas.toDataURL('image/jpeg', 0.92),
          width: targetWidth,
          height: targetHeight,
        };
      }
    } catch {
      // Fallback si createImageBitmap falla
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;

        if (!sourceWidth || !sourceHeight) {
          reject(new Error('No se pudo leer esta imagen. Prueba con otra foto.'));
          return;
        }

        const maxDim = 1280;
        const longest = Math.max(sourceWidth, sourceHeight);
        const scale = longest > maxDim ? maxDim / longest : 1;
        const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
        const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo leer esta imagen. Prueba con otra foto.'));
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.92),
          width: targetWidth,
          height: targetHeight,
        });
      };
      img.onerror = () => reject(new Error('No se pudo leer esta imagen. Prueba con otra foto.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('No se pudo leer esta imagen. Prueba con otra foto.'));
    reader.readAsDataURL(file);
  });
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  // Tema con persistencia en localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('puzzle_a_dos_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('puzzle_a_dos_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Estados del rompecabezas
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [imageSrc, setImageSrc] = useState<string>('');
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });
  const [imageInfo, setImageInfo] = useState<{ name: string; sizeKb: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Partida
  const [pieces, setPieces] = useState<number[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [moves, setMoves] = useState<number>(0);
  const [seconds, setSeconds] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);

  // Referencias para medición del contenedor y cálculo exacto de escala
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 500,
    height: 500,
  });

  const fileInputRefDesktop = useRef<HTMLInputElement>(null);
  const fileInputRefMobile = useRef<HTMLInputElement>(null);

  // Mezclar piezas asegurando que no empiece resuelto
  const shufflePieces = useCallback((size: GridSize) => {
    const total = size * size;
    const array = Array.from({ length: total }, (_, i) => i);

    let isIdentical = true;
    while (isIdentical) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      isIdentical = array.every((val, idx) => val === idx);
    }

    return array;
  }, []);

  // Inicializar muestra y mezclar piezas
  useEffect(() => {
    const sample = generateSamplePattern();
    if (sample && sample.dataUrl) {
      setImageSrc(sample.dataUrl);
      setImageDimensions({ width: sample.width, height: sample.height });
      setImageInfo({ name: 'Muestra_Predefinida.jpg', sizeKb: 120 });
      setPieces(shufflePieces(gridSize));
    }
  }, [shufflePieces, gridSize]);

  // Temporizador de partida
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (!isCompleted) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCompleted]);

  // Detección reactiva de modo horizontal vs modo vertical
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia(
      '(orientation: landscape) and (min-aspect-ratio: 1/1), (min-width: 900px) and (min-aspect-ratio: 10/9)'
    ).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(
      '(orientation: landscape) and (min-aspect-ratio: 1/1), (min-width: 900px) and (min-aspect-ratio: 10/9)'
    );
    const updateOrientation = () => {
      setIsLandscape(mql.matches);
    };

    mql.addEventListener('change', updateOrientation);
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      mql.removeEventListener('change', updateOrientation);
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // Medir contenedor dinámicamente con ResizeObserver
  useEffect(() => {
    const container = boardContainerRef.current;
    if (!container) return;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [showOriginal, isLandscape]);

  // Validar y cargar imagen seleccionada
  const handleFile = async (file: File) => {
    setErrorMessage('');
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Formato no admitido. Selecciona una imagen JPG, PNG o WebP.');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      setErrorMessage('La imagen supera el límite permitido de 5 MB.');
      return;
    }

    try {
      const processed = await processImage(file);
      setImageSrc(processed.dataUrl);
      setImageDimensions({ width: processed.width, height: processed.height });
      setImageInfo({
        name: file.name,
        sizeKb: Math.round(file.size / 1024),
      });
      // Reiniciar partida con la nueva foto
      setPieces(shufflePieces(gridSize));
      setSelectedIdx(null);
      setMoves(0);
      setSeconds(0);
      setIsCompleted(false);
    } catch {
      setErrorMessage('No se pudo leer esta imagen. Prueba con otra foto.');
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Reiniciar partida actual
  const restartGame = useCallback(() => {
    setPieces(shufflePieces(gridSize));
    setSelectedIdx(null);
    setMoves(0);
    setSeconds(0);
    setIsCompleted(false);
  }, [gridSize, shufflePieces]);

  // Cambiar tamaño de cuadrícula
  const handleGridChange = (size: GridSize) => {
    if (size === gridSize) return;
    setGridSize(size);
    setPieces(shufflePieces(size));
    setSelectedIdx(null);
    setMoves(0);
    setSeconds(0);
    setIsCompleted(false);
  };

  // Intercambiar piezas
  const handlePieceClick = (clickedIdx: number) => {
    if (isCompleted) return;

    if (selectedIdx === null) {
      setSelectedIdx(clickedIdx);
      return;
    }

    if (selectedIdx === clickedIdx) {
      setSelectedIdx(null);
      return;
    }

    const newPieces = [...pieces];
    const temp = newPieces[selectedIdx];
    newPieces[selectedIdx] = newPieces[clickedIdx];
    newPieces[clickedIdx] = temp;

    setPieces(newPieces);
    setMoves((m) => m + 1);
    setSelectedIdx(null);

    const solved = newPieces.every((val, idx) => val === idx);
    if (solved) {
      setIsCompleted(true);
    }
  };

  // Cálculo visible exacto según fórmula requerida:
  // scale = min(anchoDisponible / anchoFoto, altoDisponible / altoFoto)
  // anchoVisible = anchoFoto * scale
  // altoVisible = altoFoto * scale
  const paddingBuffer = 8;
  const anchoDisponible = Math.max(60, containerSize.width - paddingBuffer);
  const altoDisponible = Math.max(60, containerSize.height - paddingBuffer);
  const anchoFoto = imageDimensions.width || 800;
  const altoFoto = imageDimensions.height || 600;

  const scale = Math.min(anchoDisponible / anchoFoto, altoDisponible / altoFoto);
  const anchoVisible = Math.max(60, Math.floor(anchoFoto * scale));
  const altoVisible = Math.max(60, Math.floor(altoFoto * scale));

  return (
    <div
      id="puzzle-app-container"
      className="app-layout-root bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 font-sans transition-colors duration-200"
    >
      {/* ========================================================
          1. CELULAR Y TABLETA VERTICAL - Barra Superior Compacta
          Orden 1: Título, Claro/Oscuro, Movimientos, Tiempo
          ======================================================== */}
      <header
        id="mobile-top-bar"
        className="mobile-only w-full border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 items-center justify-between z-20 shrink-0 shadow-xs h-11"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            P2
          </div>
          <h1 className="text-sm sm:text-base font-bold tracking-tight">Puzzle a Dos</h1>
        </div>

        {/* Movimientos y Tiempo */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase text-neutral-500 font-semibold leading-none">
              Mov.
            </span>
            <span className="font-bold text-teal-600 dark:text-teal-400 leading-tight">{moves}</span>
          </div>
          <div className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-700" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase text-neutral-500 font-semibold leading-none">
              Tiempo
            </span>
            <span className="font-bold font-mono leading-tight">{formatTime(seconds)}</span>
          </div>
        </div>

        {/* Claro / Oscuro */}
        <div className="flex items-center gap-0.5 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
              theme === 'light'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span>Claro</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
              theme === 'dark'
                ? 'bg-neutral-700 text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-200 dark:text-neutral-400'
            }`}
          >
            <Moon className="w-3 h-3" />
            <span>Oscuro</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          2. COMPUTADORA, TABLETA Y CELULAR HORIZONTAL - Panel Lateral de Controles
          Ancho optimizado: 210-280px con scroll interno.
          Controles: título, subir imagen, cuadrícula 4x4/8x8, Claro/Oscuro,
          movimientos, tiempo, Reiniciar, Ver imagen original.
          ======================================================== */}
      <aside
        id="desktop-controls-panel"
        className="desktop-only w-[210px] sm:w-[240px] md:w-[280px] shrink-0 h-full border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2.5 sm:p-4 flex flex-col justify-between overflow-y-auto z-20 shadow-xs text-xs"
      >
        <div className="space-y-2 sm:space-y-3.5">
          {/* Título y Selector Claro/Oscuro */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs shrink-0">
                P2
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold tracking-tight leading-tight truncate">
                  Puzzle a Dos
                </h1>
                <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  Arma e intercambia piezas
                </p>
              </div>
            </div>

            <div
              id="desktop-theme-selector"
              className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  theme === 'light'
                    ? 'bg-white text-neutral-900 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <Sun className="w-3 h-3" />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  theme === 'dark'
                    ? 'bg-neutral-700 text-white shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <Moon className="w-3 h-3" />
                <span>Oscuro</span>
              </button>
            </div>
          </div>

          {/* Estadísticas: Movimientos y Tiempo */}
          <div
            id="desktop-stats-card"
            className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60"
          >
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                Mov.
              </span>
              <span className="text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400 leading-tight">
                {moves}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">
                Tiempo
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 leading-tight">
                {formatTime(seconds)}
              </span>
            </div>
          </div>

          {/* Banner de victoria "¡Lo lograste!" si se resolvió */}
          {isCompleted && (
            <div
              id="desktop-victory-banner"
              className="p-2 sm:p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-500 text-emerald-800 dark:text-emerald-200 text-center space-y-1 animate-in fade-in"
            >
              <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm">
                <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>¡Lo lograste!</span>
              </div>
              <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-300">
                Resuelto en {formatTime(seconds)} y {moves} movs.
              </p>
            </div>
          )}

          {/* Errores si existen */}
          {errorMessage && (
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Subir imagen */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
              Imagen (JPG, PNG, WebP)
            </label>
            <input
              ref={fileInputRefDesktop}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileInputChange}
              className="hidden"
            />
            <button
              type="button"
              id="desktop-upload-btn"
              onClick={() => fileInputRefDesktop.current?.click()}
              className="w-full py-1.5 px-2.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-teal-500 bg-neutral-50 dark:bg-neutral-800/40 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>Subir imagen</span>
            </button>
            <div className="flex items-center justify-between text-[10px] text-neutral-500 px-0.5">
              <span className="truncate max-w-[120px]">{imageInfo?.name || 'Muestra'}</span>
              <span>{imageDimensions.width}×{imageDimensions.height}</span>
            </div>
          </div>

          {/* Selector de cuadrícula: 4x4 y 8x8 */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 block">
              Cuadrícula
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="desktop-grid-4x4"
                onClick={() => handleGridChange(4)}
                className={`py-1.5 px-2 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer ${
                  gridSize === 4
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 ring-1 ring-teal-600'
                    : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                4x4
              </button>
              <button
                type="button"
                id="desktop-grid-8x8"
                onClick={() => handleGridChange(8)}
                className={`py-1.5 px-2 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer ${
                  gridSize === 8
                    ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 ring-1 ring-teal-600'
                    : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                8x8
              </button>
            </div>
          </div>
        </div>

        {/* Acciones inferiores de panel: Reiniciar y Ver original */}
        <div className="space-y-1.5 pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            id="desktop-toggle-original-btn"
            onClick={() => setShowOriginal((prev) => !prev)}
            className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              showOriginal
                ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            {showOriginal ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showOriginal ? 'Ocultar original' : 'Ver original'}</span>
          </button>

          <button
            type="button"
            id="desktop-restart-btn"
            onClick={restartGame}
            className="w-full py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar partida</span>
          </button>
        </div>
      </aside>

      {/* ========================================================
          3. ÁREA PRINCIPAL: Original + Rompecabezas
          En horizontal:
          - Fila horizontal: [Foto original (izq)] [Rompecabezas (der)]
          - Ambos centrados verticalmente, caben completos en la ventana.
          En vertical:
          - Rompecabezas centrado ocupando el espacio disponible
          - Foto original debajo (si se activa) sin tapar piezas
          - Todo contenido en 100dvh sin scroll
          ======================================================== */}
      <main
        id="main-puzzle-stage"
        className="flex-1 min-h-0 min-w-0 w-full h-full flex items-center justify-center p-1 sm:p-2.5 gap-2 sm:gap-4 overflow-hidden relative"
      >
        {/* Panel de Foto Original (A la izquierda del rompecabezas en horizontal, debajo en vertical) */}
        {showOriginal && (
          <div
            id="original-panel"
            className="flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-xl bg-white/85 dark:bg-neutral-900/85 border border-neutral-200 dark:border-neutral-800 shadow-xs shrink-0 transition-all max-w-full"
          >
            <div className="flex items-center justify-between w-full pb-0.5 px-1 text-[10px] font-bold text-neutral-500 dark:text-neutral-400">
              <span>Foto original</span>
              <button
                type="button"
                onClick={() => setShowOriginal(false)}
                className="p-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                title="Cerrar vista original"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <img
              src={imageSrc}
              alt="Foto original completa"
              style={{
                maxHeight: isLandscape ? 'calc(100dvh - 36px)' : '16vh',
                maxWidth: '100%',
                objectFit: 'contain',
              }}
              className="rounded-md shadow-xs"
            />
          </div>
        )}

        {/* Contenedor y Tablero del Rompecabezas */}
        <div
          ref={boardContainerRef}
          id="puzzle-wrapper"
          className="flex-1 min-h-0 min-w-0 w-full h-full flex flex-col items-center justify-center relative overflow-hidden"
        >
          <div
            id="puzzle-board"
            style={{
              width: `${anchoVisible}px`,
              height: `${altoVisible}px`,
              maxHeight: '100%',
              maxWidth: '100%',
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
            }}
            className="p-1 sm:p-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-xl sm:rounded-2xl shadow-md grid gap-0.5 sm:gap-1 select-none touch-manipulation transition-all duration-150"
          >
            {pieces.map((pieceId, idx) => {
              const origRow = Math.floor(pieceId / gridSize);
              const origCol = pieceId % gridSize;
              const isSelected = selectedIdx === idx;
              const isCorrect = pieceId === idx;

              const posX = (origCol / (gridSize - 1)) * 100;
              const posY = (origRow / (gridSize - 1)) * 100;

              return (
                <button
                  key={idx}
                  id={`piece-slot-${idx}`}
                  type="button"
                  onClick={() => handlePieceClick(idx)}
                  style={{
                    backgroundImage: `url(${imageSrc})`,
                    backgroundSize: `${gridSize * 100}% ${gridSize * 100}%`,
                    backgroundPosition: `${posX}% ${posY}%`,
                  }}
                  className={`relative w-full h-full rounded-xs sm:rounded-md transition-all duration-100 overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'ring-3 sm:ring-4 ring-amber-400 dark:ring-amber-300 scale-95 z-20 shadow-md'
                      : 'hover:brightness-105 active:scale-95'
                  } ${isCompleted ? 'cursor-default ring-1 ring-emerald-500/50' : ''}`}
                >
                  <span className="absolute inset-0 border border-black/15 pointer-events-none rounded-xs sm:rounded-md" />
                  {isCorrect && !isCompleted && gridSize === 4 && (
                    <span className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500/80 pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Mensaje de completado en móvil / vertical (flotante sin alterar el flujo de altura) */}
          {isCompleted && (
            <div
              id="mobile-victory-card"
              className="mobile-only absolute top-1.5 z-30 p-1.5 px-3 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md backdrop-blur-xs animate-in fade-in"
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>¡Lo lograste! ({moves} movs. en {formatTime(seconds)})</span>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================
          4. CELULAR Y TABLETA VERTICAL - Controles Inferiores Compactos
          Orden 4: Subir imagen, 4x4/8x8, Reiniciar, Ver imagen original
          ======================================================== */}
      <footer
        id="mobile-bottom-controls"
        className="mobile-only w-full border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-1.5 sm:px-3 sm:py-2 flex flex-col gap-1 shrink-0 z-20 shadow-xs h-14"
      >
        {/* Error si existe */}
        {errorMessage && (
          <div className="p-1 px-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-300 text-rose-700 text-[10px] flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">{errorMessage}</span>
          </div>
        )}

        <input
          ref={fileInputRefMobile}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileInputChange}
          className="hidden"
        />

        <div className="grid grid-cols-4 gap-1.5 w-full h-full">
          {/* Subir imagen */}
          <button
            type="button"
            id="mobile-upload-btn"
            onClick={() => fileInputRefMobile.current?.click()}
            className="h-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-[10px] font-semibold flex flex-col items-center justify-center text-neutral-800 dark:text-neutral-200"
          >
            <Upload className="w-3 h-3 text-teal-600" />
            <span className="truncate leading-tight">Subir</span>
          </button>

          {/* Cuadrícula 4x4 / 8x8 */}
          <button
            type="button"
            id="mobile-grid-toggle-btn"
            onClick={() => handleGridChange(gridSize === 4 ? 8 : 4)}
            className="h-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-[10px] font-semibold flex flex-col items-center justify-center text-neutral-800 dark:text-neutral-200"
          >
            <span className="font-bold text-teal-600 leading-none">{gridSize}x{gridSize}</span>
            <span className="text-[9px] text-neutral-500 leading-tight">Cambiar</span>
          </button>

          {/* Ver imagen original */}
          <button
            type="button"
            id="mobile-toggle-original-btn"
            onClick={() => setShowOriginal((prev) => !prev)}
            className={`h-full rounded-lg border text-[10px] font-semibold flex flex-col items-center justify-center transition-colors ${
              showOriginal
                ? 'bg-teal-600 border-teal-600 text-white'
                : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200'
            }`}
          >
            {showOriginal ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span className="truncate leading-tight">{showOriginal ? 'Ocultar' : 'Original'}</span>
          </button>

          {/* Reiniciar */}
          <button
            type="button"
            id="mobile-restart-btn"
            onClick={restartGame}
            className="h-full rounded-lg bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white text-[10px] font-bold flex flex-col items-center justify-center shadow-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="truncate leading-tight">Reiniciar</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
