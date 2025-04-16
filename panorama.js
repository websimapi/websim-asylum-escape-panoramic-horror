import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export class PanoramaViewer {
    constructor(containerElement) {
        this.container = containerElement;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.labelRenderer = new CSS2DRenderer();
        this.controls = null;
        this.sceneObjects = new Map();
        this.enemy = null;
        
        // Callback functions
        this.onObjectClick = null;
        this.onObjectInView = null;
        
        this.init();
    }
    
    init() {
        // Set up renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        
        // Set up CSS 2D renderer for labels
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.container.appendChild(this.labelRenderer.domElement);
        
        // Set up camera and controls
        this.camera.position.set(0, 0, 0.1); // Slightly offset from center
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableZoom = false;
        this.controls.enablePan = false;
        this.controls.rotateSpeed = 0.5;
        this.controls.maxPolarAngle = Math.PI; // Limit vertical rotation
        this.controls.minPolarAngle = 0;
        
        // Add event listeners
        window.addEventListener('resize', () => this.handleResize());
        this.container.addEventListener('click', (event) => this.handleClick(event));
        
        // Start animation loop
        this.animate();
    }
    
    async loadPanorama(imageUrl) {
        // Create sphere geometry for the panorama
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Invert the sphere so the image is on the inside
        
        // Create material with the panorama texture
        const texture = await this.loadTexture(imageUrl);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        
        // Remove old panorama if it exists
        this.scene.children.forEach(child => {
            if (child.name === 'panorama') {
                this.scene.remove(child);
            }
        });
        
        // Create and add the new panorama mesh
        const panoramaMesh = new THREE.Mesh(geometry, material);
        panoramaMesh.name = 'panorama';
        this.scene.add(panoramaMesh);
        
        // Apply initial effect
        this.applyPanoramaEffect('initial');
    }
    
    loadTexture(url) {
        return new Promise((resolve) => {
            new THREE.TextureLoader().load(url, (texture) => {
                resolve(texture);
            });
        });
    }
    
    addSceneObject(id, position, iconHtml, scale = 1) {
        // Create HTML element for the object
        const element = document.createElement('div');
        element.className = 'scene-object';
        element.innerHTML = iconHtml;
        element.style.fontSize = `${scale * 24}px`;
        element.dataset.objectId = id;
        
        // Convert spherical position to 3D coordinates
        const phi = THREE.MathUtils.degToRad(position.y);
        const theta = THREE.MathUtils.degToRad(position.x);
        const radius = 490;
        
        const x = -radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        // Create CSS2D object and add to scene
        const objectLabel = new CSS2DObject(element);
        objectLabel.position.set(x, y, z);
        objectLabel.name = `object-${id}`;
        this.scene.add(objectLabel);
        
        // Store reference to the object
        this.sceneObjects.set(id, objectLabel);
    }
    
    removeSceneObject(id) {
        const objectLabel = this.sceneObjects.get(id);
        if (objectLabel) {
            this.scene.remove(objectLabel);
            this.sceneObjects.delete(id);
        }
    }
    
    clearSceneObjects() {
        this.sceneObjects.forEach((object) => {
            this.scene.remove(object);
        });
        this.sceneObjects.clear();
    }
    
    getVisibleObjects() {
        const visibleObjects = [];
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(
            this.camera.projectionMatrix, 
            this.camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(matrix);
        
        this.sceneObjects.forEach((object, id) => {
            if (frustum.containsPoint(object.position)) {
                visibleObjects.push(id);
                
                // Trigger onObjectInView callback
                if (this.onObjectInView) {
                    this.onObjectInView(id);
                }
            }
        });
        
        return visibleObjects;
    }
    
    handleClick(event) {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        const intersects = raycaster.intersectObjects(this.scene.children, true);
        
        // Find the first intersected object that has an objectId
        for (const intersect of intersects) {
            const element = intersect.object.element;
            if (element && element.dataset.objectId) {
                const objectId = element.dataset.objectId;
                if (this.onObjectClick) {
                    this.onObjectClick(objectId);
                }
                break;
            }
        }
    }
    
    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    applyPanoramaEffect(effectType) {
        const panorama = this.scene.getObjectByName('panorama');
        if (!panorama) return;
        
        switch (effectType) {
            case 'initial':
                // Add a slight vignette/darkening effect
                break;
            case 'hiding':
                // Darken the panorama when hiding
                panorama.material.color.set(0x555555);
                break;
            case 'normal':
                // Reset to normal
                panorama.material.color.set(0xffffff);
                break;
        }
    }
    
    applyHidingEffect() {
        this.applyPanoramaEffect('hiding');
    }
    
    removeHidingEffect() {
        this.applyPanoramaEffect('normal');
    }
    
    spawnEnemy() {
        // Create an enemy figure in the scene
        const enemyGeometry = new THREE.SphereGeometry(5, 16, 16);
        const enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
        this.enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
        
        // Place enemy in a random position
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const radius = 100 + Math.random() * 200;
        
        this.enemy.position.x = radius * Math.sin(phi) * Math.cos(theta);
        this.enemy.position.y = radius * Math.cos(phi);
        this.enemy.position.z = radius * Math.sin(phi) * Math.sin(theta);
        
        this.scene.add(this.enemy);
        
        // Enemy movement
        this.moveEnemy();
    }
    
    moveEnemy() {
        if (!this.enemy) return;
        
        // Move enemy closer to player over time
        const moveTowardsPlayer = () => {
            if (!this.enemy) return;
            
            const direction = new THREE.Vector3();
            direction.subVectors(this.camera.position, this.enemy.position).normalize();
            
            const speed = 0.5;
            this.enemy.position.add(direction.multiplyScalar(speed));
            
            setTimeout(moveTowardsPlayer, 100);
        };
        
        moveTowardsPlayer();
    }
    
    updateEnemyProximity(awareness) {
        if (!this.enemy) return;
        
        // Make enemy more visible as awareness increases
        this.enemy.material.opacity = 0.3 + (awareness * 0.7);
        
        // Move enemy closer as awareness increases
        const currentDistance = this.enemy.position.length();
        const targetDistance = 100 * (1 - awareness);
        
        if (currentDistance > targetDistance) {
            const direction = new THREE.Vector3();
            direction.copy(this.enemy.position).normalize();
            
            this.enemy.position.copy(direction.multiplyScalar(targetDistance));
        }
    }
    
    removeEnemy() {
        if (this.enemy) {
            this.scene.remove(this.enemy);
            this.enemy = null;
        }
    }
    
    fadeToBlack() {
        // Create black overlay and fade in
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'black';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 2s';
        overlay.style.zIndex = '5';
        
        this.container.appendChild(overlay);
        
        // Trigger fade
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
    }
    
    fadeToWhite() {
        // Create white overlay and fade in
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'white';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 2s';
        overlay.style.zIndex = '5';
        
        this.container.appendChild(overlay);
        
        // Trigger fade
        setTimeout(() => {
            overlay.style.opacity = '1';
        }, 10);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.getVisibleObjects(); // Check which objects are in view
        
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }
}

