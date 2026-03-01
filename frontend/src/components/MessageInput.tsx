import React, { useState, useRef, useEffect } from 'react';
import { Send, Image, Mic, Square, X } from 'lucide-react';
import { searchGiphy, fetchTrendingGiphy, GiphyGif } from '../lib/giphy';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface MessageInputProps {
  onSendMessage: (
    content: string,
    mediaUrl?: string,
    mediaType?: string
  ) => void;
  disabled?: boolean;
  isSending?: boolean;
}

const MAX_CHARS = 500;

export default function MessageInput({
  onSendMessage,
  disabled = false,
  isSending = false,
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const debouncedGifSearch = useDebouncedValue(gifSearch, 400);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Load trending GIFs on open
  useEffect(() => {
    if (showGifPicker && gifs.length === 0 && !gifSearch) {
      setGifsLoading(true);
      fetchTrendingGiphy()
        .then(result => setGifs(result.gifs))
        .catch(() => setGifs([]))
        .finally(() => setGifsLoading(false));
    }
  }, [showGifPicker]);

  // Search GIFs on debounced input
  useEffect(() => {
    if (!showGifPicker) return;
    if (!debouncedGifSearch) {
      setGifsLoading(true);
      fetchTrendingGiphy()
        .then(result => setGifs(result.gifs))
        .catch(() => setGifs([]))
        .finally(() => setGifsLoading(false));
      return;
    }
    setGifsLoading(true);
    searchGiphy(debouncedGifSearch)
      .then(result => setGifs(result.gifs))
      .catch(() => setGifs([]))
      .finally(() => setGifsLoading(false));
  }, [debouncedGifSearch, showGifPicker]);

  const handleSend = () => {
    if ((!text.trim() && !selectedImage) || disabled || isSending) return;
    if (text.length > MAX_CHARS) return;

    if (selectedImage) {
      onSendMessage(text.trim() || 'Image', selectedImage, 'image');
      setSelectedImage(null);
    } else {
      onSendMessage(text.trim());
    }
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSelectedImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGifSelect = (gif: GiphyGif) => {
    onSendMessage('GIF', gif.originalUrl, 'giphy');
    setShowGifPicker(false);
    setGifSearch('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        onSendMessage('Voice message', audioUrl, 'audio');
        stream.getTracks().forEach(t => t.stop());
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);
    } catch {
      // Permission denied or not available
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const charCount = text.length;
  const charProgress = Math.min(charCount / MAX_CHARS, 1);
  const isNearLimit = charCount > MAX_CHARS * 0.8;
  const isOverLimit = charCount > MAX_CHARS;

  // SVG ring dimensions
  const ringSize = 20;
  const ringRadius = 8;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - charProgress);

  return (
    <div className="flex-shrink-0 bg-card">
      <div className="mx-auto max-w-3xl px-4 py-2">
        <div className="space-y-2">
          {/* Selected image preview */}
          {selectedImage && (
            <div className="relative inline-block">
              <img
                src={selectedImage}
                alt="Selected"
                className="h-16 w-auto rounded-xl object-cover border border-border"
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* GIF Picker */}
          {showGifPicker && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="p-2 border-b border-border">
                <input
                  type="text"
                  value={gifSearch}
                  onChange={e => setGifSearch(e.target.value)}
                  placeholder="Search GIFs..."
                  className="w-full text-sm bg-muted rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="h-40 overflow-y-auto p-2">
                {gifsLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : gifs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    No GIFs found
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {gifs.map(gif => (
                      <button
                        key={gif.id}
                        onClick={() => handleGifSelect(gif)}
                        className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={gif.previewUrl}
                          alt={gif.title}
                          className="w-full h-16 object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recording state */}
          {isRecording ? (
            <div className="flex items-center gap-3 px-3 py-2 bg-destructive/10 rounded-2xl border border-destructive/30">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm font-medium text-destructive flex-1">
                Recording {formatRecordingTime(recordingTime)}
              </span>
              <button
                onClick={cancelRecording}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={stopRecording}
                className="flex items-center gap-1 px-3 py-1 bg-destructive text-destructive-foreground rounded-full text-xs font-medium"
              >
                <Square className="w-3 h-3 fill-current" />
                Send
              </button>
            </div>
          ) : (
            /* Main input row */
            <div className="flex items-end gap-2">
              {/* Left action buttons */}
              <div className="flex items-center gap-1 pb-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted disabled:opacity-50"
                  title="Attach image"
                >
                  <Image className="w-[18px] h-[18px]" />
                </button>
                <button
                  onClick={() => setShowGifPicker(prev => !prev)}
                  disabled={disabled}
                  className={`text-xs font-bold px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 ${
                    showGifPicker
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title="GIF"
                >
                  GIF
                </button>
              </div>

              {/* Textarea container */}
              <div className="flex-1 relative flex items-end bg-muted rounded-2xl border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Message..."
                  disabled={disabled || isSending}
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none px-3 py-2.5 focus:outline-none min-h-[40px] max-h-[120px] leading-relaxed"
                  style={{ fontSize: '16px' }}
                />

                {/* Circular character counter ring — only shown when typing */}
                {charCount > 0 && (
                  <div className="flex-shrink-0 self-end pb-2.5 pr-2">
                    <svg width={ringSize} height={ringSize} className="rotate-[-90deg]">
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={ringRadius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-muted/50"
                      />
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={ringRadius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringDashOffset}
                        strokeLinecap="round"
                        className={
                          isOverLimit
                            ? 'text-destructive'
                            : isNearLimit
                            ? 'text-yellow-500'
                            : 'text-primary'
                        }
                      />
                    </svg>
                  </div>
                )}
              </div>

              {/* Right action buttons */}
              <div className="flex items-center gap-1 pb-1.5">
                {text.trim() || selectedImage ? (
                  <button
                    onClick={handleSend}
                    disabled={disabled || isSending || isOverLimit}
                    className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={disabled}
                    className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 hover:text-foreground transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
    </div>
  );
}
