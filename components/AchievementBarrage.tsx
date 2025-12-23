
import React, { useEffect, useState } from 'react';
import { Achievement } from '../types';

interface Props {
  achievements: Achievement[];
  isActive: boolean;
}

const AchievementBarrage: React.FC<Props> = ({ achievements, isActive }) => {
  const [lanes, setLanes] = useState<Achievement[][]>([[], []]);

  useEffect(() => {
    if (!isActive) {
      setLanes([[], []]);
      return;
    }

    // Default hint if empty
    const baseItems = achievements.length > 0 
      ? achievements 
      : [{ id: 'hint', text: '记录每一个感恩时刻', date: new Date().toLocaleDateString() } as Achievement];

    const newLanes: Achievement[][] = [[], []];
    
    if (baseItems.length === 1) {
      // If only one item, put it in both lanes to ensure the mirror isn't empty, 
      // but they will be staggered by animation delay.
      newLanes[0] = [baseItems[0]];
      newLanes[1] = [baseItems[0]];
    } else {
      // Distribute uniquely
      baseItems.forEach((item, index) => {
        newLanes[index % 2].push(item);
      });
      // Ensure Lane 2 isn't empty if Lane 1 has items
      if (newLanes[1].length === 0 && newLanes[0].length > 0) {
        newLanes[1] = [newLanes[0][0]];
      }
    }

    setLanes(newLanes);
  }, [achievements, isActive]);

  if (!isActive) return null;

  // Very slow speed: duration of one full cycle of the content width
  const DURATION = 80; 

  return (
    <div className="absolute top-0 left-0 w-full h-[35%] pointer-events-none overflow-hidden pt-12 flex flex-col justify-start gap-8">
      {lanes.map((laneItems, laneIdx) => {
        if (laneItems.length === 0) return null;

        // To make it continuous with no gaps, we repeat the items enough times 
        // to fill more than the screen width, then duplicate that whole set once for the loop.
        const repeatedItems = [...laneItems];
        // Ensure we have at least a few items to prevent "popping"
        while (repeatedItems.length < 4) {
          repeatedItems.push(...laneItems);
        }

        return (
          <div
            key={laneIdx}
            className={`relative w-full overflow-hidden h-20 py-1 ${laneIdx === 1 ? 'mt-2' : ''}`}
          >
            <div 
              className="flex absolute whitespace-nowrap will-change-transform animate-ticker"
              style={{ 
                animationDuration: `${DURATION}s`,
                // Lane 2 is staggered by half the duration to be "out of sync"
                animationDelay: laneIdx === 1 ? `-${DURATION / 2}s` : '0s',
                // Offset the starting position of Lane 2 slightly more for visual variety
                left: laneIdx === 1 ? '15%' : '0%'
              }}
            >
              {/* Render the set twice for a perfect loop */}
              {[0, 1].map((setIdx) => (
                <div key={setIdx} className="flex">
                  {repeatedItems.map((item, itemIdx) => (
                    <div 
                      key={`${item.id}-${setIdx}-${itemIdx}`} 
                      className="flex flex-col items-start px-[150px] opacity-25 flex-shrink-0"
                    >
                      <span className="text-[8px] text-white/40 tracking-[0.4em] font-bold uppercase mb-1">
                        {item.date.split(' ')[0]}
                      </span>
                      <span className="font-light text-xl text-white uppercase tracking-[0.25em] drop-shadow-md whitespace-nowrap">
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-ticker {
          animation-name: ticker;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          backface-visibility: hidden;
          transform: translate3d(0, 0, 0);
        }
      `}</style>
    </div>
  );
};

export default AchievementBarrage;
