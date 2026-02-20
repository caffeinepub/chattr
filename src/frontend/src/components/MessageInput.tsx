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
    
    audioChunksRef.current = [];
    
    setIsRecording(false);
    setRecordingTime(0);
    setRecordingError('');
  };

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSend = async () => {
    if (disabled || isUploading || isSending || isRecording) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage && !selectedImage && !selectedGif) return;

    // Send with image
    if (selectedImage) {
      onSendMessage(trimmedMessage || 'Image', undefined, undefined, selectedImage.imageId, undefined);
      setSelectedImage(null);
    }
    // Send with GIF
    else if (selectedGif) {
      onSendMessage(trimmedMessage || 'GIF', undefined, undefined, undefined, selectedGif);
      setSelectedGif(null);
    }
    // Send with detected link
    else if (detectedLink) {
      onSendMessage(trimmedMessage, detectedLink.url, detectedLink.type);
    }
    // Send text only
    else {
      onSendMessage(trimmedMessage);
    }

    setMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleMicButtonClick = () => {
    if (isRecording) {
      cancelRecording();
    } else {
      startRecording();
    }
  };

  const messageProgressPercentage = (message.length / MAX_MESSAGE_LENGTH) * 100;

  return (
    <div className="flex-shrink-0 bg-card">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="space-y-2">
          {recordingError && (
            <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {recordingError}
            </div>
          )}

          {isRecording && (
            <div className="flex items-center justify-between rounded-lg bg-destructive/10 p-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
                <span className="text-sm font-medium text-foreground">
                  Recording: {formatRecordingTime(recordingTime)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={cancelRecording}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-10 w-10 shrink-0 rounded-full"
                  title="Cancel recording"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 size-9 h-10 w-10 shrink-0 rounded-full"
                  title="Stop and send"
                >
                  <Square className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {/* Image/GIF preview */}
          {(selectedImage || selectedGif) && (
            <div className="relative inline-block">
              <img
                src={selectedImage?.preview || selectedGif || ''}
                alt="Preview"
                className="h-20 w-20 rounded-lg object-cover"
              />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setSelectedGif(null);
                }}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-md hover:bg-destructive/90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={handleMicButtonClick}
              disabled={disabled || isUploading}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-10 w-10 shrink-0 rounded-full"
              title={isRecording ? 'Cancel recording' : 'Record voice message'}
            >
              {isRecording ? (
                <X className="h-5 w-5 text-destructive" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </button>

            {/* Image upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading || isRecording}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-10 w-10 shrink-0 rounded-full"
              title="Upload image"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            {/* Giphy GIF picker */}
            <Popover open={showGiphyPicker} onOpenChange={setShowGiphyPicker}>
              <PopoverTrigger asChild>
                <button
                  disabled={disabled || isUploading || isRecording}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-10 w-10 shrink-0 rounded-full"
                  title="Add GIF"
                >
                  <Smile className="h-5 w-5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="start" side="top">
                <div className="flex flex-col">
                  <div className="border-b p-3">
                    <Input
                      placeholder="Search GIFs..."
                      value={giphySearchTerm}
                      onChange={(e) => setGiphySearchTerm(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <ScrollArea className="h-64">
                    {giphyLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="text-sm text-muted-foreground">Loading GIFs...</div>
                      </div>
                    ) : giphyResults.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 p-2">
                        {giphyResults.map((gif) => (
                          <button
                            key={gif.id}
                            onClick={() => handleGifSelect(gif)}
                            className="overflow-hidden rounded-md transition-transform hover:scale-105"
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
                      <div className="flex items-center justify-center p-8">
                        <div className="text-sm text-muted-foreground">
                          {giphySearchTerm ? 'No GIFs found' : 'Search for GIFs'}
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                  <div className="border-t p-2 text-center text-xs text-muted-foreground">
                    Powered by GIPHY
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                placeholder="Type a message..."
                disabled={disabled || isRecording || isUploading}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={1}
                className="w-full resize-none rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                style={{ 
                  fontSize: '16px',
                  minHeight: '44px',
                  maxHeight: '120px',
                }}
              />
              {isTextareaFocused && message.length > 0 && (
                <div className="absolute -bottom-1 left-0 right-0 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${messageProgressPercentage}%` }}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={disabled || (!message.trim() && !selectedImage && !selectedGif) || isRecording || isUploading || isSending}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 size-9 h-10 w-10 shrink-0 rounded-full"
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>

          {/* Link preview */}
          {detectedLink && !selectedImage && !selectedGif && (
            <MessageInputLinkPreview url={detectedLink.url} type={detectedLink.type} />
          )}

          {isUploading && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Uploading...</div>
              <Progress value={uploadProgress} className="h-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
