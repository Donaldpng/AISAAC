import { Room, RoomType, EntityType, Entity, Item } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';

const ITEM_POOL: Partial<Item>[] = [
  { name: "Spoon Bender", description: "Homing shots", type: 'passive', statModifiers: { range: 5, shotSpeed: -0.5 } },
  { name: "Magic Mushroom", description: "All stats up!", type: 'passive', statModifiers: { damage: 1.0, speed: 0.3, hp: 2, range: 2 } },
  { name: "Pentagram", description: "Dmg up", type: 'passive', statModifiers: { damage: 1.5 } },
  { name: "Breakfast", description: "Hp up", type: 'passive', statModifiers: { hp: 2 } },
  { name: "Belt", description: "Speed up", type: 'passive', statModifiers: { speed: 0.3 } },
  { name: "Wire Coat Hanger", description: "Tears up", type: 'passive', statModifiers: { fireRate: -1 } },
];

export function generateDungeon(floor: number): Room[] {
  const rooms: Room[] = [];
  // Longer game: More rooms per floor
  const roomCount = 8 + Math.floor(Math.random() * 4) + (floor * 2);
  
  // Start room
  const startRoom: Room = {
    x: 0,
    y: 0,
    type: RoomType.START,
    cleared: true,
    enemies: [],
    items: [],
    projectiles: [],
    doors: []
  };
  rooms.push(startRoom);

  const queue = [startRoom];
  const createdCoords = new Set<string>(["0,0"]);

  let roomsCreated = 1;

  while (queue.length > 0 && roomsCreated < roomCount) {
    const current = queue.shift()!;
    const directions: { dir: 'up' | 'down' | 'left' | 'right', x: number, y: number }[] = [
        { dir: 'up', x: 0, y: -1 },
        { dir: 'down', x: 0, y: 1 },
        { dir: 'left', x: -1, y: 0 },
        { dir: 'right', x: 1, y: 0 }
    ];

    // Shuffle directions
    directions.sort(() => Math.random() - 0.5);

    for (const d of directions) {
      if (roomsCreated >= roomCount) break;
      
      const newX = current.x + d.x;
      const newY = current.y + d.y;
      const key = `${newX},${newY}`;

      if (!createdCoords.has(key) && Math.random() > 0.4) {
        const newRoom: Room = {
          x: newX,
          y: newY,
          type: RoomType.NORMAL, // Assigned later
          cleared: false,
          enemies: [],
          items: [],
          projectiles: [],
          doors: []
        };
        
        rooms.push(newRoom);
        createdCoords.add(key);
        queue.push(newRoom);
        roomsCreated++;
      }
    }
  }

  // Assign Special Rooms
  // Find furthest room for Boss
  let maxDist = 0;
  let bossRoomIndex = 0;
  rooms.forEach((r, i) => {
    const dist = Math.abs(r.x) + Math.abs(r.y);
    if (dist > maxDist) {
      maxDist = dist;
      bossRoomIndex = i;
    }
  });
  rooms[bossRoomIndex].type = RoomType.BOSS;
  rooms[bossRoomIndex].cleared = false;

  // Treasure Room (any non-start, non-boss)
  const availableForTreasure = rooms.filter((r, i) => i !== 0 && i !== bossRoomIndex);
  if (availableForTreasure.length > 0) {
    const treasureIndex = Math.floor(Math.random() * availableForTreasure.length);
    availableForTreasure[treasureIndex].type = RoomType.TREASURE;
    availableForTreasure[treasureIndex].cleared = true;
    
    // Add Item
    const itemTemplate = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
    availableForTreasure[treasureIndex].items.push({
        id: Math.random().toString(),
        name: itemTemplate.name || "Item",
        description: itemTemplate.description || "",
        type: 'passive',
        statModifiers: itemTemplate.statModifiers,
        pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }
    });
  }

  // Shop Room
  const availableForShop = rooms.filter(r => r.type === RoomType.NORMAL && r !== rooms[0]);
  if (availableForShop.length > 0) {
      const shopIdx = Math.floor(Math.random() * availableForShop.length);
      availableForShop[shopIdx].type = RoomType.SHOP;
      availableForShop[shopIdx].cleared = true;
      
      // Add 3 Shop Items
      for (let i = 0; i < 3; i++) {
          const isConsumable = Math.random() > 0.3;
          const shopItemPos = {
            x: (CANVAS_WIDTH / 2) + (i - 1) * 100,
            y: CANVAS_HEIGHT / 2
          };

          let shopItem: Item;

          if (isConsumable) {
              shopItem = {
                id: Math.random().toString(),
                name: "Heart",
                description: "Heal 1 Heart",
                type: 'pickup',
                statModifiers: { hp: 2 },
                cost: 3,
                pos: shopItemPos
              };
          } else {
               const itemTemplate = ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
               shopItem = {
                 id: Math.random().toString(),
                 name: itemTemplate.name || "?",
                 description: itemTemplate.description || "",
                 type: 'passive',
                 statModifiers: itemTemplate.statModifiers,
                 cost: 15, // Expensive passive items
                 pos: shopItemPos
               };
          }
          availableForShop[shopIdx].items.push(shopItem);
      }
  }

  // Populate Doors and Enemies
  rooms.forEach(room => {
     // Link doors
     const neighbors = [
        { dir: 'up', x: 0, y: -1 },
        { dir: 'down', x: 0, y: 1 },
        { dir: 'left', x: -1, y: 0 },
        { dir: 'right', x: 1, y: 0 }
     ];

     neighbors.forEach(n => {
        const targetX = room.x + n.x;
        const targetY = room.y + n.y;
        const neighbor = rooms.find(r => r.x === targetX && r.y === targetY);
        if (neighbor) {
            room.doors.push({
                direction: n.dir as any,
                targetX,
                targetY
            });
        }
     });

     // Add Enemies to Normal Rooms
     if (room.type === RoomType.NORMAL) {
        // Lower enemy count slightly for easier difficulty
        const enemyCount = 1 + Math.floor(Math.random() * 2 + floor * 0.4); 
        
        for(let i=0; i<enemyCount; i++) {
            const rand = Math.random();
            let enemyType = EntityType.ENEMY_FLY;
            // Balance HP down slightly
            let hp = 5;
            let size = 15;
            let color = '#95a5a6';
            let damage = 1;

            if (rand < 0.3) {
                enemyType = EntityType.ENEMY_FLY;
                hp = 6 + floor;
                size = 12;
                color = '#7f8c8d'; 
            } else if (rand < 0.5) {
                enemyType = EntityType.ENEMY_SPIDER;
                hp = 8 + floor;
                size = 14;
                color = '#2c3e50';
            } else if (rand < 0.7) {
                enemyType = EntityType.ENEMY_GAPER; 
                hp = 12 + floor * 2;
                size = 18;
                color = '#d35400'; 
            } else if (rand < 0.85) {
                enemyType = EntityType.ENEMY_CLOTTY; 
                hp = 15 + floor * 2;
                size = 20;
                color = '#c0392b'; 
            } else {
                enemyType = EntityType.ENEMY_POOTER; 
                hp = 10 + floor;
                size = 16;
                color = '#8e44ad'; 
            }

            room.enemies.push({
                id: Math.random().toString(),
                type: enemyType,
                pos: { x: 100 + Math.random() * (CANVAS_WIDTH - 200), y: 100 + Math.random() * (CANVAS_HEIGHT - 200) },
                vel: { x: 0, y: 0 },
                size,
                hp,
                maxHp: hp,
                damage,
                color,
                lastAttackTime: 0,
                stateTimer: 0
            });
        }
     }
     
     // Add Boss
     if (room.type === RoomType.BOSS) {
         room.enemies.push({
            id: 'BOSS',
            type: EntityType.ENEMY_BOSS,
            pos: { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 },
            vel: { x: 0, y: 0 },
            size: 45,
            hp: 60 + floor * 15, // Reduced Boss HP for better flow
            maxHp: 60 + floor * 15,
            damage: 2,
            color: '#8e44ad',
            lastAttackTime: 0,
            stateTimer: 0
         });
     }
  });

  return rooms;
}