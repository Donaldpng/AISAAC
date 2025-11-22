export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const TILE_SIZE = 40;

// Physics
export const FRICTION = 0.85;
export const PLAYER_BASE_SPEED = 1.5;
export const TEAR_FRICTION = 0.99;

// Colors
export const COLOR_BG = '#28201c'; // Basement floor color
export const COLOR_WALL = '#4a3b32';
export const COLOR_TEAR = '#3498db';
export const COLOR_ENEMY_TEAR = '#e74c3c';

// Sounds
export const AUDIO_CONTEXT = new (window.AudioContext || (window as any).webkitAudioContext)();
