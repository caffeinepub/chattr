import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, X } from 'lucide-react';
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
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_MESSAGE_LENGTH = 2000;

  const debouncedGiphySearch = useDebouncedValue(giphySearch, 500);

  useEffect(() => {
    return () => {
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

    // Extract URLs from message
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = message.match(urlRegex);
    
    if (!urls || urls.length === 0) {
      setDetectedMedia(null);
      return;
    }

    // Check each URL for media type
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
    } catch (error) {
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
    } catch (error) {
      setGiphyError('Failed to search GIFs');
    } finally {
      setIsLoadingGiphy(false);
    }
  };

  const handleGifSelect = (gif: GiphyGif) => {
    // Send the GIF URL with the message content
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
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
          }
        } catch (error) {
          setRecordingError(error instanceof Error ? error.message : 'Failed to upload audio');
          setIsRecording(false);
        }
      };
      
      mediaRecorder.onerror = (event) => {
        console.error('[Recording] Error:', event);
        setRecordingError('Recording failed');
        setIsRecording(false);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      
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
    }
  };

  const handleSend = async () => {
    if (disabled || isUploading || isSending || isRecording) return;

    // Check if there's auto-detected media in the message
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
      stopRecording();
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

          {renderMediaPreview()}

          {showMediaInput && (
            <div className="rounded-lg border bg-card p-4">
              <Tabs value={mediaTab} onValueChange={(v) => setMediaTab(v as 'image' | 'giphy')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image">Image</TabsTrigger>
                  <TabsTrigger value="giphy">GIF</TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-upload">Upload Image</Label>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      disabled={isUploading}
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} />
                      <p className="text-sm text-muted-foreground text-center">
                        Uploading... {uploadProgress}%
                      </p>
                    </div>
                  )}

                  {mediaError && (
                    <p className="text-sm text-destructive">{mediaError}</p>
                  )}
                </TabsContent>

                <TabsContent value="giphy" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="giphy-search">Search GIFs</Label>
                    <Input
                      id="giphy-search"
                      type="text"
                      placeholder="Search for GIFs..."
                      value={giphySearch}
                      onChange={(e) => setGiphySearch(e.target.value)}
                    />
                  </div>

                  {isLoadingGiphy && (
                    <p className="text-sm text-muted-foreground text-center">Loading GIFs...</p>
                  )}

                  {giphyError && (
                    <p className="text-sm text-destructive">{giphyError}</p>
                  )}

                  {!isLoadingGiphy && giphyGifs.length > 0 && (
                    <ScrollArea className="h-[300px] w-full rounded-md border p-2">
                      <div className="grid grid-cols-2 gap-2">
                        {giphyGifs.map((gif) => (
                          <button
                            key={gif.id}
                            onClick={() => handleGifSelect(gif)}
                            className="relative aspect-square overflow-hidden rounded-md border border-border hover:border-primary transition-colors"
                          >
                            <img
                              src={gif.previewUrl}
                              alt={gif.title}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  {!isLoadingGiphy && giphyGifs.length === 0 && !giphyError && (
                    <p className="text-sm text-muted-foreground text-center">
                      No GIFs found
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={handleImageButtonClick}
              disabled={disabled || isUploading || isSending || isRecording}
              className="flex-shrink-0 rounded-full p-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Add image or GIF"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                placeholder={isRecording ? "Recording..." : "Type a message..."}
                disabled={disabled || isUploading || isSending}
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full resize-none rounded-2xl border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                rows={1}
                style={{ minHeight: '42px', maxHeight: '120px' }}
              />
              {isTextareaFocused && message.length > 0 && (
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${messageProgressPercentage}%` }}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleMicButtonClick}
              disabled={disabled || isUploading || isSending || showMediaInput}
              className={`relative flex-shrink-0 rounded-full p-2.5 transition-colors disabled:opacity-50 ${
                isRecording 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={isRecording ? "Stop recording" : "Record voice message"}
            >
              {isRecording && (
                <div className="absolute inset-0 rounded-full border-2 border-primary animate-spin-ring" />
              )}
              <Mic className="h-5 w-5 relative z-10" />
            </button>

            <button
              onClick={handleSend}
              disabled={disabled || isUploading || isSending || isRecording || (!message.trim() && !selectedFile && !detectedMedia)}
              className="flex-shrink-0 rounded-full bg-primary p-2.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
