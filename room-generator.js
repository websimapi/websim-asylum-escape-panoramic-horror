import { v4 as uuidv4 } from 'https://jspm.dev/uuid';

export class RoomGenerator {
    constructor() {
        this.roomTypes = [
            {
                name: "Patient Room",
                description: "A decaying patient room with a rusted bed frame and torn straitjacket. Medical equipment litters the floor.",
                prompt: "A terrifying abandoned psychiatric hospital patient room viewed in 360 panorama. Rusty medical equipment, peeling wallpaper, broken furniture, dim lighting with shadows, eerie atmosphere"
            },
            {
                name: "Morgue",
                description: "A cold, clinical morgue with metal slabs and rusted tools. The smell of formaldehyde lingers in the air.",
                prompt: "A horrifying abandoned asylum morgue in 360 panorama view. Rusty autopsy tables, medical instruments, opened body drawers, ominous shadows, cold blue lighting"
            },
            {
                name: "Operating Theater",
                description: "An abandoned operating theater with bloodstained floors and walls. Surgical tools are scattered around.",
                prompt: "A nightmarish abandoned asylum operating room in 360 panorama view. Blood-stained surgical equipment, broken lights hanging from ceiling, cracked tiles, eerie green lighting, surgical tools scattered"
            },
            {
                name: "Corridor",
                description: "A long, narrow corridor with flickering lights and peeling wallpaper. Wheelchairs and gurneys lie abandoned.",
                prompt: "A terrifying abandoned asylum corridor in 360 panorama view. Flickering lights, peeling wallpaper, abandoned wheelchairs, long shadows, broken windows with moonlight"
            },
            {
                name: "Administration Office",
                description: "An old administrative office with patient files scattered everywhere. The filing cabinets have been ransacked.",
                prompt: "A creepy abandoned asylum office in 360 panorama view. Scattered patient files, vintage furniture, broken typewriters, dusty filing cabinets, dim lighting with shadows"
            },
            {
                name: "Kitchen",
                description: "The asylum's kitchen, with large industrial equipment covered in rust and grime. The food storage is filled with rotten supplies.",
                prompt: "A disturbing abandoned asylum kitchen in 360 panorama view. Rusty kitchen equipment, broken dishes, decaying food, cockroaches, dim lighting with deep shadows"
            },
            {
                name: "Treatment Room",
                description: "A room filled with outdated and cruel treatment equipment. Electroshock therapy machines and ice bath tubs dominate the space.",
                prompt: "A horrifying abandoned asylum treatment room in 360 panorama view. Electroshock therapy equipment, restraint chairs, syringes, medicine bottles, ominous shadows"
            },
            {
                name: "Common Area",
                description: "Once a gathering space for patients, now an eerie open area with broken furniture and a TV still flickering static.",
                prompt: "A frightening abandoned asylum common area in 360 panorama view. Broken furniture, static-filled TV, board games with missing pieces, shadows in corners, moonlight through barred windows"
            }
        ];
        
        this.objectTypes = [
            {
                name: "Key",
                description: "An old brass key, possibly to a door or cabinet.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#daa520"><path d="M7,14A2,2 0 0,1 5,12A2,2 0 0,1 7,10A2,2 0 0,1 9,12A2,2 0 0,1 7,14M12.65,10C11.83,7.67 9.61,6 7,6A6,6 0 0,0 1,12A6,6 0 0,0 7,18C9.61,18 11.83,16.33 12.65,14H17V18H21V14H23V10H12.65Z" /></svg>`,
                collectible: true
            },
            {
                name: "Medical Record",
                description: "Patient files with disturbing notes about experimental treatments.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#f5f5dc"><path d="M14,17H7V15H14M17,13H7V11H17M17,9H7V7H17M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3Z" /></svg>`,
                collectible: true
            },
            {
                name: "Medicine Bottle",
                description: "A bottle of experimental medicine. The label warns of severe side effects.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#8a2be2"><path d="M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M7,5A2,2 0 0,0 5,7A2,2 0 0,0 7,9H9V11H7A4,4 0 0,1 3,7A4,4 0 0,1 7,3H12V5H7M17,15A2,2 0 0,0 15,13A2,2 0 0,0 13,15V17H15A2,2 0 0,0 17,15M12,19V13H17A4,4 0 0,1 21,17A4,4 0 0,1 17,21H12V19Z" /></svg>`,
                collectible: true
            },
            {
                name: "Bloody Scalpel",
                description: "A surgical scalpel with dried blood on it. It looks sharp enough to cut through restraints.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#8b0000"><path d="M20,19.88V22L18.2,20.83L13.41,11.83C14.07,11.62 14.67,11.28 15.19,10.83L20,19.88M15,7A3,3 0 0,1 12,10C11.85,10 11.71,10 11.56,9.94L5.8,20.83L4,22V19.88L9.79,9C9.68,8.7 9.65,8.36 9.7,8L4,3.5L5.5,2L11.13,7.63C11.5,7.68 11.86,7.8 12.17,8L20.23,2.5L22,4.14L15,7Z" /></svg>`,
                collectible: true
            },
            {
                name: "Patient's Journal",
                description: "A personal journal from a patient, detailing the horrors they experienced. Some pages mention a hidden exit in the basement.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#a0522d"><path d="M3,7V5H5V4C5,2.89 5.9,2 7,2H13V9L15.5,7.5L18,9V2H19C20.05,2 21,2.95 21,4V20C21,21.05 20.05,22 19,22H7C5.95,22 5,21.05 5,20V19H3V17H5V13H3V11H5V7H3M7,4V20H19V4H7Z" /></svg>`,
                collectible: true
            },
            {
                name: "Broken Mirror",
                description: "A shattered mirror on the wall. Your reflection looks distorted and wrong somehow.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#c0c0c0"><path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12C4,14.09 4.8,16 6.11,17.41L9.88,9.88L17.41,6.11C16,4.8 14.09,4 12,4M12,20A8,8 0 0,0 20,12C20,9.91 19.2,8 17.89,6.59L14.12,14.12L6.59,17.89C8,19.2 9.91,20 12,20M12,12L11.23,11.23L9.7,14.3L12.77,12.77L12,12M12,12L12.77,12.77L15.3,10.7L12.23,9.23L12,12Z" /></svg>`,
                collectible: false
            },
            {
                name: "Wheelchair",
                description: "An old rusted wheelchair with leather restraints. There are dark stains on the seat.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#696969"><path d="M18,16L15,13H13.5L15.5,16H5.5L7.5,13H6L3,16H1V18H3.17C3.06,18.5 3,19 3,19.5A4.5,4.5 0 0,0 7.5,24A4.5,4.5 0 0,0 12,19.5C12,19 11.94,18.5 11.83,18H18V16M7.5,20A1.5,1.5 0 0,1 6,18.5A1.5,1.5 0 0,1 7.5,17A1.5,1.5 0 0,1 9,18.5A1.5,1.5 0 0,1 7.5,20M16,2C15.45,2 15,2.45 15,3C15,3.55 15.45,4 16,4C16.55,4 17,3.55 17,3C17,2.45 16.55,2 16,2M12.5,3.5L10,8H7V11H10.5L13,6.5H16V3.5H12.5Z" /></svg>`,
                collectible: false
            },
            {
                name: "Locked Cabinet",
                description: "A metal cabinet with a sturdy lock. Something important might be inside.",
                icon: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="#708090"><path d="M4,2H20A2,2 0 0,1 22,4V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V4A2,2 0 0,1 4,2M4,4V20H20V4H4M13,11H16L12,7L8,11H11V17H13V11Z" /></svg>`,
                collectible: false,
                requiresItem: "key01",
                unlocksRoomId: "basement"
            }
        ];
        
        this.hidingSpotTypes = [
            {
                name: "Under the Bed",
                quality: 0.7,
                description: "A tight squeeze, but relatively safe."
            },
            {
                name: "Inside the Cabinet",
                quality: 0.8,
                description: "Small and cramped, but well-hidden."
            },
            {
                name: "Behind the Curtains",
                quality: 0.4,
                description: "Your silhouette might be visible."
            },
            {
                name: "Inside the Locker",
                quality: 0.9,
                description: "A classic hiding spot, very effective."
            },
            {
                name: "In the Ventilation Duct",
                quality: 0.6,
                description: "Uncomfortable but hidden from direct view."
            }
        ];
    }
    
    async generateRoom(roomId, customDescription = null) {
        let roomType;
        let roomName;
        let description;
        
        // If it's the starting room or we have a custom description
        if (roomId === "Starting Room" || customDescription) {
            roomName = roomId === "Starting Room" ? "Admission Room" : roomId;
            description = customDescription || "A decrepit room with peeling wallpaper and broken furniture.";
        } else {
            // Otherwise pick a random room type
            roomType = this.roomTypes[Math.floor(Math.random() * this.roomTypes.length)];
            roomName = roomType.name;
            description = roomType.description;
        }
        
        // Generate the panorama image using LLM image generation
        const panoramaPrompt = roomType ? roomType.prompt : 
            "A terrifying abandoned psychiatric hospital room viewed in 360 panorama. Peeling wallpaper, broken furniture, dim lighting with shadows, eerie atmosphere";
            
        const panoramaImage = await this.generatePanoramaImage(panoramaPrompt);
        
        // Create a unique ID for the room if not provided
        const id = roomId === "Starting Room" ? "start" : (roomId || uuidv4());
        
        // Generate room objects
        const objects = this.generateRoomObjects(3 + Math.floor(Math.random() * 3));
        
        // Generate hiding spots
        const hidingSpots = this.generateHidingSpots(1 + Math.floor(Math.random() * 2));
        
        // Determine connected rooms (initially empty, will be filled as player progresses)
        const connectedRooms = [];
        
        // 30% chance of being a "safe" room where enemies won't spawn
        const enemyFree = Math.random() < 0.3;
        
        return {
            id,
            name: roomName,
            description,
            panoramaUrl: panoramaImage,
            objects,
            hidingSpots,
            connectedRooms,
            enemyFree,
            visited: false
        };
    }
    
    async generatePanoramaImage(prompt) {
        try {
            // Generate panoramic horror image
            const result = await websim.imageGen({
                prompt: prompt,
                aspect_ratio: "16:9", // Use wide aspect ratio for better panoramic experience
                seed: Math.floor(Math.random() * 1000) // Random seed for variety
            });
            
            return result.url;
        } catch (error) {
            console.error("Error generating image:", error);
            // Fallback to a placeholder in case of error
            return "https://placehold.co/1024x576/111/333?text=Asylum+Room";
        }
    }
    
    generateRoomObjects(count) {
        const objects = [];
        
        // Pick random objects from the object types
        const shuffledObjects = [...this.objectTypes].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < count; i++) {
            if (i >= shuffledObjects.length) break;
            
            const objectType = shuffledObjects[i];
            const object = {
                id: `${objectType.name.toLowerCase().replace(/\s/g, '-')}-${uuidv4().slice(0, 4)}`,
                name: objectType.name,
                description: objectType.description,
                icon: objectType.icon,
                position: this.generateRandomPosition(),
                scale: 0.8 + Math.random() * 0.4,
                collectible: objectType.collectible || false,
                seen: false
            };
            
            // If the object requires an item to interact with
            if (objectType.requiresItem) {
                object.requiresItem = objectType.requiresItem;
            }
            
            // If the object unlocks a new room
            if (objectType.unlocksRoomId) {
                object.unlocksRoomId = objectType.unlocksRoomId;
                object.unlockText = `You've unlocked access to the ${objectType.unlocksRoomId}!`;
            }
            
            objects.push(object);
        }
        
        return objects;
    }
    
    generateHidingSpots(count) {
        const hidingSpots = [];
        
        // Pick random hiding spots from the hiding spot types
        const shuffledHidingSpots = [...this.hidingSpotTypes].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < count; i++) {
            if (i >= shuffledHidingSpots.length) break;
            
            const spotType = shuffledHidingSpots[i];
            hidingSpots.push({
                id: `${spotType.name.toLowerCase().replace(/\s/g, '-')}-${uuidv4().slice(0, 4)}`,
                name: spotType.name,
                description: spotType.description,
                quality: spotType.quality
            });
        }
        
        return hidingSpots;
    }
    
    generateRandomPosition() {
        // Generate random spherical coordinates for object placement
        return {
            x: Math.random() * 360, // longitude (0-360)
            y: 30 + Math.random() * 60 // latitude (30-90, keeping objects mostly in front)
        };
    }
}

