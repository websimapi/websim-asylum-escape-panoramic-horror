import * as THREE from 'three';
import { PanoramaViewer } from './panorama.js';
import { RoomGenerator } from './room-generator.js';

class AsylumEscapeGame {
    constructor() {
        this.panoramaViewer = new PanoramaViewer(document.getElementById('panorama-view'));
        this.roomGenerator = new RoomGenerator();
        
        this.gameState = {
            currentRoom: null,
            rooms: {},
            inventory: [],
            isHiding: false,
            enemyPresent: false,
            enemyAwareness: 0
        };
        
        this.uiElements = {
            messageContainer: document.getElementById('message-container'),
            messageText: document.getElementById('message-text'),
            inventoryItems: document.getElementById('inventory-items'),
            hideBtn: document.getElementById('hide-btn'),
            inspectBtn: document.getElementById('inspect-btn'),
            moveBtn: document.getElementById('move-btn'),
            interactionMenu: document.getElementById('interaction-menu'),
            loadingScreen: document.getElementById('loading-screen')
        };
        
        // Set up object interaction handlers
        this.setupObjectInteractionHandlers();
        
        this.setupEventListeners();
    }
    
    async init() {
        this.showMessage("You wake up in a strange room. The air is heavy and stale. You need to find a way to escape this asylum...");
        
        // Generate starting room
        this.uiElements.loadingScreen.style.display = 'flex';
        const startRoom = await this.roomGenerator.generateRoom("Starting Room", "A decrepit admission room with peeling wallpaper and broken furniture. The air feels heavy with dread.");
        this.uiElements.loadingScreen.style.display = 'none';
        
        this.gameState.rooms[startRoom.id] = startRoom;
        this.gameState.currentRoom = startRoom.id;
        
        // Load the panorama for this room
        await this.loadCurrentRoom();
    }
    
    async loadCurrentRoom() {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        
        // Show loading indication
        this.uiElements.loadingScreen.style.display = 'flex';
        
        // Load the panorama image
        await this.panoramaViewer.loadPanorama(room.panoramaUrl);
        
        // Add manual scene objects
        room.objects.forEach(obj => {
            // Only add objects that haven't been collected
            if (!this.gameState.inventory.some(item => item.id === obj.id)) {
                this.panoramaViewer.addSceneObject(obj.id, obj.position, obj.icon, obj.scale);
            }
        });
        
        // Hide loading screen
        this.uiElements.loadingScreen.style.display = 'none';
        
        // Check if enemy should appear
        this.checkEnemyAppearance();
    }
    
    showMessage(text, duration = 5000) {
        this.uiElements.messageText.textContent = text;
        this.uiElements.messageContainer.classList.add('visible');
        
        setTimeout(() => {
            this.uiElements.messageContainer.classList.remove('visible');
        }, duration);
    }
    
    setupEventListeners() {
        // Main control buttons
        this.uiElements.hideBtn.addEventListener('click', () => this.handleHide());
        this.uiElements.inspectBtn.addEventListener('click', () => this.handleInspect());
        this.uiElements.moveBtn.addEventListener('click', () => this.showMoveOptions());
    }
    
    handleHide() {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        
        if (!room.hidingSpots || room.hidingSpots.length === 0) {
            this.showMessage("There's nowhere to hide in this room!");
            return;
        }
        
        // Show hiding options
        this.showInteractionMenu(
            room.hidingSpots.map(spot => ({
                text: `Hide in ${spot.name}`,
                action: () => this.hideIn(spot.id)
            })),
            'Where will you hide?'
        );
    }
    
    hideIn(spotId) {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        const spot = room.hidingSpots.find(s => s.id === spotId);
        
        this.gameState.isHiding = true;
        this.showMessage(`You're hiding in ${spot.name}. Stay quiet...`);
        
        // Apply hiding filter effect to panorama
        this.panoramaViewer.applyHidingEffect();
        
        // Check if this helps avoid the enemy
        if (this.gameState.enemyPresent) {
            const spotQuality = spot.quality || 0.5;
            if (Math.random() > spotQuality) {
                // Found by enemy
                setTimeout(() => {
                    this.gameState.isHiding = false;
                    this.panoramaViewer.removeHidingEffect();
                    this.showMessage("You've been found! The asylum attendant drags you away...");
                    setTimeout(() => this.gameOver(), 3000);
                }, 3000 + Math.random() * 2000);
            } else {
                // Successfully hidden
                setTimeout(() => {
                    this.gameState.isHiding = false;
                    this.gameState.enemyPresent = false;
                    this.panoramaViewer.removeHidingEffect();
                    this.panoramaViewer.removeEnemy();
                    this.showMessage("You hear footsteps fade away. The danger has passed... for now.");
                }, 5000 + Math.random() * 3000);
            }
        } else {
            // No enemy present, just exit hiding after a while
            setTimeout(() => {
                this.gameState.isHiding = false;
                this.panoramaViewer.removeHidingEffect();
                this.showMessage("You come out of hiding.");
            }, 3000);
        }
        
        this.closeInteractionMenu();
    }
    
    handleInspect() {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        const visibleObjects = this.panoramaViewer.getVisibleObjects();
        
        const interactableObjects = room.objects.filter(obj => 
            visibleObjects.includes(obj.id) && obj.interactable !== false);
        
        if (interactableObjects.length === 0) {
            this.showMessage("There's nothing of interest in your current view. Try looking around more.");
            return;
        }
        
        this.showInteractionMenu(
            interactableObjects.map(obj => ({
                text: `Examine ${obj.name}`,
                action: () => this.examineObject(obj.id)
            })),
            'What would you like to examine?'
        );
    }
    
    examineObject(objectId) {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        const object = room.objects.find(obj => obj.id === objectId);
        
        this.showMessage(object.description);
        
        // If the object is collectible, add to inventory
        if (object.collectible) {
            this.collectItem(object);
            // Remove from room
            room.objects = room.objects.filter(obj => obj.id !== objectId);
            this.panoramaViewer.removeSceneObject(objectId);
        }
        
        // If object has special effect or unlocks something
        if (object.effect) {
            this.triggerObjectEffect(object);
        }
        
        this.closeInteractionMenu();
    }
    
    collectItem(item) {
        this.gameState.inventory.push({
            id: item.id,
            name: item.name,
            description: item.description,
            icon: item.icon
        });
        
        this.showMessage(`You've collected: ${item.name}`);
        this.updateInventoryDisplay();
    }
    
    updateInventoryDisplay() {
        this.uiElements.inventoryItems.innerHTML = '';
        
        this.gameState.inventory.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'inventory-item';
            itemEl.dataset.itemId = item.id;
            itemEl.innerHTML = item.icon || `<span>${item.name.charAt(0)}</span>`;
            itemEl.title = item.name;
            
            itemEl.addEventListener('click', () => this.useItem(item.id));
            
            this.uiElements.inventoryItems.appendChild(itemEl);
        });
    }
    
    useItem(itemId) {
        const item = this.gameState.inventory.find(i => i.id === itemId);
        
        this.showInteractionMenu([
            {
                text: `Examine ${item.name}`,
                action: () => {
                    this.showMessage(item.description);
                    this.closeInteractionMenu();
                }
            },
            {
                text: `Use ${item.name}`,
                action: () => this.attemptToUseItem(item)
            }
        ], `What would you like to do with ${item.name}?`);
    }
    
    attemptToUseItem(item) {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        const usableOn = room.objects.filter(obj => obj.requiresItem === item.id);
        
        if (usableOn.length === 0) {
            this.showMessage(`You can't find a use for ${item.name} here.`);
            this.closeInteractionMenu();
            return;
        }
        
        this.showInteractionMenu(
            usableOn.map(obj => ({
                text: `Use ${item.name} on ${obj.name}`,
                action: () => this.useItemOn(item.id, obj.id)
            })),
            `What would you like to use ${item.name} on?`
        );
    }
    
    useItemOn(itemId, objectId) {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        const object = room.objects.find(obj => obj.id === objectId);
        
        this.showMessage(object.unlockText || `You used the item on ${object.name}.`);
        
        // Trigger the unlock effect
        if (object.unlocksRoomId) {
            room.connectedRooms.push(object.unlocksRoomId);
            this.showMessage(object.unlockText || "You've unlocked a new path!");
        }
        
        // If this completes an objective
        if (object.completesObjective) {
            this.progressStory(object.completesObjective);
        }
        
        // Remove the item if it's consumed
        if (object.consumesItem) {
            this.gameState.inventory = this.gameState.inventory.filter(i => i.id !== itemId);
            this.updateInventoryDisplay();
        }
        
        this.closeInteractionMenu();
    }
    
    showMoveOptions() {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        
        if (room.connectedRooms.length === 0) {
            this.showMessage("There are no exits from this room yet. You need to find a way out.");
            return;
        }
        
        const moveOptions = room.connectedRooms.map(roomId => {
            const connectedRoom = this.gameState.rooms[roomId] || { name: "Unknown Room" };
            return {
                text: `Go to ${connectedRoom.name || "the next room"}`,
                action: () => this.moveToRoom(roomId)
            };
        });
        
        this.showInteractionMenu(moveOptions, "Where would you like to go?");
    }
    
    async moveToRoom(roomId) {
        this.closeInteractionMenu();
        
        // Check if room exists, if not generate it
        if (!this.gameState.rooms[roomId]) {
            this.uiElements.loadingScreen.style.display = 'flex';
            const newRoom = await this.roomGenerator.generateRoom(roomId);
            this.gameState.rooms[roomId] = newRoom;
            this.uiElements.loadingScreen.style.display = 'none';
        }
        
        // Move to the new room
        this.gameState.currentRoom = roomId;
        this.showMessage(`You enter ${this.gameState.rooms[roomId].name}...`);
        
        // Load the new room
        await this.loadCurrentRoom();
    }
    
    setupObjectInteractionHandlers() {
        // Update the panorama object click handler
        this.panoramaViewer.onObjectClick = (objectId) => {
            this.handleObjectInteraction(objectId);
        };
        
        // Create the outliner for hover effects
        this.panoramaViewer.createOutliner();
    }
    
    handleObjectInteraction(objectId) {
        const room = this.gameState.rooms[this.gameState.currentRoom];
        
        // First check if it's a manually created object
        let object = room.objects.find(obj => obj.id === objectId);
        
        // If not found, it might be a detected object
        if (!object && this.panoramaViewer.sceneObjects.has(objectId)) {
            const sceneObj = this.panoramaViewer.sceneObjects.get(objectId);
            if (sceneObj && sceneObj.userData && sceneObj.userData.detectedObject) {
                const detectedObj = sceneObj.userData.detectedObject;
                
                // Create a game object from the detected object
                object = {
                    id: objectId,
                    name: detectedObj.name,
                    description: detectedObj.description,
                    collectible: detectedObj.collectible,
                    // Add to room objects so it persists
                    seen: true
                };
                
                // Add to room objects if not already there
                if (!room.objects.some(o => o.id === objectId)) {
                    room.objects.push(object);
                }
            }
        }
        
        if (object) {
            this.showInteractionMenu([
                {
                    text: `Examine ${object.name}`,
                    action: () => this.examineObject(object.id)
                },
                ...(object.collectible ? [{
                    text: `Take ${object.name}`,
                    action: () => this.collectItem(object)
                }] : [])
            ], `What would you like to do with ${object.name}?`);
        }
    }
    
    showInteractionMenu(options, title = null) {
        const menu = this.uiElements.interactionMenu;
        menu.innerHTML = '';
        
        if (title) {
            const titleEl = document.createElement('h4');
            titleEl.textContent = title;
            menu.appendChild(titleEl);
        }
        
        options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'interaction-option';
            button.textContent = option.text;
            button.addEventListener('click', option.action);
            menu.appendChild(button);
        });
        
        // Position menu in center of screen
        menu.style.top = '50%';
        menu.style.left = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
        
        menu.classList.remove('hidden');
    }
    
    closeInteractionMenu() {
        this.uiElements.interactionMenu.classList.add('hidden');
    }
    
    checkEnemyAppearance() {
        // Chance of enemy appearing increases as you progress
        const room = this.gameState.rooms[this.gameState.currentRoom];
        
        if (room.enemyFree) return; // Some rooms are safe
        
        const enemyChance = 0.2 + (Object.keys(this.gameState.rooms).length * 0.05);
        
        if (Math.random() < enemyChance && !this.gameState.enemyPresent) {
            this.gameState.enemyPresent = true;
            this.panoramaViewer.spawnEnemy();
            
            this.showMessage("You hear footsteps approaching. Something is coming...");
            
            // Start the enemy detection loop
            this.enemyDetectionLoop();
        }
    }
    
    enemyDetectionLoop() {
        if (!this.gameState.enemyPresent) return;
        
        if (!this.gameState.isHiding) {
            this.gameState.enemyAwareness += 0.2;
            
            if (this.gameState.enemyAwareness >= 1) {
                // Caught by enemy
                this.showMessage("The asylum attendant has found you!");
                setTimeout(() => this.gameOver(), 2000);
                return;
            }
            
            this.panoramaViewer.updateEnemyProximity(this.gameState.enemyAwareness);
        }
        
        setTimeout(() => this.enemyDetectionLoop(), 1000);
    }
    
    triggerObjectEffect(object) {
        switch(object.effect) {
            case 'reveal_exit':
                const room = this.gameState.rooms[this.gameState.currentRoom];
                if (!room.connectedRooms.includes('exit')) {
                    room.connectedRooms.push('exit');
                    this.showMessage("You've discovered a way out of this room!");
                }
                break;
            case 'spawn_enemy':
                if (!this.gameState.enemyPresent) {
                    this.gameState.enemyPresent = true;
                    this.panoramaViewer.spawnEnemy();
                    this.showMessage("Your actions have alerted something in the asylum...");
                    this.enemyDetectionLoop();
                }
                break;
            case 'story_progress':
                this.progressStory(object.storyId);
                break;
        }
    }
    
    progressStory(storyId) {
        // Handle story progression events
        switch(storyId) {
            case 'found_key':
                this.showMessage("This key might open an important door. Keep looking for a way out.");
                break;
            case 'found_medical_records':
                this.showMessage("These records suggest horrific experiments were conducted here. You need to escape quickly.");
                break;
            case 'final_exit':
                this.winGame();
                break;
        }
    }
    
    gameOver() {
        this.panoramaViewer.fadeToBlack();
        
        setTimeout(() => {
            this.uiElements.loadingScreen.style.display = 'flex';
            document.querySelector('#loading-screen p').textContent = "You have been captured. Your fate is sealed.";
            
            setTimeout(() => {
                location.reload(); // Restart the game
            }, 5000);
        }, 2000);
    }
    
    winGame() {
        this.panoramaViewer.fadeToWhite();
        
        setTimeout(() => {
            this.uiElements.loadingScreen.style.display = 'flex';
            document.querySelector('#loading-screen p').textContent = "You've escaped the asylum. Freedom at last...";
            
            setTimeout(() => {
                location.reload(); // Restart the game
            }, 7000);
        }, 2000);
    }
}

// Start the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    const game = new AsylumEscapeGame();
    game.init();
});