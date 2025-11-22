import React, { useRef, useEffect, useCallback, useState } from 'react';
import { EntityType, GameState, PlayerStats, Room, RoomType, Vector2, Entity, MultiplayerRole, MultiPlayerEntity, InputPacket, StatePacket, Projectile, Item } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FRICTION, TEAR_FRICTION, TILE_SIZE } from '../constants';
import { audioManager as am } from '../services/audioService';
import { multiplayer } from '../services/multiplayerService';

interface GameCanvasProps {
  gameState: GameState;
  rooms: Room[];
  currentRoomIndex: number;
  playerStats: PlayerStats; // Used as base stats for local player or client
  onRoomChange: (newIndex: number) => void;
  onPlayerStatUpdate: (newStats: PlayerStats) => void;
  onGameOver: (victory: boolean) => void;
  onTogglePause: () => void;
  onNextFloor: () => void;
  multiplayerRole: MultiplayerRole;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  rooms,
  currentRoomIndex,
  playerStats,
  onRoomChange,
  onPlayerStatUpdate,
  onGameOver,
  onTogglePause,
  onNextFloor,
  multiplayerRole
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // --- STATE STORAGE ---
  // Host: maintains the "Truth"
  // Client: receives the "Truth"
  const activeRoomRef = useRef<Room | null>(null);
  
  // MULTIPLAYER STATE
  // A map of all players in the session. 
  // Key: PeerID (or 'host' for local host).
  const playersRef = useRef<Map<string, MultiPlayerEntity>>(new Map());
  
  // CLIENT ONLY: Snapshot of world to render
  const clientWorldState = useRef<StatePacket | null>(null);

  // Input State (Local)
  const keysPressed = useRef<Set<string>>(new Set());

  // HOST ONLY: Input Map from clients
  const clientInputs = useRef<Map<string, string[]>>(new Map());

  // Initialization
  useEffect(() => {
    // Initialize local player in the map
    const myId = multiplayerRole === 'HOST' ? 'host' : multiplayer.getMyId();
    
    if (!playersRef.current.has(myId)) {
        const colors = ['#fce4d6', '#a9dfbf', '#aed6f1', '#f9e79f'];
        // Assign color based on something deterministic or random
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        playersRef.current.set(myId, {
            id: myId,
            pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
            vel: { x: 0, y: 0 },
            stats: { ...playerStats },
            color: color,
            isDead: false
        });
    }

    if (rooms[currentRoomIndex]) {
      activeRoomRef.current = rooms[currentRoomIndex];
    }

    // Setup Multiplayer Listeners
    multiplayer.setOnData((data: any) => {
        if (multiplayerRole === 'HOST') {
            if (data.type === 'INPUT') {
                const packet = data as InputPacket;
                clientInputs.current.set(packet.playerId, packet.keys);
                
                // If new player, add them
                if (!playersRef.current.has(packet.playerId)) {
                    // Simple spawn logic
                    playersRef.current.set(packet.playerId, {
                        id: packet.playerId,
                        pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 },
                        vel: { x: 0, y: 0 },
                        stats: { ...playerStats, maxHp: 6, currentHp: 6 }, // Default stats for now
                        color: '#a9dfbf', // Default P2 color
                        isDead: false
                    });
                }
            }
        } else if (multiplayerRole === 'CLIENT') {
             if (data.type === 'STATE') {
                 clientWorldState.current = data as StatePacket;
                 // Sync local stats display from server data for my ID
                 const myId = multiplayer.getMyId();
                 const me = data.players.find((p: MultiPlayerEntity) => p.id === myId);
                 if (me) {
                     onPlayerStatUpdate(me.stats);
                     if (data.roomIndex !== currentRoomIndex) {
                         onRoomChange(data.roomIndex);
                     }
                 }
             }
        }
    });

  }, [rooms, currentRoomIndex, multiplayerRole]);

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTogglePause();
      keysPressed.current.add(e.key.toLowerCase());
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onTogglePause]);


  // --- HOST LOGIC: PHYSICS & GAME PLAY ---
  const updateHost = useCallback(() => {
    if (gameState !== GameState.PLAYING || !activeRoomRef.current) return;
    const room = activeRoomRef.current;
    const now = Date.now();

    // 1. Process Players
    // Merge local input into the input map for consistency
    const myId = 'host';
    clientInputs.current.set(myId, Array.from(keysPressed.current));

    let activePlayersCount = 0;

    playersRef.current.forEach((p, pid) => {
        if (p.isDead) return;
        activePlayersCount++;

        const inputKeys = new Set(clientInputs.current.get(pid) || []);
        
        // Movement
        const inputVector = { x: 0, y: 0 };
        if (inputKeys.has('w') || inputKeys.has('ц')) inputVector.y -= 1;
        if (inputKeys.has('s') || inputKeys.has('ы')) inputVector.y += 1;
        if (inputKeys.has('a') || inputKeys.has('ф')) inputVector.x -= 1;
        if (inputKeys.has('d') || inputKeys.has('в')) inputVector.x += 1;

        if (inputVector.x !== 0 || inputVector.y !== 0) {
            const len = Math.sqrt(inputVector.x**2 + inputVector.y**2);
            p.vel.x += (inputVector.x / len) * p.stats.speed * 0.5;
            p.vel.y += (inputVector.y / len) * p.stats.speed * 0.5;
        }

        p.vel.x *= FRICTION;
        p.vel.y *= FRICTION;
        p.pos.x += p.vel.x;
        p.pos.y += p.vel.y;

        // Walls
        const margin = TILE_SIZE + 15;
        if (p.pos.x < margin) p.pos.x = margin;
        if (p.pos.x > CANVAS_WIDTH - margin) p.pos.x = CANVAS_WIDTH - margin;
        if (p.pos.y < margin) p.pos.y = margin;
        if (p.pos.y > CANVAS_HEIGHT - margin) p.pos.y = CANVAS_HEIGHT - margin;

        // Shooting (Using internal property to track cooldown, dirty hack for now)
        const lastShotKey = `lastShot_${pid}`;
        const lastShot = (p as any)[lastShotKey] || 0;
        const fireDelay = Math.max(200, p.stats.fireRate * 60);

        if (now - lastShot > fireDelay) {
            let shotDir = { x: 0, y: 0 };
            if (inputKeys.has('arrowup')) shotDir.y = -1;
            else if (inputKeys.has('arrowdown')) shotDir.y = 1;
            else if (inputKeys.has('arrowleft')) shotDir.x = -1;
            else if (inputKeys.has('arrowright')) shotDir.x = 1;

            if (shotDir.x !== 0 || shotDir.y !== 0) {
                am.playShoot();
                (p as any)[lastShotKey] = now;
                room.projectiles.push({
                    id: Math.random().toString(),
                    type: EntityType.PROJECTILE,
                    owner: 'player',
                    pos: { ...p.pos },
                    vel: { 
                        x: shotDir.x * (8 + p.stats.shotSpeed) + p.vel.x * 0.3, 
                        y: shotDir.y * (8 + p.stats.shotSpeed) + p.vel.y * 0.3 
                    },
                    size: 5 + (p.stats.damage * 0.5),
                    hp: 1, maxHp: 1, damage: p.stats.damage,
                    color: '#3498db',
                    range: p.stats.range * 30,
                    distanceTraveled: 0
                });
            }
        }
    });

    // All players dead?
    if (activePlayersCount === 0 && playersRef.current.size > 0) {
        onGameOver(false);
        return;
    }

    // 2. Projectiles
    for (let i = room.projectiles.length - 1; i >= 0; i--) {
      const proj = room.projectiles[i];
      proj.pos.x += proj.vel.x;
      proj.pos.y += proj.vel.y;
      proj.distanceTraveled += Math.sqrt(proj.vel.x**2 + proj.vel.y**2);
      proj.vel.x *= TEAR_FRICTION;
      proj.vel.y *= TEAR_FRICTION;

      let hit = false;
      if (proj.pos.x < TILE_SIZE || proj.pos.x > CANVAS_WIDTH - TILE_SIZE || 
          proj.pos.y < TILE_SIZE || proj.pos.y > CANVAS_HEIGHT - TILE_SIZE) hit = true;
      if (proj.distanceTraveled > proj.range) hit = true;

      if (!hit) {
          if (proj.owner === 'player') {
              room.enemies.forEach(enemy => {
                  const dist = Math.sqrt((proj.pos.x - enemy.pos.x)**2 + (proj.pos.y - enemy.pos.y)**2);
                  if (dist < enemy.size + proj.size) {
                      enemy.hp -= proj.damage;
                      enemy.vel.x += proj.vel.x * 0.3;
                      enemy.vel.y += proj.vel.y * 0.3;
                      hit = true;
                      am.playHit();
                  }
              });
          } else {
               // Enemy projectile hitting ANY player
               playersRef.current.forEach(p => {
                   if (p.isDead) return;
                   const dist = Math.sqrt((proj.pos.x - p.pos.x)**2 + (proj.pos.y - p.pos.y)**2);
                   if (dist < 10 + proj.size) {
                       p.stats.currentHp -= 1;
                       hit = true;
                       am.playHit();
                       if (p.stats.currentHp <= 0) p.isDead = true;
                       // Update local stats if it's the host
                       if (p.id === 'host') onPlayerStatUpdate({...p.stats});
                   }
               });
          }
      }
      if (hit) room.projectiles.splice(i, 1);
    }

    // 3. Enemy Logic (Simplified for brevity, targeting closest player)
    let activeEnemies = 0;
    for (let i = room.enemies.length - 1; i >= 0; i--) {
        const e = room.enemies[i];
        
        // Trapdoor
        if (e.type === EntityType.TRAPDOOR) {
            playersRef.current.forEach(p => {
                if (Math.sqrt((p.pos.x - e.pos.x)**2 + (p.pos.y - e.pos.y)**2) < 30) {
                    onNextFloor(); // Only host triggers this, resets floor for everyone
                }
            });
            continue;
        }

        if (e.hp <= 0) {
            if (Math.random() > 0.7) {
                 room.items.push({
                     id: Math.random().toString(),
                     name: "Penny", description: "+1 Coin", type: 'pickup', cost: 0, pos: { ...e.pos }
                 });
            }
            room.enemies.splice(i, 1);
            continue;
        }
        activeEnemies++;

        // Find closest player
        let target = null;
        let minDst = 9999;
        playersRef.current.forEach(p => {
            if (p.isDead) return;
            const d = Math.sqrt((p.pos.x - e.pos.x)**2 + (p.pos.y - e.pos.y)**2);
            if (d < minDst) { minDst = d; target = p; }
        });

        if (target) {
            const angle = Math.atan2(target.pos.y - e.pos.y, target.pos.x - e.pos.x);
            // Basic AI Movement from original file
            if (e.type === EntityType.ENEMY_FLY) {
                e.vel.x += Math.cos(angle) * 0.1; e.vel.y += Math.sin(angle) * 0.1;
            } else {
                // Generic chase for others
                e.vel.x += Math.cos(angle) * 0.15; e.vel.y += Math.sin(angle) * 0.15;
            }

            // Contact Damage
            if (minDst < e.size + 15) {
                if (Math.random() > 0.95) {
                    target.stats.currentHp -= 1;
                    am.playHit();
                    target.vel.x += (target.pos.x - e.pos.x) * 3;
                    target.vel.y += (target.pos.y - e.pos.y) * 3;
                    if (target.stats.currentHp <= 0) target.isDead = true;
                    if (target.id === 'host') onPlayerStatUpdate({...target.stats});
                }
            }
        }
        
        // Physics
        e.pos.x += e.vel.x; e.pos.y += e.vel.y;
        e.vel.x *= 0.9; e.vel.y *= 0.9;
    }

    // Room Clear Logic
    if (activeEnemies === 0 && !room.cleared) {
        room.cleared = true;
        am.playItemGet();
        if (room.type === RoomType.BOSS) {
             room.enemies.push({
               id: 'TRAPDOOR', type: EntityType.TRAPDOOR, pos: { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 },
               vel: { x:0, y:0 }, size: 30, hp: 9999, maxHp: 9999, damage: 0, color: 'black'
           });
        }
    }

    // Doors
    if (room.cleared) {
        room.doors.forEach(door => {
            // Check all players
            playersRef.current.forEach(p => {
                if(p.isDead) return;
                let doorX = 0, doorY = 0;
                if (door.direction === 'up') { doorX = CANVAS_WIDTH/2; doorY = TILE_SIZE; }
                if (door.direction === 'down') { doorX = CANVAS_WIDTH/2; doorY = CANVAS_HEIGHT - TILE_SIZE; }
                if (door.direction === 'left') { doorX = TILE_SIZE; doorY = CANVAS_HEIGHT/2; }
                if (door.direction === 'right') { doorX = CANVAS_WIDTH - TILE_SIZE; doorY = CANVAS_HEIGHT/2; }

                if (Math.sqrt((p.pos.x - doorX)**2 + (p.pos.y - doorY)**2) < 30) {
                    // Teleport ALL players
                    const targetIndex = rooms.findIndex(r => r.x === door.targetX && r.y === door.targetY);
                    if (targetIndex !== -1) {
                         playersRef.current.forEach(tm => {
                             tm.vel = {x:0, y:0};
                             if (door.direction === 'up') tm.pos.y = CANVAS_HEIGHT - TILE_SIZE * 2.5;
                             if (door.direction === 'down') tm.pos.y = TILE_SIZE * 2.5;
                             if (door.direction === 'left') tm.pos.x = CANVAS_WIDTH - TILE_SIZE * 2.5;
                             if (door.direction === 'right') tm.pos.x = TILE_SIZE * 2.5;
                         });
                         am.playDoor();
                         onRoomChange(targetIndex);
                    }
                }
            });
        });
    }

    // Items
    for (let i = room.items.length - 1; i >= 0; i--) {
        const item = room.items[i];
        let picked = false;
        playersRef.current.forEach(p => {
             if(picked || p.isDead) return;
             if (Math.sqrt((p.pos.x - item.pos.x)**2 + (p.pos.y - item.pos.y)**2) < 30) {
                 if (item.cost && item.cost > p.stats.coins) return;
                 if (item.cost) p.stats.coins -= item.cost;
                 
                 am.playItemGet();
                 if (item.name === "Penny") p.stats.coins++;
                 else {
                     if (item.statModifiers) {
                         if (item.statModifiers.hp) p.stats.currentHp = Math.min(p.stats.maxHp, p.stats.currentHp + item.statModifiers.hp);
                         if (item.statModifiers.damage) p.stats.damage += item.statModifiers.damage;
                         if (item.statModifiers.speed) p.stats.speed += item.statModifiers.speed;
                     }
                 }
                 picked = true;
                 if (p.id === 'host') onPlayerStatUpdate({...p.stats});
             }
        });
        if (picked) room.items.splice(i, 1);
    }

    // BROADCAST STATE
    const packet: StatePacket = {
        type: 'STATE',
        roomIndex: currentRoomIndex,
        players: Array.from(playersRef.current.values()),
        enemies: room.enemies,
        projectiles: room.projectiles,
        items: room.items,
        doorsOpen: room.cleared,
        floorName: "HOST_FLOOR" // Placeholder, handled by UI
    };
    multiplayer.sendToAll(packet);

  }, [gameState, currentRoomIndex, onGameOver, onPlayerStatUpdate, onRoomChange, onNextFloor]);


  // --- CLIENT LOGIC: SEND INPUT ---
  const updateClient = useCallback(() => {
       if (gameState !== GameState.PLAYING) return;
       
       // Send Input
       const inputPacket: InputPacket = {
           type: 'INPUT',
           playerId: multiplayer.getMyId(),
           keys: Array.from(keysPressed.current)
       };
       multiplayer.sendToHost(inputPacket);
  }, [gameState]);


  // --- RENDER ---
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Determine source of truth for rendering
    let playersToRender: MultiPlayerEntity[] = [];
    let enemiesToRender: Entity[] = [];
    let projToRender: Projectile[] = [];
    let itemsToRender: Item[] = [];
    let roomMeta: { cleared: boolean, doors: any[], type: RoomType } = { cleared: false, doors: [], type: RoomType.NORMAL };

    if (multiplayerRole === 'HOST' || multiplayerRole === 'NONE') {
        if (!activeRoomRef.current) return;
        playersToRender = Array.from(playersRef.current.values());
        enemiesToRender = activeRoomRef.current.enemies;
        projToRender = activeRoomRef.current.projectiles;
        itemsToRender = activeRoomRef.current.items;
        roomMeta = activeRoomRef.current;
    } else {
        // Client rendering from state
        if (!clientWorldState.current) return;
        playersToRender = clientWorldState.current.players;
        enemiesToRender = clientWorldState.current.enemies;
        projToRender = clientWorldState.current.projectiles;
        itemsToRender = clientWorldState.current.items;
        roomMeta.cleared = clientWorldState.current.doorsOpen;
        // Reconstruct doors locally or receive them? 
        // For simplicity, we need the actual room data for doors. 
        // Assume client has the same map layout (seeded) or just receive generic door positions.
        // To save bandwidth, we assume standard door positions based on roomMeta.cleared
        if (activeRoomRef.current) {
             roomMeta.doors = activeRoomRef.current.doors; // Client has local room array, syncs index
             roomMeta.type = activeRoomRef.current.type;
        }
    }

    // -- DRAWING CODE --
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#3e3129';
    ctx.fillRect(TILE_SIZE, TILE_SIZE, CANVAS_WIDTH - TILE_SIZE*2, CANVAS_HEIGHT - TILE_SIZE*2);
    
    // Grid
    ctx.strokeStyle = '#332720'; ctx.lineWidth = 2; ctx.beginPath();
    for(let x = TILE_SIZE; x < CANVAS_WIDTH - TILE_SIZE; x += 80) { ctx.moveTo(x, TILE_SIZE); ctx.lineTo(x, CANVAS_HEIGHT - TILE_SIZE); }
    for(let y = TILE_SIZE; y < CANVAS_HEIGHT - TILE_SIZE; y += 80) { ctx.moveTo(TILE_SIZE, y); ctx.lineTo(CANVAS_WIDTH - TILE_SIZE, y); }
    ctx.stroke();

    // Walls
    ctx.fillStyle = '#2c221e';
    ctx.fillRect(0,0,CANVAS_WIDTH,TILE_SIZE); ctx.fillRect(0,CANVAS_HEIGHT-TILE_SIZE,CANVAS_WIDTH,TILE_SIZE);
    ctx.fillRect(0,0,TILE_SIZE,CANVAS_HEIGHT); ctx.fillRect(CANVAS_WIDTH-TILE_SIZE,0,TILE_SIZE,CANVAS_HEIGHT);

    // Doors
    ctx.fillStyle = roomMeta.cleared ? '#95a5a6' : '#34495e';
    roomMeta.doors.forEach(door => {
         if (door.direction === 'up') ctx.fillRect(CANVAS_WIDTH/2 - 30, 0, 60, TILE_SIZE);
         if (door.direction === 'down') ctx.fillRect(CANVAS_WIDTH/2 - 30, CANVAS_HEIGHT - TILE_SIZE, 60, TILE_SIZE);
         if (door.direction === 'left') ctx.fillRect(0, CANVAS_HEIGHT/2 - 30, TILE_SIZE, 60);
         if (door.direction === 'right') ctx.fillRect(CANVAS_WIDTH - TILE_SIZE, CANVAS_HEIGHT/2 - 30, TILE_SIZE, 60);
    });

    // Items
    itemsToRender.forEach(item => {
        ctx.save();
        ctx.translate(item.pos.x, item.pos.y);
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 15, 12, 6, 0, 0, Math.PI*2); ctx.fill();
        if (item.name === "Penny") {
            ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(-12, -12, 24, 24);
            ctx.fillStyle = 'black'; ctx.textAlign = 'center'; ctx.fillText("?", 0, 5);
        }
        if (item.cost) {
            ctx.fillStyle = 'white'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${item.cost}`, 0, 25);
        }
        ctx.restore();
    });

    // Enemies
    enemiesToRender.forEach(e => {
        ctx.save(); ctx.translate(e.pos.x, e.pos.y);
        
        if (e.type === EntityType.TRAPDOOR) {
             ctx.fillStyle = 'black'; ctx.fillRect(-20,-20,40,40);
             ctx.restore(); return;
        }

        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, e.size, e.size, e.size/2, 0, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(0, 0, e.size, 0, Math.PI*2); ctx.fill();
        // Simple HP
        if (e.hp < e.maxHp) {
             const pct = Math.max(0, e.hp / e.maxHp);
             ctx.fillStyle = 'red'; ctx.fillRect(-10, -e.size - 5, 20, 3);
             ctx.fillStyle = 'green'; ctx.fillRect(-10, -e.size - 5, 20 * pct, 3);
        }
        ctx.restore();
    });

    // Players
    playersToRender.forEach(p => {
        if (p.isDead) {
             // Draw Ghost
             ctx.save(); ctx.translate(p.pos.x, p.pos.y);
             ctx.globalAlpha = 0.5;
             ctx.fillStyle = 'white';
             ctx.beginPath(); ctx.arc(0, -5, 15, 0, Math.PI*2); ctx.fill();
             ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(-5, -5, 2, 0, Math.PI*2); ctx.fill(); ctx.arc(5, -5, 2, 0, Math.PI*2); ctx.fill();
             ctx.restore();
             return;
        }
        ctx.save(); ctx.translate(p.pos.x, p.pos.y);
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(0, 20, 15, 5, 0, 0, Math.PI*2); ctx.fill();
        // Body
        ctx.fillStyle = p.color; // Player Color
        ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, 10); ctx.lineTo(0, 25); ctx.fill();
        // Head
        ctx.fillStyle = '#fce4d6'; // Skin
        ctx.beginPath(); ctx.arc(0, -5, 18, 0, Math.PI * 2); ctx.fill();
        // Eyes
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(-6, -5, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(6, -5, 3, 0, Math.PI*2); ctx.fill();
        // ID
        ctx.fillStyle = 'white'; ctx.font = '10px monospace'; ctx.textAlign='center';
        ctx.fillText(p.id.substring(0, 4), 0, -30);
        ctx.restore();
    });

    // Projectiles
    projToRender.forEach(p => {
        ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
    });

  }, [multiplayerRole]);


  // Game Loop
  useEffect(() => {
    const loop = () => {
      if (multiplayerRole === 'HOST' || multiplayerRole === 'NONE') updateHost();
      else updateClient();
      
      render();
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updateHost, updateClient, render, multiplayerRole]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="border-8 border-[#2c221e] shadow-2xl bg-black mx-auto cursor-none rounded-sm"
    />
  );
};

export default GameCanvas;