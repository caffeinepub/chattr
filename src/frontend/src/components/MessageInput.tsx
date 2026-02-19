import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Mic, Square } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { uploadImage } from '../hooks/useQueries';
import { searchGiphy, fetchTrendingGiphy, type GiphyGif } from '../lib/giphy';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface MessageInputProps {
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

export default function MessageInput({ onSendMessage, disabled, isSending }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaTab, setMediaTab] = useState<'image' | 'gif'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifResults, setGifResults] = useState<GiphyGif[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [selectedGif, setSelectedGif] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_MESSAGE_LENGTH = 2000;
  const debouncedGifSearch = useDebouncedValue(gifSearchQuery, 500);

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

  // Load trending GIFs on mount
  useEffect(() => {
    if (mediaTab === 'gif' && gifResults.length === 0) {
      setIsLoadingGifs(true);
      fetchTrendingGiphy()
        .then((result) => {
          setGifResults(result.gifs);
        })
        .catch((error) => {
          console.error('Error loading trending GIFs:', error);
        })
        .finally(() => {
          setIsLoadingGifs(false);
        });
    }
  }, [mediaTab, gifResults.length]);

  // Search GIFs when query changes
  useEffect(() => {
    if (debouncedGifSearch.trim()) {
      setIsLoadingGifs(true);
      searchGiphy(debouncedGifSearch)
        .then((result) => {
          setGifResults(result.gifs);
        })
        .catch((error) => {
          console.error('Error searching GIFs:', error);
        })
        .finally(() => {
          setIsLoadingGifs(false);
        });
    } else if (mediaTab === 'gif') {
      // Load trending when search is cleared
      setIsLoadingGifs(true);
      fetchTrendingGiphy()
        .then((result) => {
          setGifResults(result.gifs);
        })
        .catch((error) => {
          console.error('Error loading trending GIFs:', error);
        })
        .finally(() => {
          setIsLoadingGifs(false);
        });
    }
  }, [debouncedGifSearch, mediaTab]);

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
      } else if (mediaTab === 'gif' && selectedGif) {
        const content = message.trim() || 'GIF';
        onSendMessage(content, selectedGif, 'image');
        
        setMessage('');
        setSelectedGif(null);
        setShowMediaInput(false);
        setMediaError('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      } else {
        setMediaError('Please select an image or GIF');
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

          {showMediaInput && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Add Media</h3>
                <button
                  onClick={() => {
                    setShowMediaInput(false);
                    setSelectedFile(null);
                    setSelectedGif(null);
                    setMediaError('');
                    setGifSearchQuery('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="rounded-full p-1 hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <Tabs value={mediaTab} onValueChange={(value) => setMediaTab(value as 'image' | 'gif')}>
                <TabsList className="grid w-full grid-cols-2 mb-3">
                  <TabsTrigger value="image" className="flex items-center gap-1">
                    <ImageIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Image</span>
                  </TabsTrigger>
                  <TabsTrigger value="gif" className="flex items-center gap-1">
                    <span className="text-lg">GIF</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="space-y-3">
                  <div>
                    <Label htmlFor="image-upload" className="text-sm text-muted-foreground">
                      Upload Image
                    </Label>
                    <Input
                      id="image-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="mt-1"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  {selectedFile && (
                    <div className="text-sm text-muted-foreground">
                      Selected: {selectedFile.name}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="gif" className="space-y-3">
                  <div>
                    <Label htmlFor="gif-search" className="text-sm text-muted-foreground">
                      Search GIFs
                    </Label>
                    <Input
                      id="gif-search"
                      type="text"
                      value={gifSearchQuery}
                      onChange={(e) => setGifSearchQuery(e.target.value)}
                      placeholder="Search Giphy..."
                      className="mt-1"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                  
                  <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border bg-background p-2">
                    {isLoadingGifs ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    ) : gifResults.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {gifResults.map((gif) => (
                          <button
                            key={gif.id}
                            onClick={() => setSelectedGif(gif.originalUrl)}
                            className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                              selectedGif === gif.originalUrl
                                ? 'border-primary scale-95'
                                : 'border-transparent hover:border-primary/50'
                            }`}
                          >
                            <img
                              src={gif.previewUrl}
                              alt={gif.title || 'GIF'}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No GIFs found
                      </div>
                    )}
                  </div>
                  
                  {selectedGif && (
                    <div className="text-sm text-muted-foreground">
                      GIF selected
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {mediaError && (
                <div className="mt-2 text-sm text-destructive">{mediaError}</div>
              )}

              {isUploading && (
                <div className="mt-3 space-y-1">
                  <Progress value={uploadProgress} className="h-1" />
                  <p className="text-xs text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={handleImageButtonClick}
              disabled={disabled || isRecording}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-10 w-10 shrink-0 rounded-full"
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
                placeholder="Type a message..."
                disabled={disabled || isRecording}
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full resize-none rounded-full border border-input bg-background px-4 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                style={{ 
                  minHeight: '40px',
                  maxHeight: '120px',
                  fontSize: '16px'
                }}
                rows={1}
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
              disabled={disabled || showMediaInput}
              className={`inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border shadow-xs size-9 h-10 w-10 shrink-0 rounded-full ${
                isRecording 
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                  : 'bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50'
              }`}
              title={isRecording ? 'Cancel recording' : 'Record voice message'}
            >
              {isRecording ? <X className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <button
              onClick={handleSend}
              disabled={disabled || isUploading || isSending || isRecording || (!message.trim() && !selectedFile && !selectedGif)}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 size-9 h-10 w-10 shrink-0 rounded-full"
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
