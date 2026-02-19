import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Mic, Square, X, Image as ImageIcon, Smile } from 'lucide-react';
import { Progress } from './ui/progress';
import { useActor } from '../hooks/useActor';
import { compressImage } from '../lib/imageCompression';
import { useDetectLinksInText } from '../hooks/useDetectLinksInText';
import MessageInputLinkPreview from './MessageInputLinkPreview';
import { searchGiphy, fetchTrendingGiphy, type GiphyGif } from '../lib/giphy';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { ExternalBlob } from '../backend';
import { Button } from './ui/button';

interface MessageInputProps {
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string, imageId?: bigint, giphyUrl?: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

export default function MessageInput({ onSendMessage, disabled, isSending }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImage, setSelectedImage] = useState<{ preview: string; imageId: bigint } | null>(null);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const [giphySearchTerm, setGiphySearchTerm] = useState('');
  const [giphyResults, setGiphyResults] = useState<GiphyGif[]>([]);
  const [giphyLoading, setGiphyLoading] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { actor } = useActor();

  const MAX_MESSAGE_LENGTH = 2000;

  // Detect links in the message text
  const detectedLink = useDetectLinksInText(message);

  // Debounced Giphy search
  const debouncedGiphySearch = useDebouncedValue(giphySearchTerm, 500);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGiphyPicker && giphyResults.length === 0 && !giphySearchTerm) {
      loadTrendingGifs();
    }
  }, [showGiphyPicker]);

  // Search GIFs when search term changes
  useEffect(() => {
    if (debouncedGiphySearch.trim()) {
      searchGifs(debouncedGiphySearch);
    } else if (showGiphyPicker) {
      loadTrendingGifs();
    }
  }, [debouncedGiphySearch]);

  const loadTrendingGifs = async () => {
    setGiphyLoading(true);
    try {
      const result = await fetchTrendingGiphy();
      setGiphyResults(result.gifs);
    } catch (error) {
      console.error('Failed to load trending GIFs:', error);
    } finally {
      setGiphyLoading(false);
    }
  };

  const searchGifs = async (term: string) => {
    setGiphyLoading(true);
    try {
      const result = await searchGiphy(term);
      setGiphyResults(result.gifs);
    } catch (error) {
      console.error('Failed to search GIFs:', error);
    } finally {
      setGiphyLoading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !actor) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Compress the image
      const compressedFile = await compressImage(file, {}, (progress) => {
        setUploadProgress(progress * 0.5); // First 50% for compression
      });

      // Convert to bytes
      const arrayBuffer = await compressedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      setUploadProgress(60);

      // Create ExternalBlob and store
      const blob = ExternalBlob.fromBytes(bytes);
      const imageId = await actor.storeImage(blob);

      setUploadProgress(100);

      // Create preview URL
      const previewUrl = URL.createObjectURL(compressedFile);
      setSelectedImage({ preview: previewUrl, imageId });
      setSelectedGif(null); // Clear GIF if image is selected
    } catch (error) {
      console.error('Failed to upload image:', error);
      setRecordingError('Failed to upload image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGifSelect = (gif: GiphyGif) => {
    setSelectedGif(gif.originalUrl);
    setSelectedImage(null); // Clear image if GIF is selected
    setShowGiphyPicker(false);
  };

  const uploadAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      setIsUploading(true);
      setUploadProgress(10);
      
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      
      setUploadProgress(50);
      
      const audioId = `blob-storage-audio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const storageKey = `audio_${audioId}`;
      
      try {
        localStorage.setItem(storageKey, dataUrl);
      } catch (e) {
        console.warn('[MessageInput] localStorage full, using data URL directly');
      }
      
      setUploadProgress(100);
      
      const blobStorageUrl = `data:${audioBlob.type};blob-storage-id=${audioId};base64,${dataUrl.split(',')[1]}`;
      
      return blobStorageUrl;
    } catch (error) {
      console.error('[MessageInput] Error processing audio:', error);
      throw error instanceof Error ? error : new Error('Failed to upload audio');
    } finally {
      setIsUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      setRecordingError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        try {
          const audioUrl = await uploadAudio(audioBlob);
          const content = message.trim() || 'Voice message';
          
          onSendMessage(content, audioUrl, 'audio');
          
          setMessage('');
          setIsRecording(false);
          setRecordingTime(0);
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
        } catch (error) {
          setRecordingError(error instanceof Error ? error.message : 'Failed to upload audio');
          setIsRecording(false);
          setRecordingTime(0);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('[Recording] Error:', event);
        setRecordingError('Recording failed');
        setIsRecording(false);
        setRecordingTime(0);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('[Recording] Error starting recording:', error);
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setRecordingError('Microphone permission denied');
      } else if (error instanceof Error && error.name === 'NotFoundError') {
        setRecordingError('No microphone found');
      } else {
        setRecordingError('Failed to start recording');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    
    if (selectedImage) {
      onSendMessage(trimmedMessage || 'Image', undefined, undefined, selectedImage.imageId);
      setSelectedImage(null);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    if (selectedGif) {
      onSendMessage(trimmedMessage || 'GIF', undefined, undefined, undefined, selectedGif);
      setSelectedGif(null);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    if (detectedLink) {
      onSendMessage(trimmedMessage, detectedLink.url, detectedLink.type);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    if (trimmedMessage) {
      onSendMessage(trimmedMessage);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value);
      
      // Auto-resize textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const canSend = (message.trim() || selectedImage || selectedGif || detectedLink) && !isSending && !isUploading;

  return (
    <div className="border-t border-border bg-card p-4">
      {recordingError && (
        <div className="mb-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {recordingError}
        </div>
      )}

      {isUploading && (
        <div className="mb-2">
          <Progress value={uploadProgress} className="h-1" />
        </div>
      )}

      {detectedLink && (
        <MessageInputLinkPreview url={detectedLink.url} type={detectedLink.type} />
      )}

      {selectedImage && (
        <div className="mb-2 relative inline-block">
          <img 
            src={selectedImage.preview} 
            alt="Selected" 
            className="max-h-32 rounded-lg border border-border"
          />
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {selectedGif && (
        <div className="mb-2 relative inline-block">
          <img 
            src={selectedGif} 
            alt="Selected GIF" 
            className="max-h-32 rounded-lg border border-border"
          />
          <button
            onClick={() => setSelectedGif(null)}
            className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground hover:bg-destructive/90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isRecording ? (
        <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive">
            <div className="h-3 w-3 animate-pulse rounded-full bg-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">Recording...</div>
            <div className="text-xs text-muted-foreground">{formatTime(recordingTime)}</div>
          </div>
          <button
            onClick={cancelRecording}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Cancel recording"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
          <button
            onClick={stopRecording}
            className="rounded-full bg-primary p-2 hover:bg-primary/90"
            aria-label="Stop recording"
          >
            <Square className="h-5 w-5 text-primary-foreground" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsTextareaFocused(true)}
              onBlur={() => setIsTextareaFocused(false)}
              placeholder="Type a message..."
              disabled={disabled || isUploading}
              className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              rows={1}
              style={{ 
                maxHeight: '120px', 
                minHeight: '44px',
                fontSize: '16px'
              }}
            />
            {isTextareaFocused && (
              <div className="mt-1 text-xs text-muted-foreground text-right">
                {message.length}/{MAX_MESSAGE_LENGTH}
              </div>
            )}
          </div>

          {/* Inline Image Upload Button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0"
              aria-label="Upload image"
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
          </div>

          {/* Inline GIF Picker Button */}
          <Popover open={showGiphyPicker} onOpenChange={setShowGiphyPicker}>
            <PopoverTrigger asChild>
              <Button
                disabled={disabled || isUploading}
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label="Add GIF"
              >
                <Smile className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end" side="top">
              <div className="p-3 border-b border-border">
                <Input
                  placeholder="Search GIFs..."
                  value={giphySearchTerm}
                  onChange={(e) => setGiphySearchTerm(e.target.value)}
                  className="h-9"
                  style={{ fontSize: '16px' }}
                />
              </div>
              <ScrollArea className="h-64">
                {giphyLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  </div>
                ) : giphyResults.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 p-2">
                    {giphyResults.map((gif) => (
                      <button
                        key={gif.id}
                        onClick={() => handleGifSelect(gif)}
                        className="relative aspect-square overflow-hidden rounded-lg hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={gif.previewUrl}
                          alt={gif.title}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-muted-foreground">No GIFs found</div>
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <button
            onClick={startRecording}
            disabled={disabled || isUploading}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Record voice message"
          >
            <Mic className="h-5 w-5 text-muted-foreground" />
          </button>

          <button
            onClick={handleSend}
            disabled={!canSend}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-5 w-5 text-primary-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
