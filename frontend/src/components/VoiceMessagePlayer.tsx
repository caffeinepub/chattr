import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  isOwnMessage: boolean;
}

export default function VoiceMessagePlayer({ audioUrl, isOwnMessage }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Generate random waveform bars for visualization (Uiverse green-audio-player style)
  useEffect(() => {
    const bars = Array.from({ length: 40 }, () => Math.random() * 0.6 + 0.4);
    setWaveformBars(bars);
  }, []);

  // Reset playback state when audioUrl changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      // Force reload to ensure metadata is fetched
      audio.load();
    }
  }, [audioUrl]);

  // Load audio metadata and set duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleCanPlay = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);

    // Try to load duration immediately if already loaded
    if (audio.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Update current time during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current !== undefined) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Pause other playing audio when this one starts (playback synchronization)
  useEffect(() => {
    if (isPlaying) {
      const allAudio = document.querySelectorAll('audio');
      allAudio.forEach((audio) => {
        if (audio !== audioRef.current && !audio.paused) {
          audio.pause();
        }
      });
    }
  }, [isPlaying]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const newTime = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number): string => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="mt-2 w-full max-w-[400px]">
      {/* Uiverse green-audio-player design template with app accent colors */}
      <div className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ${
        isOwnMessage 
          ? 'bg-primary border-2 border-white' 
          : 'bg-white border border-border'
      }`}>
        {/* Circular Play/Pause Button (left) */}
        <button
          onClick={togglePlayPause}
          className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full transition-all ${
            isOwnMessage 
              ? 'bg-white/20 hover:bg-white/30' 
              : 'bg-primary hover:bg-primary/90'
          }`}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className={`w-5 h-5 fill-current ${
              isOwnMessage ? 'text-white' : 'text-primary-foreground'
            }`} />
          ) : (
            <Play className={`w-5 h-5 fill-current ml-0.5 ${
              isOwnMessage ? 'text-white' : 'text-primary-foreground'
            }`} />
          )}
        </button>

        {/* Progress Slider (current user) or Waveform Visualization (others) - center */}
        {isOwnMessage ? (
          // Clean progress slider for current user's messages with subtle accent color
          <div className="flex-1 flex items-center px-2">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleSliderChange}
              className="voice-message-range-own w-full"
              style={{ '--progress': `${progress}%` } as React.CSSProperties}
            />
          </div>
        ) : (
          // Waveform visualization for other users' messages with subtle accent color
          <div className="flex-1 flex items-center px-2">
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleSliderChange}
              className="voice-message-range-other w-full"
              style={{ '--progress': `${progress}%` } as React.CSSProperties}
            />
          </div>
        )}

        {/* Duration Timer (right) */}
        <div className={`flex-shrink-0 text-xs font-medium min-w-[70px] text-right ${
          isOwnMessage ? 'text-white' : 'text-muted-foreground'
        }`}>
          <span>{formatTime(currentTime)}</span>
          <span className={isOwnMessage ? 'text-white/70' : 'text-muted-foreground/70'}> / </span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
    </div>
  );
}
