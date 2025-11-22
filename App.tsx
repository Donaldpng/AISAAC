import React, { useState, useCallback } from 'react';
import { GameState, Room, PlayerStats, MultiplayerRole } from './types';
import GameCanvas from './components/GameCanvas';
import UI from './components/UI';
import { generateDungeon } from './utils/dungeon';
import { generateLevelTheme } from './services/geminiService';
import { audioManager } from './services/audioService';
import { multiplayer } from './services/multiplayerService';

const INITIAL_STATS: PlayerStats = {
  speed: 1.0,
  damage: 4.0,
  fireRate: 5,
  range: 15,
  shotSpeed: 1.0,
  maxHp: 6,
  currentHp: 6,
  coins: 0,
  keys: 0,
  bombs: 0
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [stats, setStats] = useState<PlayerStats>(INITIAL_STATS);
  const [floor, setFloor] = useState(1);
  const [volume, setVolume] = useState(0.3);
  
  // Narrative state
  const [floorName, setFloorName] = useState("BASEMENT I");
  const [floorCurse, setFloorCurse] = useState("");

  // Multiplayer State
  const [mpRole, setMpRole] = useState<MultiplayerRole>('NONE');
  const [lobbyId, setLobbyId] = useState("");
  const [joinId, setJoinId] = useState("");
  const [lobbyStatus, setLobbyStatus] = useState("");

  const generateLevel = async (levelNumber: number) => {
      setFloorName(`FLOOR ${levelNumber}`);
      setFloorCurse("Loading...");
      
      const newRooms = generateDungeon(levelNumber);
      setRooms(newRooms);
      setCurrentRoomIndex(0);
      
      try {
          const lore = await generateLevelTheme(levelNumber);
          setFloorName(lore.title);
          setFloorCurse(lore.curse);
      } catch(e) { console.warn(e); }
  };

  const startGame = useCallback(async () => {
    setGameState(GameState.LOADING);
    setStats(INITIAL_STATS);
    setFloor(1);
    
    await generateLevel(1);

    setTimeout(() => {
       setGameState(GameState.PLAYING);
    }, 2000); 
  }, []);

  // --- MULTIPLAYER HANDLERS ---
  const startHost = async () => {
      setLobbyStatus("Initializing Host...");
      const id = await multiplayer.initialize(true);
      setLobbyId(id);
      setMpRole('HOST');
      setLobbyStatus("Waiting for players...");
  };

  const joinGame = async () => {
      setLobbyStatus("Connecting...");
      try {
          await multiplayer.initialize(false);
          await multiplayer.connectToHost(joinId);
          setMpRole('CLIENT');
          setLobbyStatus("Connected! Waiting for host...");
          
          // Listen for Start Game or State
          multiplayer.setOnData((data: any) => {
              if (data.type === 'STATE') {
                 // First state packet means game started
                 if (gameState !== GameState.PLAYING) {
                     setGameState(GameState.PLAYING);
                 }
                 // Room syncing is handled in GameCanvas via refs, 
                 // but we need rooms array for GameCanvas to render properly
                 // For Client, we generate a dummy room or receive seed. 
                 // For this demo, we let GameCanvas receive the entities and we just pass empty structure
                 // Actually, let's generate the same dungeon structure if possible, or just an empty shell.
                 // Simplified: Client just renders what Host sends, ignores local `rooms` logic except for rendering walls.
                 // We need at least one room to prevent crash
                 if (rooms.length === 0) {
                      setRooms(generateDungeon(1)); // Syncing dungeon structure is complex, just generate local dummy
                 }
              }
          });

      } catch (e) {
          setLobbyStatus("Connection Failed");
          console.error(e);
      }
  };

  const startMultiplayerGame = async () => {
      if (mpRole === 'HOST') {
          // Generate level and start
          await startGame();
          // GameCanvas will automatically start broadcasting
      }
  };


  const handleNextFloor = useCallback(async () => {
      setGameState(GameState.LOADING);
      const nextFloor = floor + 1;
      setFloor(nextFloor);
      
      await generateLevel(nextFloor);

      setTimeout(() => {
         setGameState(GameState.PLAYING);
      }, 2000);
  }, [floor]);

  const handleGameOver = (victory: boolean) => {
      setGameState(victory ? GameState.VICTORY : GameState.GAME_OVER);
      multiplayer.destroy();
  };

  const handleRoomChange = (index: number) => {
      setCurrentRoomIndex(index);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setVolume(v);
      audioManager.setVolume(v);
  };

  return (
    <div className="w-full h-screen bg-[#1a1a1a] flex items-center justify-center flex-col overflow-hidden relative font-hand">
      
      <div className="absolute inset-0 bg-[#f4e4bc] opacity-10 pointer-events-none z-0 mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0)_50%,rgba(0,0,0,0.6)_100%)] pointer-events-none z-40"></div>

      {gameState === GameState.MENU && (
        <div className="relative z-10 w-full max-w-lg text-center p-10 bg-[#f4e4bc] text-black border-4 border-dashed border-[#5a4635] shadow-[10px_10px_0px_0px_rgba(0,0,0,0.5)] rotate-1">
           <h1 className="text-5xl mb-8 font-bold transform -rotate-2 drop-shadow-md">
             ISAAC CLONE
           </h1>
           <div className="flex flex-col gap-4 items-center">
             <button 
               onClick={() => { setMpRole('NONE'); startGame(); }}
               className="text-2xl hover:scale-110 transition-transform hover:text-red-700 font-bold"
             >
               SINGLE PLAYER
             </button>
             <button 
               onClick={() => setGameState(GameState.MULTIPLAYER_LOBBY)}
               className="text-2xl hover:scale-110 transition-transform hover:text-blue-700 font-bold"
             >
               CO-OP (P2P)
             </button>
             <button 
               onClick={() => setGameState(GameState.SETTINGS)}
               className="text-2xl hover:scale-110 transition-transform hover:text-gray-700 font-bold"
             >
               OPTIONS
             </button>
           </div>
           <div className="mt-12 opacity-60 text-sm">
             <p>Controls: WASD + Arrows</p>
           </div>
        </div>
      )}

      {gameState === GameState.MULTIPLAYER_LOBBY && (
          <div className="relative z-10 w-full max-w-lg text-center p-10 bg-[#f4e4bc] text-black border-4 border-dashed border-[#5a4635] -rotate-1">
              <h2 className="text-3xl mb-6 font-bold">CO-OP LOBBY</h2>
              
              {!lobbyId && mpRole === 'NONE' && (
                  <div className="flex flex-col gap-4">
                       <button onClick={startHost} className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">HOST GAME</button>
                       <div className="flex gap-2">
                           <input 
                             value={joinId} 
                             onChange={(e) => setJoinId(e.target.value)} 
                             placeholder="Enter Host ID"
                             className="p-2 border border-black w-full"
                           />
                           <button onClick={joinGame} className="bg-green-600 text-white p-2 rounded hover:bg-green-700">JOIN</button>
                       </div>
                  </div>
              )}

              {mpRole === 'HOST' && (
                  <div className="flex flex-col gap-4">
                      <p>Share this ID with friends:</p>
                      <div className="bg-white p-2 font-mono select-all border border-black">{lobbyId}</div>
                      <p className="text-sm text-gray-600">{lobbyStatus}</p>
                      <button onClick={startMultiplayerGame} className="bg-red-600 text-white p-3 rounded font-bold text-xl animate-pulse">START RUN</button>
                  </div>
              )}

              {mpRole === 'CLIENT' && (
                  <div className="flex flex-col gap-4">
                      <p className="text-lg font-bold text-green-700">{lobbyStatus}</p>
                      <p>Waiting for host to start...</p>
                  </div>
              )}

              <button onClick={() => { multiplayer.destroy(); setGameState(GameState.MENU); setMpRole('NONE'); }} className="mt-8 text-sm underline">Back</button>
          </div>
      )}

      {gameState === GameState.SETTINGS && (
          <div className="relative z-10 w-full max-w-lg text-center p-10 bg-[#f4e4bc] text-black border-4 border-dashed border-[#5a4635] -rotate-1">
             <h2 className="text-4xl mb-8 font-bold">OPTIONS</h2>
             <div className="mb-6">
                 <label className="block text-xl mb-2">Master Volume</label>
                 <input 
                    type="range" min="0" max="1" step="0.1" value={volume} onChange={handleVolumeChange}
                    className="w-64 h-4 bg-[#5a4635] appearance-none rounded-lg cursor-pointer"
                 />
             </div>
             <button onClick={() => setGameState(GameState.MENU)} className="text-2xl mt-8 hover:scale-110 transition-transform font-bold">BACK</button>
          </div>
      )}

      {gameState === GameState.LOADING && (
        <div className="bg-black absolute inset-0 flex flex-col items-center justify-center z-20 text-white">
           <h2 className="text-6xl mb-4 font-hand">{floorName}</h2>
           <p className="text-2xl text-gray-400 italic animate-pulse">{floorCurse}</p>
        </div>
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.PAUSED) && (
        <div className="relative">
            <GameCanvas 
                gameState={gameState}
                rooms={rooms}
                currentRoomIndex={currentRoomIndex}
                playerStats={stats}
                onRoomChange={handleRoomChange}
                onPlayerStatUpdate={setStats}
                onGameOver={handleGameOver}
                onTogglePause={() => setGameState(prev => prev === GameState.PAUSED ? GameState.PLAYING : GameState.PAUSED)}
                onNextFloor={handleNextFloor}
                multiplayerRole={mpRole}
            />
            <UI stats={stats} rooms={rooms} currentRoomIndex={currentRoomIndex} />
            
            {gameState === GameState.PAUSED && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center flex-col z-50">
                    <h2 className="text-6xl text-gray-200 font-hand mb-8">PAUSED</h2>
                    <button onClick={() => setGameState(GameState.PLAYING)} className="text-3xl text-white hover:text-red-500 mb-4">RESUME</button>
                    <button onClick={() => setGameState(GameState.MENU)} className="text-3xl text-gray-400 hover:text-red-500">EXIT</button>
                </div>
            )}
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="text-center z-10 bg-[#f4e4bc] p-12 border-4 border-black shadow-2xl rotate-2">
            <h1 className="text-6xl text-black mb-4 font-bold">DEAR DIARY...</h1>
            <p className="text-red-800 text-2xl mb-8 font-bold">TODAY I DIED.</p>
            <button onClick={() => setGameState(GameState.MENU)} className="text-3xl hover:text-red-600 font-bold">MENU</button>
        </div>
      )}
      
      {gameState === GameState.VICTORY && (
        <div className="text-center z-10 bg-[#f4e4bc] p-12 border-4 border-yellow-600 shadow-2xl">
            <h1 className="text-6xl text-yellow-800 mb-4 font-bold">VICTORY?</h1>
            <button onClick={() => setGameState(GameState.MENU)} className="text-3xl hover:text-yellow-600 font-bold">MENU</button>
        </div>
      )}

    </div>
  );
};

export default App;