export enum GameState {
  MENU,
  SETTINGS,
  LOADING,
  PLAYING,
  PAUSED,
  GAME_OVER,
  VICTORY,
  MULTIPLAYER_LOBBY
}

export enum RoomType {
  START,
  NORMAL,
  TREASURE,
  BOSS,
  SHOP
}

export enum EntityType {
  PLAYER,
  ENEMY_FLY,
  ENEMY_SPIDER,
  ENEMY_GAPER,
  ENEMY_CLOTTY,
  ENEMY_POOTER,
  ENEMY_BOSS,
  PROJECTILE,
  ITEM_PICKUP,
  DOOR,
  TRAPDOOR
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector2;
  vel: Vector2;
  size: number; // Radius
  hp: number;
  maxHp: number;
  damage: number;
  color: string;
  remove?: boolean;
  lastAttackTime?: number;
  stateTimer?: number;
}

export interface Projectile extends Entity {
  owner: 'player' | 'enemy';
  range: number;
  distanceTraveled: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'passive' | 'active' | 'pickup';
  statModifiers?: {
    speed?: number;
    damage?: number;
    fireRate?: number;
    range?: number;
    hp?: number;
    shotSpeed?: number;
  };
  cost?: number;
  pos: Vector2;
}

export interface Room {
  x: number;
  y: number;
  type: RoomType;
  cleared: boolean;
  enemies: Entity[];
  items: Item[];
  projectiles: Projectile[];
  doors: { direction: 'up' | 'down' | 'left' | 'right'; targetX: number; targetY: number }[];
}

export interface PlayerStats {
  speed: number;
  damage: number;
  fireRate: number;
  range: number;
  shotSpeed: number;
  maxHp: number;
  currentHp: number;
  coins: number;
  keys: number;
  bombs: number;
}

// --- Multiplayer Types ---

export type MultiplayerRole = 'NONE' | 'HOST' | 'CLIENT';

export interface MultiPlayerEntity {
  id: string; // peerId
  pos: Vector2;
  vel: Vector2;
  stats: PlayerStats;
  color: string;
  isDead: boolean;
}

// Packet sent from Client to Host
export interface InputPacket {
  type: 'INPUT';
  playerId: string;
  keys: string[]; // Array of pressed keys
}

// Packet sent from Host to Client (World State)
export interface StatePacket {
  type: 'STATE';
  roomIndex: number;
  players: MultiPlayerEntity[];
  enemies: Entity[];
  projectiles: Projectile[];
  items: Item[];
  doorsOpen: boolean;
  floorName: string; // Sync floor name
}

export interface GameStartPacket {
    type: 'START_GAME';
    seed: number; // Not used yet, but good practice
    initialState: StatePacket;
}