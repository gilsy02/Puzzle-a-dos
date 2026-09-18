# Puzzle a Dos — Fase 1 (MVP Local)

Rompecabezas local de imagen para una sola persona desarrollado con React, TypeScript y Vite.

## Características de Fase 1
- **Local y Seguro**: Procesamiento 100% en el navegador mediante HTML5 Canvas. Ninguna imagen se sube a internet.
- **Soporte de formatos**: JPG, PNG y WebP con validación de tamaño máximo (5 MB).
- **Recorte centrado automático**: Formato cuadrado sin deformación de proporciones.
- **Cuadrículas disponibles**: 4x4 (16 piezas) y 8x8 (64 piezas).
- **Mecánica de intercambio (Swap)**: Clic o toque en dos piezas para intercambiarlas (compatible con mouse y pantallas táctiles).
- **Control de partida**: Contador de movimientos, cronómetro en tiempo real, botón para reiniciar y botón para ver la imagen original de referencia.
- **Condición de victoria**: Detección automática y mensaje de felicitación "¡Lo lograste!" con estadísticas finales.
- **Temas**: Botones visibles "Claro" y "Oscuro" con persistencia en `localStorage`.
- **Idioma**: Español de México (es-MX).

## Requisitos previos
- Node.js 18+ (o superior)
- npm 9+ (o superior)

## Instalación y ejecución

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

3. **Verificación de tipos y linting**:
   ```bash
   npm run lint
   ```

4. **Compilar para producción**:
   ```bash
   npm run build
   ```

5. **Previsualizar compilación de producción**:
   ```bash
   npm run preview
   ```
