import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

type Mood = 'safe' | 'struggling' | 'drowning';

let moodListeners: ((mood: Mood) => void)[] = [];

/**
 * Updates the avatar mood globally.
 * @param state - 'safe', 'struggling', or 'drowning'
 */
export const updateAvatarMood = (state: Mood) => {
  moodListeners.forEach(listener => listener(state));
};

interface AvatarProps {
  isTalking?: boolean;
  isListening?: boolean;
  compact?: boolean;
  size?: number;
}

const moodConfig = {
  safe: {
    label: 'Feeling Safe 💚',
    color: '#10B981',
    glowColor: 'rgba(16, 185, 129, 0.6)',
    floatDuration: 2,
    pulseDuration: 1.5,
  },
  struggling: {
    label: 'Hanging In There 🧡',
    color: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.6)',
    floatDuration: 4,
    pulseDuration: 2.5,
  },
  drowning: {
    label: 'Need Comfort 💙',
    color: '#6366F1',
    glowColor: 'rgba(99, 102, 241, 0.6)',
    floatDuration: 6,
    pulseDuration: 4,
  },
};

export const Avatar: React.FC<AvatarProps> = ({ 
  isTalking = false, 
  isListening = false,
  compact = false,
  size = 120 
}) => {
  const [mood, setMood] = useState<Mood>('safe');

  useEffect(() => {
    const listener = (newMood: Mood) => setMood(newMood);
    moodListeners.push(listener);
    return () => {
      moodListeners = moodListeners.filter(l => l !== listener);
    };
  }, []);

  const config = moodConfig[mood];
  const displaySize = compact ? 50 : size;

  return (
    <div className={cn("flex flex-col items-center justify-center", compact ? "p-0" : "")}>
      <style>
        {`
          @keyframes blink {
            0%, 90%, 100% { transform: scaleY(1); }
            95% { transform: scaleY(0.08); }
          }
          .avatar-eye {
            animation: blink 3.5s infinite;
            transform-box: fill-box;
            transform-origin: center;
          }
          @keyframes talking {
            0%, 100% { d: path("M50 78 Q60 85 70 78"); }
            50% { d: path("M50 78 A5 5 0 1 0 70 78 A5 5 0 1 0 50 78"); }
          }
          .talking {
            animation: talking 0.25s infinite;
          }
        `}
      </style>
      
      <motion.div
        animate={compact ? {} : { y: [0, -15, 0] }}
        transition={{
          duration: config.floatDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative flex items-center justify-center"
        style={{ width: displaySize, height: displaySize }}
      >
        {/* Glow Ring */}
        <motion.div
          animate={{
            scale: isListening ? [1, 1.3, 1] : (isTalking ? [1, 1.2, 1] : [1, 1.1, 1]),
            opacity: (isListening || isTalking) ? [0.6, 1, 0.6] : [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: isListening ? 0.8 : (isTalking ? config.pulseDuration * 0.5 : config.pulseDuration),
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute rounded-full border-2"
          style={{
            width: compact ? '120%' : '110%',
            height: compact ? '120%' : '110%',
            boxShadow: `0 0 ${compact ? '15px' : '30px'} ${isListening ? 'rgba(239, 68, 68, 0.6)' : config.glowColor}`,
            borderColor: isListening ? '#EF4444' : config.color,
            opacity: compact ? 0.3 : 0.5
          }}
        />

        {/* SVG Avatar */}
        <svg
          viewBox="0 0 120 100"
          className="w-full h-full relative z-10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="blobGradient" x1="60" y1="0" x2="60" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFE4B5" />
              <stop offset="100%" stopColor="#FFDAB0" />
            </linearGradient>
          </defs>
          
          {/* Mochi Blob Shape */}
          <path
            d="M20 80 Q20 30 60 20 Q100 30 100 80 Q100 95 60 95 Q20 95 20 80 Z"
            fill="url(#blobGradient)"
          />

          {/* Cheeks */}
          <circle cx="35" cy="75" r="8" fill="#FFB5B5" fillOpacity="0.5" />
          <circle cx="85" cy="75" r="8" fill="#FFB5B5" fillOpacity="0.5" />

          {/* Eyes */}
          <g className="avatar-eye">
            <circle cx="45" cy="65" r={isListening ? 10 : 8} fill="#2D2B55" />
            <circle cx={isListening ? 50 : 49} cy={isListening ? 60 : 61} r="2.5" fill="white" />
          </g>
          <g className="avatar-eye">
            <circle cx="75" cy="65" r={isListening ? 10 : 8} fill="#2D2B55" />
            <circle cx={isListening ? 80 : 79} cy={isListening ? 60 : 61} r="2.5" fill="white" />
          </g>

          {/* Mouth */}
          <path
            d="M50 78 Q60 85 70 78"
            stroke="#C4956A"
            strokeWidth="2"
            strokeLinecap="round"
            className={cn(isTalking && "talking")}
          />
        </svg>
      </motion.div>

      {/* Sound Wave Bars */}
      {!compact && (
        <div className="h-6 flex items-end gap-1 mt-4">
          {isTalking && [0.4, 0.6, 0.3].map((delay, i) => (
            <motion.div
              key={i}
              animate={{ height: [8, 20, 8] }}
              transition={{ duration: delay, repeat: Infinity, ease: "easeInOut" }}
              className="w-1 rounded-full"
              style={{ backgroundColor: config.color }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Avatar;
