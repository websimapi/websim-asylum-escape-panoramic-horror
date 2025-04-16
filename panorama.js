import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

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
        
        // Add new properties for improved object detection
        this.objectDetectionInProgress = false;
        this.objectDetectionRetries = 0;
        this.fallbackObjectsGenerated = false;
        
        // Add properties for retry logic
        this.maxRetries = 3;
        this.retryDelay = 1000; // ms
        
        // Add properties for TensorFlow object detection
        this.cocossdModel = null;
        this.isModelLoading = false;
        this.detectionCanvas = document.createElement('canvas');
        this.detectionContext = this.detectionCanvas.getContext('2d');
        
        // Preload the COCO-SSD model
        this.loadObjectDetectionModel();
        
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
        this.labelRenderer.domElement.style.left = '0';
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
    
    async loadObjectDetectionModel() {
        if (this.cocossdModel || this.isModelLoading) return;
        
        try {
            this.isModelLoading = true;
            this.showObjectDetectionStatus(true, "Loading object detection model...");
            
            // Load the COCO-SSD model
            this.cocossdModel = await cocoSsd.load({
                base: 'lite_mobilenet_v2' // Using a lighter model for better performance
            });
            
            console.log("COCO-SSD model loaded successfully");
            this.showObjectDetectionStatus(false);
        } catch (error) {
            console.error("Error loading COCO-SSD model:", error);
            this.showObjectDetectionStatus(false);
        } finally {
            this.isModelLoading = false;
        }
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
        
        // After loading the panorama, run object detection on the image
        try {
            await this.detectObjectsWithCocoSsd(imageUrl);
        } catch (error) {
            console.error("Error in object detection:", error);
            // Fall back to grid-based object placement if detection fails
            this.fallbackObjectDetection(imageUrl);
        }
    }
    
    async detectObjectsWithCocoSsd(imageUrl) {
        this.showObjectDetectionStatus(true, "Detecting objects in scene...");
        
        try {
            // Make sure the model is loaded
            if (!this.cocossdModel) {
                await this.loadObjectDetectionModel();
            }
            
            // Create an image element to run detection on
            const img = new Image();
            img.crossOrigin = "Anonymous";
            
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = imageUrl;
            });
            
            // Prepare the canvas for detection
            this.detectionCanvas.width = img.width;
            this.detectionCanvas.height = img.height;
            this.detectionContext.drawImage(img, 0, 0, img.width, img.height);
            
            // Run detection
            const predictions = await this.cocossdModel.detect(this.detectionCanvas);
            console.log("COCO-SSD detections:", predictions);
            
            // Convert the predictions to our object format
            this.detectedObjects = this.convertCocoSsdToGameObjects(predictions, img.width, img.height);
            
            // Add the detected objects to the scene
            this.addDetectedObjectsToScene();
            
            // Also add some generic game objects if we didn't find many
            if (this.detectedObjects.length < 3) {
                const genericObjects = this.generateGenericGameObjects(3 - this.detectedObjects.length);
                this.detectedObjects = [...this.detectedObjects, ...genericObjects];
                this.addDetectedObjectsToScene();
            }
            
            this.showObjectDetectionStatus(false);
            return true;
        } catch (error) {
            console.error("Error in COCO-SSD object detection:", error);
            this.showObjectDetectionStatus(false);
            throw error;
        }
    }
    
    convertCocoSsdToGameObjects(predictions, imgWidth, imgHeight) {
        const gameObjects = [];
        
        // Map of COCO-SSD classes to game object types
        const objectTypeMap = {
            person: {
                type: 'person',
                collectible: false,
                description: 'A figure standing motionless in the shadows. Their presence is unsettling.'
            },
            chair: {
                type: 'furniture',
                collectible: false,
                description: 'An old chair with stains that you\'d rather not identify.'
            },
            bed: {
                type: 'furniture',
                collectible: false,
                description: 'A hospital bed with restraints. You can still see marks where patients struggled.'
            },
            book: {
                type: 'item',
                collectible: true,
                description: 'A journal filled with disturbing notes from a patient or staff member.'
            },
            cup: {
                type: 'item',
                collectible: true,
                description: 'A medical container that might have held medicine... or something worse.'
            },
            bottle: {
                type: 'item',
                collectible: true,
                description: 'A medication bottle with a faded label. It might contain something useful.'
            },
            keyboard: {
                type: 'item',
                collectible: true,
                description: 'An old terminal keyboard. It might access patient records.'
            },
            cell phone: {
                type: 'item',
                collectible: true,
                description: 'A communications device. Perhaps it still works?'
            },
            tv: {
                type: 'furniture',
                collectible: false,
                description: 'An old television. The screen occasionally flickers with static.'
            },
            laptop: {
                type: 'item',
                collectible: true,
                description: 'A laptop with potentially valuable information.'
            },
            mouse: {
                type: 'item',
                collectible: true, 
                description: 'Something small scurrying in the shadows.'
            },
            remote: {
                type: 'item',
                collectible: true,
                description: 'A remote control. It might operate something important.'
            },
            door: {
                type: 'door',
                collectible: false,
                description: 'A door that may lead to another room.'
            },
            sink: {
                type: 'furniture',
                collectible: false,
                description: 'A filthy sink with rust-colored stains in the basin.'
            }
        };
        
        // Generic fallback for unrecognized objects
        const defaultObjectType = {
            type: 'item',
            collectible: true,
            description: 'An unidentified object that could be useful.'
        };
        
        // Convert predictions to game objects
        predictions.forEach(prediction => {
            // Get object type info from the map or use default
            const objectInfo = objectTypeMap[prediction.class] || defaultObjectType;
            
            // Make some items randomly collectible to add variety
            const isCollectible = objectInfo.collectible || Math.random() < 0.3;
            
            // Normalize the bounding box (convert to 0-1 range)
            const boundingBox = {
                x: prediction.bbox[0] / imgWidth,
                y: prediction.bbox[1] / imgHeight,
                width: prediction.bbox[2] / imgWidth,
                height: prediction.bbox[3] / imgHeight
            };
            
            // Create the game object
            gameObjects.push({
                name: this.capitalizeFirstLetter(prediction.class),
                type: objectInfo.type,
                description: objectInfo.description,
                collectible: isCollectible,
                interactive: true,
                confidence: prediction.score,
                bounding_box: boundingBox
            });
        });
        
        return gameObjects;
    }
    
    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    generateGenericGameObjects(count) {
        // Generate game-specific objects that may not be detected by COCO-SSD
        const gameSpecificObjects = [
            {
                name: "Key",
                type: "item",
                description: "An old key that might unlock something important.",
                collectible: true,
                interactive: true
            },
            {
                name: "Patient File",
                type: "item",
                description: "Medical records with disturbing notes about experiments.",
                collectible: true,
                interactive: true
            },
            {
                name: "Medicine Bottle",
                type: "item",
                description: "A bottle of experimental medicine with concerning side effects listed.",
                collectible: true,
                interactive: true
            },
            {
                name: "Blood Stain",
                type: "decor",
                description: "A dark stain on the floor. It looks like dried blood.",
                collectible: false,
                interactive: true
            },
            {
                name: "Syringe",
                type: "item",
                description: "A used medical syringe. Handle with care.",
                collectible: true,
                interactive: true
            },
            {
                name: "Surgical Tools",
                type: "item",
                description: "A set of rusty surgical instruments. The scalpel looks particularly sharp.",
                collectible: true,
                interactive: true
            },
            {
                name: "Journal",
                type: "item",
                description: "A personal journal with frantic writing about experiments and escaping.",
                collectible: true,
                interactive: true
            }
        ];
        
        const objects = [];
        const shuffledObjects = [...gameSpecificObjects].sort(() => 0.5 - Math.random());
        
        // Take the first 'count' objects
        for (let i = 0; i < count && i < shuffledObjects.length; i++) {
            const obj = shuffledObjects[i];
            
            // Generate a grid position for each object
            const gridPositions = this.generateGridPositions(3, 3);
            const randomGridPos = gridPositions[Math.floor(Math.random() * gridPositions.length)];
            
            objects.push({
                ...obj,
                bounding_box: {
                    x: randomGridPos.x - 0.05,
                    y: randomGridPos.y - 0.05,
                    width: 0.1,
                    height: 0.1
                }
            });
        }
        
        return objects;
    }
    
    addDetectedObjectsToScene() {
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
                case 'medical_equipment':
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#d3d3d3"><path d="M10,21H14V18H15V15H9V18H10V21M12,2C17.5,2 22,6.5 22,12C22,17.5 17.5,22 12,22C6.5,22 2,17.5 2,12C2,6.5 6.5,2 12,2M12,4C7.58,4 4,7.58 4,12C4,16.42 7.58,20 12,20C16.42,20 20,16.42 20,12C20,7.58 16.42,4 12,4M12,6C15.31,6 18,8.69 18,12H6C6,8.69 8.69,6 12,6Z" /></svg>`;
                    break;
                case 'person':
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#8b0000"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z" /></svg>`;
                    break;
                default:
                    iconHtml = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#c0c0c0"><path d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z" /></svg>`;
                    break;
            }
            
            // Create a scale value based on the confidence of the detection
            const scaleValue = obj.confidence ? 0.8 + (obj.confidence * 0.4) : 1;
            
            // Add the object to the scene
            this.addSceneObject(objId, position, iconHtml, scaleValue);
            
            // Store additional data about the detected object
            const sceneObj = this.sceneObjects.get(objId);
            if (sceneObj) {
                sceneObj.userData = {
                    detectedObject: obj,
                    originalPosition: position,
                    boundingBox: obj.bounding_box
                };
                
                // Add animated detection effect
                if (sceneObj.element) {
                    sceneObj.element.classList.add('detected');
                }
            }
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
    
    loadTexture(url) {
        return new Promise((resolve) => {
            new THREE.TextureLoader().load(url, (texture) => {
                resolve(texture);
            });
        });
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
    
    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
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
    
    async fallbackObjectDetection(imageUrl) {
        if (this.fallbackObjectsGenerated) return;
        
        this.showObjectDetectionStatus(true, "Generating scene objects...");
        
        try {
            // Use grid-based object generation instead of LLM analysis
            const roomType = this.determineRoomTypeFromUrl(imageUrl);
            
            // Generate appropriate objects for the room type
            const objectsForRoom = this.generateObjectsForRoomType(roomType);
            this.detectedObjects = objectsForRoom;
            
            // Add these objects to the scene
            this.addDetectedObjectsToScene();
            this.fallbackObjectsGenerated = true;
            
            console.log("Added grid-based objects to scene:", objectsForRoom);
            this.showObjectDetectionStatus(false);
        } catch (error) {
            console.error("Error in fallback object detection:", error);
            
            // Last resort: add some generic objects
            this.addGenericObjects();
            this.fallbackObjectsGenerated = true;
            this.showObjectDetectionStatus(false);
        }
    }
    
    determineRoomTypeFromUrl(imageUrl) {
        // Simple room type determination based on the URL or a random selection
        // This is a fallback when we can't use LLM to analyze the image
        const roomTypes = [
            "patient_room", "hallway", "operating_room", "morgue", 
            "office", "kitchen", "bathroom", "treatment_room"
        ];
        
        // If the URL contains hints about room type, use those
        const url = imageUrl.toLowerCase();
        for (const type of roomTypes) {
            if (url.includes(type.replace("_", ""))) {
                return type;
            }
        }
        
        // Otherwise pick randomly but weighted toward common room types
        const randomVal = Math.random();
        if (randomVal < 0.25) return "patient_room";
        if (randomVal < 0.45) return "hallway";
        if (randomVal < 0.6) return "operating_room";
        if (randomVal < 0.75) return "morgue";
        if (randomVal < 0.85) return "office";
        if (randomVal < 0.9) return "kitchen";
        if (randomVal < 0.95) return "bathroom";
        return "treatment_room";
    }
    
    generateObjectsForRoomType(roomType) {
        // Create a grid system for object placement (3x3 grid)
        const gridPositions = this.generateGridPositions(3, 3);
        
        // Objects based on room type - same as before
        let roomObjects = [];
        
        switch(roomType.toLowerCase()) {
            case 'patient_room':
                roomObjects = [
                    { name: "Hospital Bed", type: "furniture", collectible: false, interactive: true,
                      description: "A rusted metal bed with leather restraints. Dark stains cover the mattress." },
                    { name: "Medicine Cabinet", type: "furniture", collectible: false, interactive: true,
                      description: "A small cabinet with a broken door. Some pill bottles are still inside." },
                    { name: "Patient File", type: "item", collectible: true, interactive: true,
                      description: "Medical records detailing disturbing experiments performed on patients." },
                    { name: "Straitjacket", type: "item", collectible: true, interactive: true,
                      description: "A tattered straitjacket with broken buckles." }
                ];
                break;
            case 'hallway':
                roomObjects = [
                    { name: "Wheelchair", type: "furniture", collectible: false, interactive: true,
                      description: "An old wheelchair with one wheel missing. Dark stains cover the seat." },
                    { name: "Exit Sign", type: "furniture", collectible: false, interactive: true,
                      description: "A flickering exit sign pointing down the hallway." },
                    { name: "Dropped Key", type: "item", collectible: true, interactive: true,
                      description: "A brass key that might unlock an important door." },
                    { name: "Maintenance Door", type: "door", collectible: false, interactive: true,
                      description: "A metal door marked 'Maintenance'. It might lead to an escape route." }
                ];
                break;
            case 'operating_room':
                roomObjects = [
                    { name: "Operating Table", type: "furniture", collectible: false, interactive: true,
                      description: "A blood-stained operating table with leather restraints." },
                    { name: "Surgical Tools", type: "item", collectible: true, interactive: true,
                      description: "A set of rusty surgical tools. The scalpel looks particularly sharp." },
                    { name: "Anesthesia Machine", type: "medical_equipment", collectible: false, interactive: true,
                      description: "An old anesthesia machine. The gas tank shows it's nearly empty." },
                    { name: "Doctor's Notes", type: "item", collectible: true, interactive: true,
                      description: "Notes detailing unethical surgical procedures performed on unwilling patients." }
                ];
                break;
            case 'morgue':
                roomObjects = [
                    { name: "Body Drawer", type: "furniture", collectible: false, interactive: true,
                      description: "A metal drawer used for storing bodies. It's partially open." },
                    { name: "Autopsy Tools", type: "item", collectible: true, interactive: true,
                      description: "Tools used for postmortem examinations. The bone saw looks useful." },
                    { name: "Morgue Log", type: "item", collectible: true, interactive: true,
                      description: "A log book recording deaths. Many entries are marked 'experiment failure'." },
                    { name: "Formaldehyde Container", type: "item", collectible: false, interactive: true,
                      description: "A large container of formaldehyde used for preserving specimens." }
                ];
                break;
            case 'office':
                roomObjects = [
                    { name: "Filing Cabinet", type: "furniture", collectible: false, interactive: true,
                      description: "A metal filing cabinet with patient records. Most drawers are locked." },
                    { name: "Doctor's Journal", type: "item", collectible: true, interactive: true,
                      description: "A personal journal detailing the doctor's descent into madness and unethical experiments." },
                    { name: "Asylum Map", type: "item", collectible: true, interactive: true,
                      description: "A partial map of the asylum showing some possible escape routes." },
                    { name: "Desk", type: "furniture", collectible: false, interactive: true,
                      description: "An old wooden desk with multiple drawers. There might be something useful inside." }
                ];
                break;
            default:
                roomObjects = [
                    { name: "Strange Device", type: "item", collectible: true, interactive: true,
                      description: "An unidentifiable device with buttons and dials. Its purpose is unknown." },
                    { name: "Old Journal", type: "item", collectible: true, interactive: true,
                      description: "A weathered journal with faded writing. It might contain useful information." },
                    { name: "Mysterious Door", type: "door", collectible: false, interactive: true,
                      description: "A heavy door with unusual markings. It appears to be locked." },
                    { name: "Broken Chair", type: "furniture", collectible: false, interactive: true,
                      description: "A wooden chair with one leg missing. It looks unstable." }
                ];
        }
        
        // Shuffle grid positions and assign to objects
        const shuffledPositions = this.shuffleArray([...gridPositions]);
        
        // Assign positions to objects and add bounding boxes
        return roomObjects.map((obj, index) => {
            // Get a position from our grid, with fallback
            const position = index < shuffledPositions.length 
                ? shuffledPositions[index]
                : this.generateRandomPosition();
                
            return {
                ...obj,
                bounding_box: {
                    x: position.x - 0.05,
                    y: position.y - 0.05,
                    width: 0.1,
                    height: 0.1
                }
            };
        });
    }
    
    generateGridPositions(rows, cols) {
        // Generate a grid of positions for more natural object placement
        const positions = [];
        
        // Calculate spacing between grid points
        const rowSpacing = 0.8 / (rows - 1);
        const colSpacing = 0.8 / (cols - 1);
        
        // Start at 0.1 to give a 0.1 margin around the edges (0.1 to 0.9)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                positions.push({
                    x: 0.1 + (c * colSpacing),
                    y: 0.1 + (r * rowSpacing)
                });
            }
        }
        
        return positions;
    }
    
    shuffleArray(array) {
        // Fisher-Yates shuffle algorithm
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
    
    generateRandomPosition() {
        const x = Math.random() * 0.8 + 0.1;
        const y = Math.random() * 0.8 + 0.1;
        
        return { x, y };
    }
    
    addGenericObjects() {
        // Create a grid pattern for objects
        const gridSize = 4; // 4x4 grid
        const objects = [];
        
        // Object types to cycle through
        const objectTypes = [
            {
                name: "Key",
                type: "item",
                description: "An old key that might unlock something important.",
                collectible: true,
                interactive: true
            },
            {
                name: "Door",
                type: "door",
                description: "A weathered door with peeling paint.",
                collectible: false,
                interactive: true
            },
            {
                name: "Medical Tool",
                type: "item",
                description: "An unsettling medical instrument with an unknown purpose.",
                collectible: true,
                interactive: true
            },
            {
                name: "Patient Record",
                type: "item",
                description: "Notes about a patient's treatment. The details are disturbing.",
                collectible: true,
                interactive: true
            },
            {
                name: "Cabinet",
                type: "furniture",
                description: "A metal cabinet that might contain useful items.",
                collectible: false,
                interactive: true
            },
            {
                name: "Wheelchair",
                type: "furniture",
                description: "An old wheelchair with restraints attached to the armrests.",
                collectible: false,
                interactive: true
            },
            {
                name: "Window",
                type: "furniture",
                description: "A barred window. There's no escape this way.",
                collectible: false,
                interactive: true
            }
        ];
        
        // Create a 3x3 grid with random objects
        const positions = this.generateGridPositions(gridSize, gridSize);
        const shuffledPositions = this.shuffleArray([...positions]);
        
        // Choose 4-7 random positions for objects
        const numObjects = 4 + Math.floor(Math.random() * 4);
        const selectedPositions = shuffledPositions.slice(0, numObjects);
        
        // Create objects at those positions
        selectedPositions.forEach((pos, index) => {
            const objectType = objectTypes[index % objectTypes.length];
            objects.push({
                ...objectType,
                bounding_box: {
                    x: pos.x - 0.05,
                    y: pos.y - 0.05,
                    width: 0.1,
                    height: 0.1
                }
            });
        });
        
        this.detectedObjects = objects;
        this.addDetectedObjectsToScene();
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
    
    async analyzeRoomType(imageUrl) {
        // Skip the LLM analysis and use our local determination function
        const roomType = this.determineRoomTypeFromUrl(imageUrl);
        
        return { 
            roomType: roomType, 
            description: `An eerie ${roomType.replace('_', ' ')}`, 
            mood: "dark" 
        };
    }
    
    showObjectDetectionStatus(isActive, message = "Analyzing scene...") {
        // Create or update status element
        let statusEl = document.getElementById('object-detection-status');
        
        if (isActive) {
            if (!statusEl) {
                statusEl = document.createElement('div');
                statusEl.id = 'object-detection-status';
                statusEl.style.position = 'absolute';
                statusEl.style.bottom = '30px';
                statusEl.style.left = '50%';
                statusEl.style.transform = 'translateX(-50%)';
                statusEl.style.backgroundColor = 'rgba(0,0,0,0.7)';
                statusEl.style.color = '#fff';
                statusEl.style.padding = '10px 20px';
                statusEl.style.borderRadius = '5px';
                statusEl.style.zIndex = '1000';
                statusEl.style.fontFamily = 'Special Elite, cursive';
                statusEl.style.display = 'flex';
                statusEl.style.alignItems = 'center';
                statusEl.style.gap = '10px';
                
                const spinner = document.createElement('div');
                spinner.className = 'spinner';
                spinner.style.width = '20px';
                spinner.style.height = '20px';
                statusEl.appendChild(spinner);
                
                const text = document.createElement('span');
                text.textContent = message;
                statusEl.appendChild(text);
                
                document.body.appendChild(statusEl);
            } else {
                statusEl.querySelector('span').textContent = message;
                statusEl.style.display = 'flex';
            }
        } else if (statusEl) {
            statusEl.style.display = 'none';
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