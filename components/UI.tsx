import React from 'react';
import { PlayerStats, Room, RoomType } from '../types';
import { CANVAS_WIDTH } from '../constants';

interface UIProps {
  stats: PlayerStats;
  rooms: Room[];
  currentRoomIndex: number;
}

const UI: React.FC<UIProps> = ({ stats, rooms, currentRoomIndex }) => {
  const currentRoom = rooms[currentRoomIndex] || { x:0, y:0 };

  const renderHearts = () => {
    const hearts = [];
    const fullHearts = Math.floor(stats.currentHp / 2);
    const halfHeart = stats.currentHp % 2 !== 0;
    const emptyHearts = Math.floor((stats.maxHp - stats.currentHp) / 2);

    for (let i = 0; i < fullHearts; i++) hearts.push(<span key={`f${i}`} className="text-red-600 text-2xl drop-shadow-sm">♥</span>);
    if (halfHeart) hearts.push(<span key="h" className="text-red-600 text-2xl drop-shadow-sm">♡</span>); 
    for (let i = 0; i < emptyHearts; i++) hearts.push(<span key={`e${i}`} className="text-gray-900 text-2xl drop-shadow-sm">♥</span>);
    return hearts;
  };

  const renderMap = () => {
    return (
      <div className="grid grid-cols-5 grid-rows-5 gap-1 bg-black/30 p-2 rounded border border-white/10">
        {rooms.map((room, idx) => {
           const dx = room.x - currentRoom.x;
           const dy = room.y - currentRoom.y;
           if (Math.abs(dx) > 2 || Math.abs(dy) > 2) return null;
           
           const gridX = dx + 2;
           const gridY = dy + 2;
           
           let bgClass = 'bg-gray-400';
           if (room.type === RoomType.BOSS) bgClass = 'bg-red-900 border-red-500';
           if (room.type === RoomType.TREASURE) bgClass = 'bg-yellow-600 border-yellow-400';
           if (room.type === RoomType.SHOP) bgClass = 'bg-green-700 border-green-500';
           if (idx === currentRoomIndex) bgClass = 'bg-white border-white animate-pulse';
           
           const style = {
             gridColumn: gridX + 1,
             gridRow: gridY + 1,
             width: '18px',
             height: '14px'
           };

           return <div key={room.x+','+room.y} style={style} className={`${bgClass} border opacity-90`}></div>
        })}
      </div>
    );
  };

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex justify-between p-4 max-w-[800px] mx-auto left-0 right-0 font-hand">
      {/* Left Stats */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          {renderHearts()}
        </div>
        <div className="text-[#f1c40f] text-xl font-bold drop-shadow-[2px_2px_0_#000]">
           COINS: {stats.coins}¢
        </div>
        <div className="text-gray-300 text-sm flex flex-col gap-0.5 mt-2 bg-black/40 p-2 rounded w-24 backdrop-blur-sm">
           <span>DMG: {stats.damage.toFixed(1)}</span>
           <span>SPD: {stats.speed.toFixed(1)}</span>
           <span>RNG: {stats.range.toFixed(1)}</span>
           <span>FRT: {(10 - stats.fireRate).toFixed(1)}</span>
        </div>
      </div>

      {/* Right Map */}
      <div>
        {renderMap()}
      </div>
    </div>
  );
};

export default UI;