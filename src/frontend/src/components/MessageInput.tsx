import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, Square, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { uploadImage } from '../hooks/useQueries';
import { isYouTubeUrl, isTwitchUrl, isTwitterUrl, getYouTubeVideoId } from '../lib/videoUtils';
import GifPickerDialog from './GifPickerDialog';
import { SiX } from 'react-icons/si';

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
  const [mediaTab, setMediaTab] = useState<'image' | 'gif'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const [detectedMedia, setDetectedMedia] = useState<DetectedMedia | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_MESSAGE_LENGTH = 2000;

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

  const handleSelectGif = (gifUrl: string) => {
    const content = message.trim() || 'GIF';
    onSendMessage(content, gifUrl, 'gif');
    
    setMessage('');
    setShowMediaInput(false);
    setMediaError('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
      } else if (mediaTab === 'gif') {
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
              {detectedMedia.type === 'youtube' && (
                <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
              )}
              {detectedMedia.type === 'twitch' && (
                <ImageIcon className="h-4 w-4 text-primary flex-shrink-0" />
              )}
              {detectedMedia.type === 'twitter' && (
                <SiX className="h-4 w-4 text-primary flex-shrink-0" />
              )}
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
                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-primary text-primary-foreground shadow hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 size-9 h-10 w-10 shrink-0 rounded-full"
                  title="Send recording"
                >
                  <Square className="h-5 w-5 fill-current" />
                </button>
              </div>
            </div>
          )}

          {showMediaInput && (
            <div className="rounded-lg border border-border bg-card p-4">
              <Tabs value={mediaTab} onValueChange={(value) => setMediaTab(value as 'image' | 'gif')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="image">Image</TabsTrigger>
                  <TabsTrigger value="gif">GIF</TabsTrigger>
                </TabsList>

                <TabsContent value="image" className="space-y-3 mt-3">
                  <div className="space-y-2">
                    <Label htmlFor="image-upload">Upload Image</Label>
                    <input
                      ref={fileInputRef}
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="block w-full text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Uploading...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="gif" className="mt-3 h-[400px]">
                  <GifPickerDialog 
                    onSelectGif={handleSelectGif}
                    disabled={isUploading || isSending}
                  />
                </TabsContent>
              </Tabs>

              {mediaError && (
                <p className="mt-2 text-sm text-destructive">{mediaError}</p>
              )}
            </div>
          )}

          {renderMediaPreview()}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                placeholder="Type a message..."
                disabled={disabled || isUploading || isSending || isRecording}
                maxLength={MAX_MESSAGE_LENGTH}
                className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
              {isTextareaFocused && message.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${messageProgressPercentage}%` }}
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleImageButtonClick}
              disabled={disabled || isUploading || isSending || isRecording}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-9 h-12 w-12 shrink-0 rounded-lg"
              title="Add media"
            >
              <ImageIcon className="h-5 w-5" />
            </button>

            <button
              onClick={handleMicButtonClick}
              disabled={disabled || isUploading || isSending || showMediaInput}
              className={`inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border shadow-xs size-9 h-12 w-12 shrink-0 rounded-lg ${
                isRecording 
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                  : 'bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50'
              }`}
              title={isRecording ? 'Cancel recording' : 'Record voice message'}
            >
              <Mic className="h-5 w-5" />
            </button>

            <button
              onClick={handleSend}
              disabled={disabled || isUploading || isSending || isRecording || (!message.trim() && !selectedFile && !detectedMedia)}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-primary text-primary-foreground shadow hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 size-9 h-12 w-12 shrink-0 rounded-lg"
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
