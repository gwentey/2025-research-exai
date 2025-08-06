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
    if (isPlatformBrowser(this.platformId)) {
      this.checkMobileDevice();
      this.loadThreeJS();
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
    if (this.isMobile) return;

    try {
      // Load Three.js via script tags instead of ES6 imports
      await this.loadScriptFromCDN('https://cdnjs.cloudflare.com/ajax/libs/three.js/r136/three.min.js');

      // Check if THREE is available
      if (!(window as any).THREE) {
        throw new Error('Three.js failed to load');
      }

      const THREE = (window as any).THREE;
      this.setupThreeSceneBasic(THREE);
    } catch (error) {
      console.error('Failed to load Three.js:', error);
      this.showFallback();
    }
  }

  private loadScriptFromCDN(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private setupThreeSceneBasic(THREE: any): void {
    this.canvas = this.canvasRef.nativeElement;
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas });
    this.renderer.setSize(this.maxWidth, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Setup scene avec fond sombre pour contraster avec les couleurs Sorbonne
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a); // Fond très sombre
    
    // Setup camera - Vue plus large pour voir l'objet entier
    this.camera = new THREE.PerspectiveCamera(60, this.maxWidth / this.height, 0.1, 100);
    this.camera.position.z = 8; // Reculer la caméra

    // Setup rotating group
    this.rotatingGroup = new THREE.Group();
    this.scene.add(this.rotatingGroup);

    // Create starfield background - Couleurs Sorbonne
    this.createStarfield(THREE);
    
    // Create main objects - Couleurs Sorbonne
    this.createMainObjects(THREE);
    
    // Setup basic event listeners (without shockwave for now)
    this.setupBasicEventListeners();
    
    // Start animation
    this.canvasOpacity = 1;
    this.fallbackOpacity = 0;
    this.isAnimating = true;
    this.ngZone.runOutsideAngular(() => {
      this.animate();
    });
  }

  private createStarfield(THREE: any): void {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 400; // Réduit pour moins d'encombrement
    const starsPositions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i++) {
      starsPositions[i] = (Math.random() - 0.5) * 80; // Réduction de la zone
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3));
    
    // Couleurs Sorbonne pour les étoiles
    const starMaterial = new THREE.PointsMaterial({
      color: 0x7a89c2, // Bleu doux Sorbonne
      size: 0.03, // Plus petites
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.4 // Plus discrètes
    });
    
    const stars = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(stars);
  }

  private createMainObjects(THREE: any): void {
    // Inner icosahedron - Couleur Sorbonne principale (taille réduite)
    const innerGeometry = new THREE.IcosahedronGeometry(0.6, 1); // Réduit de 1 à 0.6
    const innerMaterial = new THREE.MeshStandardMaterial({
      color: 0x242e54, // Bleu principal Sorbonne
      roughness: 0.3,
      metalness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 0.8
    });
    const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
    this.rotatingGroup.add(innerMesh);
    
    // Outer wireframe - Or Sorbonne (taille réduite)
    const outerGeometry = new THREE.IcosahedronGeometry(0.75, 1); // Réduit de 1.15 à 0.75
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xd4a574, // Or Sorbonne
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    const wireframeMesh = new THREE.Mesh(outerGeometry, wireframeMaterial);
    this.rotatingGroup.add(wireframeMesh);
    
    // Particles - Bleu lumineux Sorbonne (taille réduite)
    const positions = [];
    const posAttr = outerGeometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x5c6fb3, // Bleu lumineux Sorbonne
      size: 0.05, // Augmenté légèrement pour plus de visibilité
      transparent: true,
      opacity: 0.9
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    this.rotatingGroup.add(particles);
    
    // Add subtle lighting
    const light = new THREE.PointLight(0xd4a574, 1.2); // Éclairage plus fort
    light.position.set(4, 4, 4);
    this.scene.add(light);
    
    // Ambient light pour mieux voir les détails
    const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
    this.scene.add(ambientLight);
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
    if (!this.isAnimating) return;

    this.animationId = requestAnimationFrame(() => this.animate());

    // Rotate the main group slowly
    this.rotatingGroup.rotation.x += 0.003;
    this.rotatingGroup.rotation.y += 0.005;

    // Basic rendering without post-processing
    this.renderer.render(this.scene, this.camera);
  }

  private showFallback(): void {
    this.canvasOpacity = 0;
    this.fallbackOpacity = 1;
  }

  private cleanup(): void {
    this.isAnimating = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}