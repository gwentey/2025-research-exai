import { Component, ElementRef, OnInit, OnDestroy, Input, ViewChild, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Inject } from '@angular/core';

// Import Three.js modules
declare var THREE: any;

@Component({
  selector: 'app-login-background-animation',
  standalone: true,
  template: `
    <div class="animation-container" [class.mobile-fallback]="isMobile">
      <canvas #threeCanvas 
              class="three-canvas"
              [style.opacity]="canvasOpacity">
      </canvas>
      <div class="fallback-gradient" [style.opacity]="fallbackOpacity"></div>
    </div>
  `,
  styleUrls: ['./login-background-animation.component.scss']
})
export class LoginBackgroundAnimationComponent implements OnInit, OnDestroy {
  @ViewChild('threeCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  @Input() animationType: 'sorbonne-3d' | 'fallback' = 'sorbonne-3d';
  @Input() maxWidth: number = 600;
  @Input() height: number = 450;

  // Three.js variables
  private canvas!: HTMLCanvasElement;
  private renderer!: any;
  private scene!: any;
  private camera!: any;
  private rotatingGroup!: any;
  private controls!: any; // OrbitControls pour interaction souris
  private animationId!: number;
  private isAnimating = false;

  // Responsive et performance
  public isMobile = false;
  public canvasOpacity = 0;
  public fallbackOpacity = 1;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    console.log('🚀 LOGIN ANIMATION COMPONENT STARTING...');
    console.log('Platform:', this.platformId);
    console.log('Canvas ref:', this.canvasRef);
    
    if (isPlatformBrowser(this.platformId)) {
      console.log('✅ Platform is browser, proceeding...');
      this.checkMobileDevice();
      
      // FORCER l'animation même sur mobile pour debug
      console.log('🔧 FORCING Three.js load (debug mode)...');
      this.isMobile = false; // FORCER pour debug
      
      this.loadThreeJS();
    } else {
      console.log('❌ Not browser platform, showing fallback');
      this.showFallback();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private checkMobileDevice(): void {
    this.isMobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (this.isMobile) {
      // Sur mobile, on montre juste le gradient statique
      this.canvasOpacity = 0;
      this.fallbackOpacity = 1;
      return;
    }
  }

  private async loadThreeJS(): Promise<void> {
    console.log('🚀 Loading Three.js + OrbitControls as ES6 MODULES (EXACTLY like working example)...');
    if (this.isMobile) {
      console.log('📱 Mobile detected, skipping Three.js');
      return;
    }

    // Check WebGL support
    if (!this.isWebGLSupported()) {
      console.log('❌ WebGL not supported, showing fallback');
      this.showFallback();
      return;
    }

    try {
      // Load EVERYTHING as ES6 modules (EXACTLY like the working example)
      console.log('📦 Loading Three.js + OrbitControls as ES6 modules...');
      
      const moduleScript = document.createElement('script');
      moduleScript.type = 'module';
      moduleScript.innerHTML = `
        // Import EXACTLY like the working example
        import * as THREE from 'https://cdn.skypack.dev/three@0.136.0/build/three.module.js';
        import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
        
        // Attach to window SEPARATELY (THREE is not extensible!)
        window.THREE = THREE;
        window.OrbitControls = OrbitControls; // ✅ SÉPARÉ !
        
        console.log('✅ Three.js + OrbitControls loaded as ES6 modules!', {
          THREE: !!window.THREE,
          OrbitControls: !!window.OrbitControls
        });
        
        // Notify Angular that everything is ready
        window.dispatchEvent(new CustomEvent('threeAndOrbitControlsReady'));
      `;
      
      await new Promise((resolve, reject) => {
        const handleReady = () => {
          if ((window as any).THREE && (window as any).OrbitControls) {
            console.log('✅ THREE + OrbitControls confirmed ready!');
            window.removeEventListener('threeAndOrbitControlsReady', handleReady);
            resolve(true);
          } else {
            reject(new Error('THREE or OrbitControls not found after ready event'));
          }
        };
        
        window.addEventListener('threeAndOrbitControlsReady', handleReady);
        
        moduleScript.onerror = (error) => {
          console.error('❌ Failed to load Three.js module:', error);
          window.removeEventListener('threeAndOrbitControlsReady', handleReady);
          reject(new Error('Failed to load Three.js module'));
        };
        
        // Timeout de sécurité
        setTimeout(() => {
          window.removeEventListener('threeAndOrbitControlsReady', handleReady);
          reject(new Error('Three.js module loading timeout'));
        }, 15000);
        
        document.head.appendChild(moduleScript);
        console.log('📦 Three.js ES6 module script injected');
      });

      // Wait for Angular to render the canvas
      setTimeout(() => {
        try {
          const THREE = (window as any).THREE;
          this.setupThreeSceneBasic(THREE);
          console.log('🎨 Three.js scene setup completed!');
        } catch (setupError) {
          console.error('❌ Failed to setup Three.js scene:', setupError);
          this.showFallback();
        }
      }, 100);
      
    } catch (error) {
      console.error('❌ Failed to load Three.js:', error);
      this.showFallback();
    }
  }

  private isWebGLSupported(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!context;
    } catch (e) {
      return false;
    }
  }

  private loadScriptFromCDN(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script already exists
      const existingScript = document.querySelector(`script[src*="three"]`);
      if (existingScript) {
        console.log('📦 Three.js script already exists, checking THREE object...');
        if ((window as any).THREE) {
          console.log('✅ THREE object already available');
          resolve();
          return;
        }
      }

      console.log('📦 Loading script from:', src);
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous'; // Add CORS support
      script.onload = () => {
        console.log('✅ Script loaded successfully:', src);
        // Check if THREE is now available
        if ((window as any).THREE) {
          console.log('✅ THREE object is available');
          resolve();
        } else {
          console.log('❌ THREE object not found after script load');
          reject(new Error(`THREE object not found after loading: ${src}`));
        }
      };
      script.onerror = (error) => {
        console.error('❌ Failed to load script:', src, error);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }



  private setupThreeSceneBasic(THREE: any): void {
    console.log('🎬 Setting up Three.js scene...');
    console.log('Canvas element:', this.canvasRef?.nativeElement);
    console.log('Canvas size:', this.maxWidth, 'x', this.height);
    
    this.canvas = this.canvasRef.nativeElement;
    
    if (!this.canvas) {
      throw new Error('Canvas element not found!');
    }
    
    // Setup renderer avec fond TRANSPARENT
    console.log('🖥️ Creating WebGL renderer...');
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true,
      alpha: true // TRANSPARENT !
    });
    this.renderer.setClearColor(0x000000, 0); // Fond transparent
    this.renderer.setSize(this.maxWidth, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    console.log('✅ Renderer created with transparency');

    // Setup scene avec fond TRANSPARENT
    console.log('🎭 Creating scene...');
    this.scene = new THREE.Scene();
    // PAS de background = transparent !
    console.log('✅ Scene created with transparent background');
    
    // Setup camera - centrée pour vue générale
    console.log('📷 Setting up camera...');
    this.camera = new THREE.PerspectiveCamera(45, this.maxWidth / this.height, 0.1, 100);
    this.camera.position.set(0, 0, 5); // Caméra centrée
    this.camera.lookAt(0, 0, 0); // Regarde le centre
    console.log('✅ Camera positioned centrally');

    // Setup OrbitControls SIMPLE comme l'exemple qui fonctionne !
    console.log('🖱️ Setting up REAL OrbitControls...');
    const OrbitControls = (window as any).OrbitControls; // ✅ SÉPARÉ de THREE !
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    // Configuration pour activer l'interaction souris SANS LIMITES !
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.enableRotate = true;  // ✅ ACTIVER rotation souris !
    this.controls.enableZoom = true;    // ✅ ACTIVER zoom molette !
    this.controls.enablePan = false;    // ❌ DÉSACTIVER pan (déplacement)
    this.controls.rotateSpeed = 1.0;    // Sensibilité rotation
    this.controls.zoomSpeed = 1.2;      // Sensibilité zoom
    
    // ✅ SUPPRIMER toutes les limites pour liberté totale !
    this.controls.minDistance = 0;     // Pas de limite zoom avant
    this.controls.maxDistance = Infinity; // Pas de limite zoom arrière
    this.controls.minPolarAngle = 0;    // Rotation verticale libre
    this.controls.maxPolarAngle = Math.PI; // Rotation verticale libre
    this.controls.minAzimuthAngle = -Infinity; // Rotation horizontale libre
    this.controls.maxAzimuthAngle = Infinity;  // Rotation horizontale libre
    
    console.log('✅ REAL OrbitControls configured for mouse interaction!', {
      enableRotate: this.controls.enableRotate,
      enableZoom: this.controls.enableZoom,
      domElement: this.controls.domElement?.tagName,
      rendererDomElement: this.renderer.domElement?.tagName,
      canvasElement: this.canvas?.tagName,
      sameElement: this.renderer.domElement === this.canvas
    });

    // OrbitControls opérationnels - debug terminé
    console.log('✅ OrbitControls configured and ready for interaction!');

    // Setup rotating group - DÉCALÉ 15% PLUS VERS LA GAUCHE
    console.log('🔄 Creating rotating group...');
    this.rotatingGroup = new THREE.Group();
    this.rotatingGroup.position.set(-0.75, 0, 0); // Décalage 15% plus vers la gauche : -0.3 - 0.45 = -0.75
    this.scene.add(this.rotatingGroup);
    console.log('✅ Rotating group added to scene (shifted 15% MORE to LEFT)');

    // Create starfield background - Couleurs Sorbonne
    console.log('⭐ Creating starfield...');
    this.createStarfield(THREE);
    console.log('✅ Starfield created');
    
    // Create main objects - Couleurs Sorbonne
    console.log('🎯 Creating main 3D objects...');
    this.createMainObjects(THREE);
    console.log('✅ Main objects created');
    
    // Setup basic event listeners (without shockwave for now)
    console.log('🖱️ Setting up event listeners...');
    this.setupBasicEventListeners();
    console.log('✅ Event listeners set up');
    
    // Start animation
    console.log('🎨 Showing canvas and starting animation...');
    this.canvasOpacity = 1;
    this.fallbackOpacity = 0;
    this.isAnimating = true;
    console.log('🔄 Animation status:', this.isAnimating);
    console.log('🎯 Rotating group exists:', !!this.rotatingGroup);
    console.log('🖱️ OrbitControls exists:', !!this.controls);
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
    console.log('🚀 Animation started!');
  }

  private createStarfield(THREE: any): void {
    console.log('⭐ Creating subtle white starfield...');
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 200; // Réduit pour discrétion
    const starsPositions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i++) {
      starsPositions[i] = (Math.random() - 0.5) * 80; // Zone réduite
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    
    // Étoiles BLANC/GRIS TRÈS SUBTIL
    const starMaterial = new THREE.PointsMaterial({
      color: 0xf0f0f0, // BLANC CASSÉ très discret
      size: 0.03, // Très petites
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.2 // ULTRA discrètes pour harmonie
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
    console.log('✅ Subtle white starfield created');
  }

  private createMainObjects(THREE: any): void {
    // TAILLES OPTIMISÉES - réduites de 7% pour ajustement final
    console.log('🎯 Creating objects with sizes reduced by 7%...');
    
    // Inner icosahedron - PRESQUE TRANSLUCIDE DORÉ SORBONNE TRÈS TRÈS CLAIR (-7%)
    const innerGeometry = new THREE.IcosahedronGeometry(0.818, 1); // 0.88 * 0.93 = 0.818
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f0e8, // DORÉ SORBONNE TRÈS TRÈS CLAIR (presque blanc doré)
      roughness: 0.1, // Très lisse pour effet translucide
      metalness: 0.05, // Quasi pas métallique = effet fantôme
      flatShading: false, // Smooth pour effet translucide
      transparent: true,
      opacity: 0.12 // ULTRA TRANSPARENT ! (presque invisible)
    });
    const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
    this.rotatingGroup.add(innerMesh);
    console.log('✅ Inner icosahedron created (ultra translucent golden Sorbonne)');
    
    // Outer wireframe - BLEU SORBONNE (premier plan visible) réduit de 7%
    const outerGeometry = new THREE.IcosahedronGeometry(0.972, 1); // 1.045 * 0.93 = 0.972
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x242e54, // BLEU SORBONNE pour premier plan !
      wireframe: true,
      transparent: true,
      opacity: 0.8 // Bien visible comme forme principale
    });
    const wireframeMesh = new THREE.Mesh(outerGeometry, wireframeMaterial);
    this.rotatingGroup.add(wireframeMesh);
    console.log('✅ Wireframe created (Sorbonne blue, +15% bigger)');
    
    // Points DORÉS SORBONNE aux intersections/vertices - COMME DEMANDÉ !
    console.log('✨ Creating GOLDEN SORBONNE intersection points...');
    const positions = [];
    const posAttr = outerGeometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }
    
    const goldenPointsGeometry = new THREE.BufferGeometry();
    goldenPointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const goldenPointsMaterial = new THREE.PointsMaterial({
      color: 0xd4a574, // DORÉ SORBONNE - couleur officielle !
      size: 0.051, // Réduit de 7% : 0.055 * 0.93 = 0.051
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95 // Bien visibles comme points d'intersections
    });
    const goldenPoints = new THREE.Points(goldenPointsGeometry, goldenPointsMaterial);
    this.rotatingGroup.add(goldenPoints);
    console.log('✅ Golden Sorbonne intersection points created!');
    
    // Add lighting (optimisé pour doré translucide très clair)
    const light = new THREE.PointLight(0xffffff, 0.6); // LUMIÈRE DOUCE pour révéler le doré
    light.position.set(3, 2, 4); // Position pour éclairer délicatement
    this.scene.add(light);
    
    // Ambient light dorée très subtile pour harmonie
    const ambientLight = new THREE.AmbientLight(0xfaf8f5, 0.4); // Ambiant doré très clair
    this.scene.add(ambientLight);
    
    // Lumière dorée d'appoint pour révéler la translucidité
    const goldenLight = new THREE.PointLight(0xf5f0e8, 0.2); // DORÉ TRÈS SUBTIL
    goldenLight.position.set(-1, 1, 2); // Proche du centre translucide
    this.scene.add(goldenLight);
    
    console.log('✅ Lighting optimized for ultra translucent golden');
  }



  private setupBasicEventListeners(): void {
    // Simple click interaction - rotation boost
    this.canvas.addEventListener('click', (event) => {
      // Add some rotation boost on click
      this.rotatingGroup.rotation.x += 0.2;
      this.rotatingGroup.rotation.y += 0.3;
    });
  }

  private animate(): void {
    if (!this.isAnimating) {
      console.log('⏹️ Animation stopped');
      return;
    }

    this.animationId = requestAnimationFrame(() => this.animate());

    // Update OrbitControls - SIMPLE comme l'exemple !
    this.controls.update();

    // Rotate the main group automatiquement - SIMPLE comme l'exemple !
    this.rotatingGroup.rotation.x += 0.002;
    this.rotatingGroup.rotation.y += 0.003;

    // Render - SIMPLE comme l'exemple !
    this.renderer.render(this.scene, this.camera);
  }

  private showFallback(): void {
    console.log('🔙 Showing fallback (animation failed)');
    this.canvasOpacity = 0;
    this.fallbackOpacity = 1;
  }

  private cleanup(): void {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.controls) {
      // Cleanup OrbitControls events
      this.controls.enabled = false;
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}