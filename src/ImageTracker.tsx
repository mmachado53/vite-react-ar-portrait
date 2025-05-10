import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import 'aframe';
import {MindARThree} from 'mind-ar/dist/mindar-image-three.prod.js';

const ImageTracker = ({ imageUrl, imageUrls = [] }:{imageUrl: string, imageUrls: string[]}) => {
  const containerRef = useRef(null);
  const [isImagesLoaded, setImagesLoaded] = useState(false);
  const texturesRef = useRef([]);
  const currentImageIndexRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const touchStartXRef = useRef(null);

  useEffect(() => {
    // Sistema de precarga de imágenes
    const preloadImages = async () => {
      const textureLoader = new THREE.TextureLoader();
      
      // Función para cargar una textura
      const loadTexture = (url) => {
        return new Promise((resolve, reject) => {
          textureLoader.load(
            url,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace; // Para un color correcto
              resolve(texture);
            },
            undefined, // onProgress callback
            (error) => {
              console.error('Error loading texture:', url, error);
              reject(error);
            }
          );
        });
      };
      
      try {
        if (imageUrls.length === 0) {
          console.warn('No image URLs provided. Using a default white texture.');
          texturesRef.current = [null]; // Usaremos una textura blanca por defecto
          setImagesLoaded(true);
          return;
        }
        
        // Cargar todas las texturas en paralelo
        const loadedTextures = await Promise.all(imageUrls.map(url => loadTexture(url)));
        texturesRef.current = loadedTextures;
        setImagesLoaded(true);
        console.log(`Successfully loaded ${loadedTextures.length} textures`);
      } catch (error) {
        console.error('Failed to preload textures:', error);
        // Fallback en caso de error
        texturesRef.current = [null];
        setImagesLoaded(true);
      }
    };
    
    // Iniciar precarga
    preloadImages();
  }, [imageUrls]);

  useEffect(() => {
    if (!isImagesLoaded) return;
    // Inicializar MindAR
    const mindarThree = new MindARThree({
      container: containerRef.current,
      imageTargetSrc: imageUrl
    });
    
    const { renderer, scene, camera } = mindarThree;
    const anchor = mindarThree.addAnchor(0);
    
    // Configuración de tamaños
    const planeWidth = 1;
    const planeHeight = 0.665;
    
    // Crear grupo para contener el plano y sus sombras
    const contentGroup = new THREE.Group();
    contentGroup.visible = false; // Inicialmente oculto
    contentGroup.name = "ContentGroup";
    contentGroup.userData.opacity = 0; // Guardar estado de opacidad
    anchor.group.add(contentGroup);
    
    // Crear sombra suave tipo Apple con múltiples capas
    const createAppleShadow = (width, height, layers = 30) => {
      const shadowGroup = new THREE.Group();
      shadowGroup.name = "AppleShadowGroup";
      
      const maxScale = 3;
      
      for (let i = 0; i < layers; i++) {
        const scaleFactor = 1 + ((maxScale - 1) * (i / layers));
        const baseOpacity = 0.12 * (1 - (i / layers));
        
        const layerGeometry = new THREE.PlaneGeometry(
          width * scaleFactor, 
          height * scaleFactor
        );
        
        const shadowMaterial = new THREE.MeshBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0,
          depthTest: false,
        });
        
        shadowMaterial.userData = { baseOpacity };
        
        const shadowLayer = new THREE.Mesh(layerGeometry, shadowMaterial);
        shadowLayer.position.z = -0.001 - (i * 0.0001);
        shadowGroup.add(shadowLayer);
      }
      
      return shadowGroup;
    };
    const texture = new THREE.TextureLoader().load('/shadow.png');
    const shadowMaterial1 = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0, // Inicialmente transparente
    });
    // Crear y añadir el grupo de sombras
    const shadowGroup = createAppleShadow(planeWidth, planeHeight, 30);
    const shadowGeometry = new THREE.PlaneGeometry(
      planeWidth * 3, // 20% más grande para incluir la sombra
      planeHeight * 3
    );
    const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial1);
    shadowPlane.position.z =  -0.001; // Colocar ligeramente detrás del plano principal
    contentGroup.add(shadowPlane);


    // white frame
    const whiteLayerGeometry = new THREE.PlaneGeometry(
      planeWidth * 1.03, 
      planeHeight * 1.03
    );
    
    const whiteLayerGeometryMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
    });

    const whiteLayerPlane = new THREE.Mesh(whiteLayerGeometry, whiteLayerGeometryMaterial);
    whiteLayerPlane.position.z = -0.001; // Colocar ligeramente detrás del plano principal
    whiteLayerPlane.name = "WhiteLayerPlane";
    contentGroup.add(whiteLayerPlane);


    //  contentGroup.add(shadowGroup);
    
    // Crear material para el plano principal - con la primera imagen o blanco si no hay imágenes
    const mainMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    
    // Asignar la primera textura si está disponible
    if (texturesRef.current.length > 0 && texturesRef.current[0]) {
      mainMaterial.map = texturesRef.current[0];
      mainMaterial.needsUpdate = true;
    }
    
    // Crear el plano principal
    const mainGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    const mainPlane = new THREE.Mesh(mainGeometry, mainMaterial);
    mainPlane.name = "PlanoPrincipal";
    contentGroup.add(mainPlane);

    // Función de transición ease-in
    const easeIn = (t) => {
      return t * t;
    };

    // Función para cambiar a la siguiente imagen con animación
    const changeImage = (nextIndex, duration = 200) => {
      if (isTransitioningRef.current || texturesRef.current.length <= 1) return;
      isTransitioningRef.current = true;
      
      if (nextIndex < 0) nextIndex = texturesRef.current.length - 1;
      if (nextIndex >= texturesRef.current.length) nextIndex = 0;
      
      const nextTexture = texturesRef.current[nextIndex];
      if (!nextTexture) {
        isTransitioningRef.current = false;
        return;
      }
      
      // Fade out
      const startTime = Date.now();
      const startOpacity = mainMaterial.opacity;
      
      const animateFadeOut = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeIn(progress);
        const newOpacity = startOpacity * (1 - easedProgress);
        
        mainMaterial.opacity = newOpacity;
        
        if (progress < 1) {
          requestAnimationFrame(animateFadeOut);
        } else {
          // Cambiar textura
          mainMaterial.map = nextTexture;
          mainMaterial.needsUpdate = true;
          currentImageIndexRef.current = nextIndex;
          
          // Iniciar fade in
          const fadeInStart = Date.now();
          
          const animateFadeIn = () => {
            const elapsedFadeIn = Date.now() - fadeInStart;
            const progressFadeIn = Math.min(elapsedFadeIn / duration, 1);
            const easedProgressFadeIn = easeIn(progressFadeIn);
            
            mainMaterial.opacity = startOpacity * easedProgressFadeIn;
            
            if (progressFadeIn < 1) {
              requestAnimationFrame(animateFadeIn);
            } else {
              isTransitioningRef.current = false;
            }
          };
          
          animateFadeIn();
        }
      };
      
      animateFadeOut();
    };

    // Función para animación fadeIn al detectar la imagen
    const fadeIn = () => {
      const duration = 500; // 0.5 segundos
      const startTime = Date.now();
      
      contentGroup.visible = true;
      
      const animateFadeIn = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeIn(progress);
        
        // Actualizar opacidad del contenido
        contentGroup.userData.opacity = easedProgress;
        
        // Actualizar opacidad del plano principal
        mainMaterial.opacity = easedProgress;
        
        // Actualizar opacidad de cada capa de sombra
        shadowPlane.material.opacity = easedProgress;
        const baseShadowOpacity = shadowPlane.material.userData.baseOpacity;
        shadowPlane.material.opacity = 1 * easedProgress;
        /*shadowGroup.children.forEach(shadowLayer => {
          const baseShadowOpacity = shadowLayer.material.userData.baseOpacity;
          shadowLayer.material.opacity = baseShadowOpacity * easedProgress;
        });*/
        
        if (progress < 1) {
          requestAnimationFrame(animateFadeIn);
        }
      };
      
      animateFadeIn();
    };
    
    // Función para animación fadeOut al perder la imagen
    const fadeOut = () => {
      const duration = 500; // 0.5 segundos
      const startTime = Date.now();
      const startOpacity = contentGroup.userData.opacity;
      
      const animateFadeOut = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeIn(progress);
        const reverseProgress = 1 - easedProgress;
        const currentOpacity = startOpacity * reverseProgress;
        
        // Actualizar opacidades
        contentGroup.userData.opacity = currentOpacity;
        mainMaterial.opacity = currentOpacity;
        const baseShadowOpacity = shadowPlane.material.userData.baseOpacity;
        shadowPlane.material.opacity = baseShadowOpacity * currentOpacity;
        /*shadowGroup.children.forEach(shadowLayer => {
          const baseShadowOpacity = shadowLayer.material.userData.baseOpacity;
          shadowLayer.material.opacity = baseShadowOpacity * currentOpacity;
        }); */
        
        if (progress < 1) {
          requestAnimationFrame(animateFadeOut);
        } else {
          contentGroup.visible = false;
        }
      };
      
      animateFadeOut();
    };

    // Configurar eventos para MindAR
    anchor.onTargetFound = fadeIn;
    anchor.onTargetLost = fadeOut;
    
    // Configurar eventos de gestos táctiles para swipe
    const handleTouchStart = (e) => {
      touchStartXRef.current = e.touches[0].clientX;
    };
    
    const handleTouchEnd = (e) => {
      if (touchStartXRef.current === null) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchEndX - touchStartXRef.current;
      
      // Determinar dirección del swipe (requiere mínimo desplazamiento de 50px)
      if (Math.abs(diffX) > 50) {
        if (diffX > 0) {
          // Swipe derecha -> imagen anterior
          changeImage(currentImageIndexRef.current - 1);
        } else {
          // Swipe izquierda -> imagen siguiente
          changeImage(currentImageIndexRef.current + 1);
        }
      }
      
      touchStartXRef.current = null;
    };
    
    // Añadir event listeners para gestos táctiles
    containerRef.current.addEventListener('touchstart', handleTouchStart);
    containerRef.current.addEventListener('touchend', handleTouchEnd);

    // Iniciar el tracking y el loop de renderizado
    mindarThree.start();
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera);
    });

    // Limpieza al desmontar
    return () => {
      containerRef.current.removeEventListener('touchstart', handleTouchStart);
      containerRef.current.removeEventListener('touchend', handleTouchEnd);
      
      if (anchor) {
        anchor.onTargetFound = null;
        anchor.onTargetLost = null;
      }
      
      renderer.setAnimationLoop(null);
      // mindarThree.stop();
    }
  }, [isImagesLoaded, imageUrl]);

  return (
    <div style={{width: "100%", height: "100%"}} ref={containerRef}>
      {!isImagesLoaded && <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        color: 'white',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: '20px',
        borderRadius: '8px'
      }}>
        Cargando imágenes...
      </div>}
    </div>
  );
};

export default ImageTracker;

