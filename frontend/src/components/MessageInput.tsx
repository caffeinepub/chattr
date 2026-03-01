import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, Square, X, Smile } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { uploadImage } from '../hooks/useQueries';
import { isYouTubeUrl, isTwitchUrl, isTwitterUrl, getYouTubeVideoId } from '../lib/videoUtils';
import { searchGiphy, fetchTrendingGiphy, GiphyGif } from '../lib/giphy';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface MessageInputProps {
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

interface DetectedMedia {
  url: string;
  type: 'youtube' | 'twitch' | 'twitter';
}

export default function MessageInput({ onSendMessage, disabled, isSending }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaTab, setMediaTab] = useState<'image' | 'giphy'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [detectedMedia, setDetectedMedia] = useState<DetectedMedia | null>(null);
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyGifs, setGiphyGifs] = useState<GiphyGif[]>([]);
  const [isLoadingGiphy, setIsLoadingGiphy] = useState(false);
  const [giphyError, setGiphyError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_MESSAGE_LENGTH = 2000;

  const debouncedGiphySearch = useDebouncedValue(giphySearch, 500);

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

  // Auto-detect media URLs in message text
  useEffect(() => {
    if (!message.trim() || showMediaInput) {
      setDetectedMedia(null);
      return;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = message.match(urlRegex);
    
    if (!urls || urls.length === 0) {
      setDetectedMedia(null);
      return;
    }

    for (const url of urls) {
      if (isYouTubeUrl(url)) {
        setDetectedMedia({ url, type: 'youtube' });
        return;
      }
      if (isTwitchUrl(url)) {
        setDetectedMedia({ url, type: 'twitch' });
        return;
      }
      if (isTwitterUrl(url)) {
        setDetectedMedia({ url, type: 'twitter' });
        return;
      }
    }

    setDetectedMedia(null);
  }, [message, showMediaInput]);

  // Load trending GIFs when Giphy tab is opened
  useEffect(() => {
    if (showMediaInput && mediaTab === 'giphy' && giphyGifs.length === 0 && !debouncedGiphySearch) {
      loadTrendingGifs();
    }
  }, [showMediaInput, mediaTab]);

  // Search GIFs when search term changes
  useEffect(() => {
    if (showMediaInput && mediaTab === 'giphy') {
      if (debouncedGiphySearch.trim()) {
        searchGifs(debouncedGiphySearch);
      } else {
        loadTrendingGifs();
      }
    }
  }, [debouncedGiphySearch, showMediaInput, mediaTab]);

  const loadTrendingGifs = async () => {
    setIsLoadingGiphy(true);
    setGiphyError('');
    try {
      const result = await fetchTrendingGiphy();
      if (result.error) {
        setGiphyError(result.error);
      }
      setGiphyGifs(result.gifs);
    } catch {
      setGiphyError('Failed to load trending GIFs');
    } finally {
      setIsLoadingGiphy(false);
    }
  };

  const searchGifs = async (searchTerm: string) => {
    setIsLoadingGiphy(true);
    setGiphyError('');
    try {
      const result = await searchGiphy(searchTerm);
      if (result.error) {
        setGiphyError(result.error);
      }
      setGiphyGifs(result.gifs);
    } catch {
      setGiphyError('Failed to search GIFs');
    } finally {
      setIsLoadingGiphy(false);
    }
  };

  const handleGifSelect = (gif: GiphyGif) => {
    const content = message.trim() || gif.title || 'GIF';
    onSendMessage(content, gif.originalUrl, 'giphy');
    
    setMessage('');
    setShowMediaInput(false);
    setGiphySearch('');
    setGiphyGifs([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const validateImageFile = (file: File): boolean => {
    if (!file.type.startsWith('image/')) {
      setMediaError('Invalid file type. Must be an image file');
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMediaError('File size must be less than 10MB');
      return false;
    }

    setMediaError('');
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (validateImageFile(file)) {
        setSelectedFile(file);
        setMediaError('');
      } else {
        setSelectedFile(null);
      }
    }
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
      } catch {
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
      
      mediaRecorder.onerror = () => {
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

    if (detectedMedia && !showMediaInput) {
      const content = message.trim() || `${detectedMedia.type === 'youtube' ? 'YouTube' : detectedMedia.type === 'twitch' ? 'Twitch' : 'Twitter'} Post`;
      onSendMessage(content, detectedMedia.url, detectedMedia.type);
      
      setMessage('');
      setDetectedMedia(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    if (showMediaInput) {
      if (mediaTab === 'image' && selectedFile) {
        if (!validateImageFile(selectedFile)) return;
        
        try {
          setIsUploading(true);
          const mediaUrl = await uploadImage(selectedFile, (progress) => {
            setUploadProgress(progress);
          });
          const content = message.trim() || 'Image';
          onSendMessage(content, mediaUrl, 'image');
          
          setMessage('');
          setSelectedFile(null);
          setShowMediaInput(false);
          setMediaError('');
          setUploadProgress(0);
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        } catch (error) {
          setMediaError(error instanceof Error ? error.message : 'Failed to upload image');
        } finally {
          setIsUploading(false);
        }
        return;
      } else if (mediaTab === 'giphy') {
        setMediaError('Please select a GIF');
        return;
      } else {
        setMediaError('Please select media');
        return;
      }
    }

    if (message.trim()) {
      onSendMessage(message);
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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleImageButtonClick = () => {
    if (isRecording) return;
    setShowMediaInput(!showMediaInput);
    setMediaTab('image');
  };

  const handleMicButtonClick = () => {
    if (showMediaInput) return;
    if (isRecording) {
      cancelRecording();
    } else {
      startRecording();
    }
  };

  const messageProgressPercentage = (message.length / MAX_MESSAGE_LENGTH) * 100;

  const renderMediaPreview = () => {
    if (!detectedMedia) return null;

    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary">
                {detectedMedia.type === 'youtube' && 'YouTube video detected'}
                {detectedMedia.type === 'twitch' && 'Twitch video detected'}
                {detectedMedia.type === 'twitter' && 'Twitter post detected'}
              </span>
            </div>
            {detectedMedia.type === 'youtube' && getYouTubeVideoId(detectedMedia.url) && (
              <div className="mt-2 w-full max-w-[200px]">
                <img 
                  src={`https://img.youtube.com/vi/${getYouTubeVideoId(detectedMedia.url)}/default.jpg`}
                  alt="YouTube preview"
                  className="w-full rounded border border-border"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {detectedMedia.url}
            </p>
          </div>
          <button
            onClick={() => setDetectedMedia(null)}
            className="rounded-full p-1 hover:bg-muted transition-colors flex-shrink-0"
            title="Remove preview"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-shrink-0 bg-card">
      <div className="mx-auto max-w-3xl px-4 py-2">
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
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-10 w-10 shrink-0 rounded-full"
                  title="Cancel recording"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  onClick={stopRecording}
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 border bg-primary text-primary-foreground shadow hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 size-9 h-10 w-10 shrink-0 rounded-full"
                  title="Send voice message"
                >
                  <Square className="h-5 w-5 fill-current" />
                </button>
              </div>
            </div>
          )}

          {!isRecording && (
            <>
              {renderMediaPreview()}

              {showMediaInput && (
                <div className="rounded-lg border bg-card p-4">
                  <Tabs value={mediaTab} onValueChange={(v) => setMediaTab(v as 'image' | 'giphy')}>
                    <TabsList className="mb-3 w-full">
                      <TabsTrigger value="image" className="flex-1">Image</TabsTrigger>
                      <TabsTrigger value="giphy" className="flex-1">GIF</TabsTrigger>
                    </TabsList>

                    <TabsContent value="image">
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="image-upload" className="text-sm font-medium">
                            Upload Image
                          </Label>
                          <Input
                            id="image-upload"
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="mt-1"
                          />
                        </div>
                        {selectedFile && (
                          <div className="flex items-center gap-2 rounded-md bg-muted p-2 text-sm">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 truncate">{selectedFile.name}</span>
                            <button
                              onClick={() => {
                                setSelectedFile(null);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                        {isUploading && (
                          <div className="space-y-1">
                            <Progress value={uploadProgress} className="h-2" />
                            <p className="text-xs text-muted-foreground">Uploading... {uploadProgress}%</p>
                          </div>
                        )}
                        {mediaError && (
                          <p className="text-xs text-destructive">{mediaError}</p>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="giphy">
                      <div className="space-y-3">
                        <Input
                          placeholder="Search GIFs..."
                          value={giphySearch}
                          onChange={(e) => setGiphySearch(e.target.value)}
                          className="h-8 text-sm"
                        />
                        {giphyError && (
                          <p className="text-xs text-destructive">{giphyError}</p>
                        )}
                        <ScrollArea className="h-48">
                          {isLoadingGiphy ? (
                            <div className="flex h-full items-center justify-center">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2">
                              {giphyGifs.map((gif) => (
                                <button
                                  key={gif.id}
                                  onClick={() => handleGifSelect(gif)}
                                  className="overflow-hidden rounded-md hover:opacity-80 transition-opacity"
                                >
                                  <img
                                    src={gif.previewUrl}
                                    alt={gif.title}
                                    className="h-20 w-full object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {/* Main input row */}
              <div className="flex items-center gap-2">
                {/* Image / GIF button */}
                <button
                  onClick={handleImageButtonClick}
                  disabled={isRecording}
                  className={`flex-shrink-0 rounded-full p-2 transition-colors ${
                    showMediaInput
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  } disabled:opacity-50`}
                  title="Add image or GIF"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>

                {/* Textarea with character counter ring */}
                <div className="relative flex-1">
                  <div className={`flex items-center rounded-full border bg-muted px-4 py-2 transition-colors ${
                    isTextareaFocused ? 'border-primary/50' : 'border-transparent'
                  }`}>
                    <textarea
                      ref={textareaRef}
                      value={message}
                      onChange={handleInput}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setIsTextareaFocused(true)}
                      onBlur={() => setIsTextareaFocused(false)}
                      placeholder="Type a message..."
                      disabled={disabled || isRecording || isUploading}
                      rows={1}
                      maxLength={MAX_MESSAGE_LENGTH}
                      className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                      style={{ maxHeight: '120px', overflowY: 'auto' }}
                    />
                    {/* Character counter ring only - no text */}
                    {message.length > 0 && (
                      <div className="ml-2 flex-shrink-0">
                        <svg width="20" height="20" viewBox="0 0 20 20" className="-rotate-90">
                          <circle
                            cx="10" cy="10" r="8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-muted-foreground/20"
                          />
                          <circle
                            cx="10" cy="10" r="8"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeDasharray={`${2 * Math.PI * 8}`}
                            strokeDashoffset={`${2 * Math.PI * 8 * (1 - messageProgressPercentage / 100)}`}
                            className={
                              messageProgressPercentage >= 100
                                ? 'text-destructive'
                                : messageProgressPercentage >= 80
                                ? 'text-yellow-500'
                                : 'text-primary'
                            }
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  {/* Progress bar - only when focused */}
                  {isTextareaFocused && message.length > 0 && (
                    <div className="absolute bottom-0 left-4 right-4 h-0.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        className={`h-full transition-all duration-150 ${
                          messageProgressPercentage >= 100
                            ? 'bg-destructive'
                            : messageProgressPercentage >= 80
                            ? 'bg-yellow-500'
                            : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(messageProgressPercentage, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Mic button */}
                <button
                  onClick={handleMicButtonClick}
                  disabled={disabled || showMediaInput || isUploading}
                  className={`flex-shrink-0 rounded-full p-2 transition-colors disabled:opacity-50 ${
                    isRecording
                      ? 'bg-destructive text-destructive-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  title={isRecording ? 'Cancel recording' : 'Record voice message'}
                >
                  <Mic className="h-5 w-5" />
                </button>

                {/* Send button */}
                <button
                  onClick={handleSend}
                  disabled={
                    disabled ||
                    isUploading ||
                    isSending ||
                    isRecording ||
                    (!message.trim() && !selectedFile && !detectedMedia)
                  }
                  className="flex-shrink-0 rounded-full bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  title="Send message"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
