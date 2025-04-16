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
        
        // Add properties for object detection
        this.detectedObjects = [];
        this.objectOutliner = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;
        
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
        
        // Create outline effect for hovering
        this.createOutliner();
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
        
        // After loading the panorama, analyze the image for objects
        await this.detectObjectsInPanorama(imageUrl);
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
        // Update mouse position
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Create array of objects to test
        const objects = [];
        this.sceneObjects.forEach(object => {
            objects.push(object);
        });
        
        const intersects = this.raycaster.intersectObjects(objects, true);
        
        // Find the first intersected object
        if (intersects.length > 0) {
            const object = intersects[0].object;
            const objectId = object.name.replace('object-', '');
            
            if (this.onObjectClick) {
                this.onObjectClick(objectId);
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
    
    async detectObjectsInPanorama(imageUrl) {
        try {
            // Use the AI to analyze the image and detect objects
            const completion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Analyze this panoramic horror scene image and identify interactive objects.
                        Respond directly with JSON, following this JSON schema, and no other text.
                        {
                          "objects": [
                            {
                              "name": string,
                              "type": string, // "furniture", "item", "door", "person", etc.
                              "description": string,
                              "collectible": boolean,
                              "bounding_box": {
                                "x": number, // 0-1 representing horizontal position in image
                                "y": number, // 0-1 representing vertical position in image
                                "width": number, // 0-1 representing width relative to image
                                "height": number // 0-1 representing height relative to image
                              }
                            }
                          ]
                        }`
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Detect horror-themed objects in this asylum scene:",
                            },
                            {
                                type: "image_url",
                                image_url: { url: imageUrl },
                            },
                        ],
                    },
                ],
                json: true,
            });

            // Parse the detected objects
            this.detectedObjects = JSON.parse(completion.content).objects;
            
            // Create interactive elements for each detected object
            this.addDetectedObjectsToScene();
            
            console.log("Detected objects:", this.detectedObjects);
        } catch (error) {
            console.error("Error in object detection:", error);
        }
    }
    
    addDetectedObjectsToScene() {
        // Clear previous objects
        this.detectedObjects.forEach(obj => {
            // Generate a unique ID for each detected object
            const objId = `detected-${obj.name.toLowerCase().replace(/\s/g, '-')}-${Math.random().toString(36).substr(2, 5)}`;
            
            // Convert the bounding box to spherical coordinates
            const position = this.boundingBoxToSphericalCoordinates(obj.bounding_box);
            
            // Determine appropriate icon based on object type
            let iconHtml;
            switch(obj.type.toLowerCase()) {
                case 'door':
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#8a6d3b"><path d="M8,3V5H6V3H8M3,3V5H1V3H3M13,3V5H11V3H13M18,3V5H16V3H18M23,3V5H21V3H23M8,8V10H6V8H8M3,8V10H1V8H3M13,8V10H11V8H13M18,8V10H16V8H18M23,8V10H21V8H23M8,13V15H6V13H8M3,13V15H1V13H3M13,13V15H11V13H13M18,13V15H16V13H18M23,13V15H21V13H23M8,18V20H6V18H8M3,18V20H1V18H3M13,18V20H11V18H13M18,18V20H16V18H18M23,18V20H21V18H23Z" /></svg>`;
                    break;
                case 'furniture':
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#a0522d"><path d="M5,13L9,17V15H15V17L19,13H5M12,3A2,2 0 0,1 14,5A2,2 0 0,1 12,7A2,2 0 0,1 10,5A2,2 0 0,1 12,3M10.5,8H13.5C14.6,8 15.5,8.9 15.5,10V12H15L12.5,14.5L10,12H8.5V10A1.5,1.5 0 0,1 10,8.5" /></svg>`;
                    break;
                case 'item':
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#daa520"><path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z" /></svg>`;
                    break;
                case 'person':
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#8b0000"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" /></svg>`;
                    break;
                default:
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#c0c0c0"><path d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z" /></svg>`;
                    break;
            }
            
            // Add the object to the scene
            this.addSceneObject(objId, position, iconHtml, 1);
            
            // Store additional data about the detected object
            const sceneObj = this.sceneObjects.get(objId);
            if (sceneObj) {
                sceneObj.userData = {
                    detectedObject: obj,
                    originalPosition: position,
                    boundingBox: obj.bounding_box
                };
            }
        });
    }
    
    boundingBoxToSphericalCoordinates(boundingBox) {
        // Convert 2D image coordinates to spherical coordinates for the panorama
        // Center of the bounding box
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;
        
        // Convert to longitude and latitude
        const longitude = (centerX * 360) - 180; // Convert from 0-1 to -180 to 180 degrees
        const latitude = 90 - (centerY * 180);   // Convert from 0-1 to 90 to -90 degrees
        
        return {
            x: longitude,
            y: latitude
        };
    }
    
    createOutliner() {
        // Create outline effect for hovering
        this.container.addEventListener('mousemove', (event) => this.handleMouseMove(event));
    }
    
    handleMouseMove(event) {
        // Update mouse coordinates
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Create array of objects to test
        const objects = [];
        this.sceneObjects.forEach(object => {
            objects.push(object);
        });
        
        // Remove outline from currently hovered object
        if (this.hoveredObject) {
            const element = this.hoveredObject.element;
            if (element) {
                element.classList.remove('hovered');
            }
            this.hoveredObject = null;
        }
        
        // Find intersections
        const intersects = this.raycaster.intersectObjects(objects, true);
        
        // Apply hover effect to first intersection
        if (intersects.length > 0) {
            this.hoveredObject = intersects[0].object;
            if (this.hoveredObject && this.hoveredObject.element) {
                this.hoveredObject.element.classList.add('hovered');
            }
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.getVisibleObjects(); // Check which objects are in view
        
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }
}