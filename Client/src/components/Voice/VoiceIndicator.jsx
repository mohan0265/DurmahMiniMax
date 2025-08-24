// Client/src/components/Voice/VoiceIndicator.jsx - Smart voice mode indicator
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  MessageCircle, 
  Loader, 
  AlertCircle,
  RefreshCw,
  Settings
} from 'lucide-react';
import { useMode } from '../../hooks/useMode';
import clsx from 'clsx';

const VoiceIndicator = ({ 
  variant = 'default', // 'default' | 'compact' | 'badge' | 'floating'
  showLabel = true,
  showModeToggle = true,
  className = ''
}) => {
  const {
    mode,
    isVoiceMode,
    isActive,
    isListening,
    isSpeaking,
    isThinking,
    audioLevel,
    micAvailable,
    micPermission,
    micError,
    canUseVoice,
    transitionInProgress,
    toggle,
    getStatus
  } = useMode();

  const status = getStatus();

  const getIndicatorState = () => {
    if (transitionInProgress) return 'transitioning';
    if (!isVoiceMode) return 'text';
    if (!isActive) return 'inactive';
    if (isListening) return 'listening';
    if (isSpeaking) return 'speaking';
    if (isThinking) return 'thinking';
    return 'ready';
  };

  const getStateConfig = () => {
    const state = getIndicatorState();
    
    const configs = {
      text: {
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        icon: MessageCircle,
        label: 'Text Mode',
        animation: null,
        description: 'Using text chat'
      },
      inactive: {
        color: 'text-orange-500',
        bgColor: 'bg-orange-100',
        icon: MicOff,
        label: 'Voice Inactive',
        animation: null,
        description: 'Voice mode not active'
      },
      ready: {
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
        icon: Mic,
        label: 'Ready to Listen',
        animation: 'pulse',
        description: 'Click to speak'
      },
      listening: {
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        icon: Mic,
        label: 'Listening...',
        animation: 'listening',
        description: 'Speak naturally'
      },
      speaking: {
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        icon: Volume2,
        label: 'Speaking...',
        animation: 'speaking',
        description: 'Durmah is responding'
      },
      thinking: {
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-100',
        icon: Loader,
        label: 'Thinking...',
        animation: 'thinking',
        description: 'Processing your request'
      },
      transitioning: {
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-100',
        icon: RefreshCw,
        label: 'Switching...',
        animation: 'spin',
        description: 'Changing modes'
      }
    };
    
    return configs[state] || configs.text;
  };

  const config = getStateConfig();
  const IconComponent = config.icon;

  const handleToggle = async () => {
    if (!showModeToggle) return;
    
    try {
      await toggle();
    } catch (error) {
      console.error('Mode toggle failed:', error);
    }
  };

  // Compact variant - just icon with tooltip
  if (variant === 'compact') {
    return (
      <div className={clsx('relative', className)}>
        <button
          onClick={handleToggle}
          disabled={!showModeToggle || transitionInProgress}
          className={clsx(
            'p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300',
            config.bgColor,
            config.color,
            showModeToggle ? 'hover:opacity-80 cursor-pointer' : 'cursor-default',
            transitionInProgress && 'opacity-50'
          )}
          title={config.description}
        >
          <IconComponent className={clsx(
            'w-4 h-4',
            config.animation === 'spin' && 'animate-spin',
            config.animation === 'pulse' && 'animate-pulse'
          )} />
        </button>
        
        {/* Audio level indicator for listening state */}
        {isListening && audioLevel > 0 && (
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-green-400 to-green-600"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
      </div>
    );
  }

  // Badge variant - small status badge
  if (variant === 'badge') {
    return (
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
          config.bgColor,
          config.color,
          className
        )}
      >
        <IconComponent className={clsx(
          'w-3 h-3',
          config.animation === 'spin' && 'animate-spin',
          config.animation === 'pulse' && 'animate-pulse'
        )} />
        {showLabel && <span>{config.label}</span>}
      </motion.div>
    );
  }

  // Floating variant - floating action button style
  if (variant === 'floating') {
    return (
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={clsx('fixed bottom-20 right-6 z-40', className)}
      >
        <button
          onClick={handleToggle}
          disabled={!showModeToggle || transitionInProgress}
          className={clsx(
            'w-14 h-14 rounded-full shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300 relative overflow-hidden',
            config.bgColor,
            config.color,
            'hover:shadow-xl hover:scale-105',
            transitionInProgress && 'opacity-50 scale-95'
          )}
          title={config.description}
        >
          {/* Animated rings for listening */}
          {isListening && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-green-400"
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.7, 0.3, 0.7]
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: 'easeInOut' 
              }}
            />
          )}
          
          <IconComponent className={clsx(
            'w-6 h-6',
            config.animation === 'spin' && 'animate-spin',
            config.animation === 'pulse' && 'animate-pulse'
          )} />
        </button>
        
        {/* Status label */}
        {showLabel && (
          <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            <div className={clsx(
              'px-2 py-1 rounded-md text-xs font-medium text-white shadow-md',
              config.bgColor.replace('bg-', 'bg-').replace('-100', '-600')
            )}>
              {config.label}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  // Default variant - full status indicator
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      {/* Main indicator */}
      <div className="flex items-center gap-2">
        <div className={clsx(
          'relative p-2 rounded-lg transition-all duration-200',
          config.bgColor
        )}>
          {/* Pulsing rings for active states */}
          <AnimatePresence>
            {isListening && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 0.5 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute inset-0 rounded-lg bg-green-500 animate-pulse"
              />
            )}
          </AnimatePresence>
          
          <IconComponent className={clsx(
            'w-5 h-5 relative z-10',
            config.color,
            config.animation === 'spin' && 'animate-spin',
            config.animation === 'pulse' && 'animate-pulse'
          )} />
        </div>
        
        {showLabel && (
          <div className="flex flex-col">
            <span className={clsx('text-sm font-medium', config.color)}>
              {config.label}
            </span>
            <span className="text-xs text-gray-500">
              {config.description}
            </span>
          </div>
        )}
      </div>
      
      {/* Mode toggle button */}
      {showModeToggle && canUseVoice && (
        <button
          onClick={handleToggle}
          disabled={transitionInProgress}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title={`Switch to ${isVoiceMode ? 'text' : 'voice'} mode`}
        >
          <Settings className="w-4 h-4" />
        </button>
      )}
      
      {/* Error indicator */}
      {micError && isVoiceMode && (
        <div className="flex items-center gap-1 text-red-500" title={micError}>
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs">Mic Error</span>
        </div>
      )}
      
      {/* Audio level meter */}
      {isListening && audioLevel > 0 && (
        <div className="flex items-center gap-1">
          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-green-400 via-yellow-500 to-red-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <span className="text-xs text-gray-500 w-8">
            {Math.round(audioLevel * 100)}%
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceIndicator;