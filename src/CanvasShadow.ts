interface ShadowTextureOptions {
  shadowBlur?: number;           // Intensidad del desenfoque (en píxeles)
  shadowColor?: string;         // Color de la sombra con transparencia
  backgroundColor?: string;     // Color de fondo del canvas
  borderRadius?: number;       // Radio de bordes redondeados (en píxeles)
  insetShadow?: boolean;       // Si true, la sombra será hacia adentro
  padding?: number;           // Espacio adicional para que la sombra no se corte
  elevation?: number;         // Desplazamiento vertical para simular elevación
  shadowOffsetX?: number;    // Desplazamiento horizontal de la sombra
  shadowOffsetY?: number;    // Desplazamiento vertical de la sombra
  quality?: number;          // Factor de calidad (1.0 = normal, >1.0 = mayor resolución)
}
import * as THREE from 'three';

export const generateShadowTexture = (width:number, height:number, options:ShadowTextureOptions = {}) => {
    // Opciones con valores por defecto
    const {
      shadowBlur = 20,           // Intensidad del desenfoque (en píxeles)
      shadowColor = 'rgba(0, 0, 0, 0.5)', // Color de la sombra con transparencia
      backgroundColor = 'rgba(0, 0, 0, 0)', // Color de fondo del canvas
      borderRadius = 0,          // Radio de bordes redondeados (en píxeles)
      insetShadow = false,       // Si true, la sombra será hacia adentro
      padding = 40,              // Espacio adicional para que la sombra no se corte
      elevation = 0,             // Desplazamiento vertical para simular elevación
      shadowOffsetX = 0,         // Desplazamiento horizontal de la sombra
      shadowOffsetY = elevation, // Desplazamiento vertical de la sombra
      quality = 1.0              // Factor de calidad (1.0 = normal, >1.0 = mayor resolución)
    } = options;
    
    // Aplicar factor de calidad a las dimensiones
    const scaledWidth = Math.round(width * quality);
    const scaledHeight = Math.round(height * quality);
    const scaledPadding = Math.round(padding * quality);
    const scaledBlur = Math.round(shadowBlur * quality);
    const scaledRadius = Math.round(borderRadius * quality);
    const scaledOffsetX = Math.round(shadowOffsetX * quality);
    const scaledOffsetY = Math.round(shadowOffsetY * quality);
    
    // Crear un canvas con dimensiones suficientes para incluir el blur y offset
    const canvas = document.createElement('canvas');
    const totalWidth = scaledWidth + (scaledPadding * 2);
    const totalHeight = scaledHeight + (scaledPadding * 2);
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    
    // Obtener contexto 2D
    const ctx = canvas.getContext('2d');
    if(!ctx) {
      throw new Error('No se pudo obtener el contexto 2D del canvas');
    }
    // Limpiar canvas con fondo transparente
    ctx.clearRect(0, 0, totalWidth, totalHeight);
    
    // Configurar sombra
    ctx.shadowBlur = scaledBlur;
    ctx.shadowColor = shadowColor;
    ctx.shadowOffsetX = scaledOffsetX;
    ctx.shadowOffsetY = scaledOffsetY;
    
    // Función helper para dibujar un rectángulo con esquinas redondeadas
    const roundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
      if (radius === 0) {
        ctx.rect(x, y, width, height);
        return;
      }
      
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };
    
    // Calcular la posición del rectángulo principal
    const rectX = scaledPadding;
    const rectY = scaledPadding;
    
    if (insetShadow) {
      // === SOMBRA INTERNA ===
      // Primero dibujamos un rectángulo completo
      ctx.beginPath();
      ctx.fillStyle = shadowColor;
      ctx.fillRect(0, 0, totalWidth, totalHeight);
      
      // Luego usamos 'destination-out' para cortar un hueco
      ctx.globalCompositeOperation = 'destination-out';
      ctx.shadowBlur = 0; // Desactivar sombra para el corte preciso
      ctx.beginPath();
      roundedRect(rectX, rectY, scaledWidth, scaledHeight, scaledRadius);
      ctx.fill();
      
      // Restaurar modo de composición y dibujar la sombra interna
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = scaledBlur;
      ctx.shadowColor = shadowColor;
      ctx.shadowOffsetX = -scaledOffsetX; // Invertir para sombra interna
      ctx.shadowOffsetY = -scaledOffsetY; // Invertir para sombra interna
      
      // Dibujar un rectángulo "invisible" que solo proyecta sombra hacia adentro
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0)'; // Color transparente
      roundedRect(rectX, rectY, scaledWidth, scaledHeight, scaledRadius);
      ctx.fill();
      
    } else {
      // === SOMBRA EXTERNA ===
      // Aplicar fondo si hay uno especificado
      if (backgroundColor !== 'rgba(0, 0, 0, 0)') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, totalWidth, totalHeight);
      }
      
      // Dibujar el rectángulo con sombra
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // Blanco para el área principal
      roundedRect(rectX, rectY, scaledWidth, scaledHeight, scaledRadius);
      ctx.fill();
    }
    
    // Crear una textura de Three.js desde el canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // Mejorar el anti-aliasing
    texture.anisotropy = 4;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    return { texture, canvas };
  };