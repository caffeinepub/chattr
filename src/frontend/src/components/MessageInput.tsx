import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Image as ImageIcon, Video, X, Mic, Square } from 'lucide-react';
import { SiX } from 'react-icons/si';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { uploadImage } from '../hooks/useQueries';

interface MessageInputProps {
  onSendMessage: (content: string, mediaUrl?: string, mediaType?: string) => void;
  disabled?: boolean;
  isSending?: boolean;
}

export default function MessageInput({ onSendMessage, disabled, isSending }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [mediaTab, setMediaTab] = useState<'image' | 'video' | 'twitter'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const detectVideoType = (url: string): 'youtube' | 'twitch' | null => {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return 'youtube';
    }
    
    if (lowerUrl.includes('twitch.tv') || lowerUrl.includes('clips.twitch.tv')) {
      return 'twitch';
    }
    
    return null;
  };

  const validateVideoUrl = (url: string): { isValid: boolean; type: 'youtube' | 'twitch' | null } => {
    if (!url.trim()) {
      setMediaError('URL is required');
      return { isValid: false, type: null };
    }

    const videoType = detectVideoType(url);
    
    if (!videoType) {
      setMediaError('Invalid video URL. Must be a YouTube or Twitch URL');
      return { isValid: false, type: null };
    }

    setMediaError('');
    return { isValid: true, type: videoType };
  };

  const validateTwitterUrl = (url: string): boolean => {
    if (!url.trim()) {
      setMediaError('URL is required');
      return false;
    }

    const lowerUrl = url.toLowerCase();
    const isTwitter = lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com');
    
    if (!isTwitter) {
      setMediaError('Invalid Twitter/X URL');
      return false;
    }

    setMediaError('');
    return true;
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

  const handleVideoUrlChange = (value: string) => {
    setVideoUrl(value);
    if (value.trim()) {
      if (mediaTab === 'video') {
        validateVideoUrl(value);
      } else if (mediaTab === 'twitter') {
        validateTwitterUrl(value);
      }
    } else {
      setMediaError('');
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
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create MediaRecorder
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
        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        try {
          // Upload audio
          const audioUrl = await uploadAudio(audioBlob);
          const content = message.trim() || 'Voice message';
          
          // Send message
          onSendMessage(content, audioUrl, 'audio');
          
          // Reset state
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
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
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
    // Stop the recorder without triggering upload
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      // Remove the onstop handler to prevent upload
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    
    // Stop all tracks to release microphone
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Clear timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    // Discard audio chunks
    audioChunksRef.current = [];
    
    // Reset UI to idle state
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
      } else if (mediaTab === 'video' && videoUrl.trim()) {
        const validation = validateVideoUrl(videoUrl);
        if (!validation.isValid || !validation.type) return;
        
        const content = message.trim() || `${validation.type === 'youtube' ? 'YouTube' : 'Twitch'} Video`;
        onSendMessage(content, videoUrl.trim(), validation.type);
        
        setMessage('');
        setVideoUrl('');
        setShowMediaInput(false);
        setMediaError('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      } else if (mediaTab === 'twitter' && videoUrl.trim()) {
        if (!validateTwitterUrl(videoUrl)) return;
        
        const content = message.trim() || 'Twitter Post';
        onSendMessage(content, videoUrl.trim(), 'twitter');
        
        setMessage('');
        setVideoUrl('');
        setShowMediaInput(false);
        setMediaError('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        return;
      } else {
        setMediaError('Please select media or enter a URL');
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

  const textProgressPercentage = (message.length / 2000) * 100;

  return (
    <div className="border-t border-border bg-card p-4">
      {recordingError && (
        <div className="mb-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {recordingError}
        </div>
      )}

      {isRecording && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-destructive/10 p-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium text-foreground">
              Recording: {formatRecordingTime(recordingTime)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelRecording}
              className="rounded-full p-2 hover:bg-muted transition-colors"
              title="Cancel recording"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
            <button
              onClick={stopRecording}
              className="rounded-full bg-destructive p-2 hover:bg-destructive/90 transition-colors"
              title="Stop and send"
            >
              <Square className="h-5 w-5 text-destructive-foreground" />
            </button>
          </div>
        </div>
      )}

      {showMediaInput && (
        <div className="mb-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Add Media</h3>
            <button
              onClick={() => {
                setShowMediaInput(false);
                setSelectedFile(null);
                setVideoUrl('');
                setMediaError('');
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="rounded-full p-1 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <Tabs value={mediaTab} onValueChange={(value) => setMediaTab(value as 'image' | 'video' | 'twitter')}>
            <TabsList className="grid w-full grid-cols-3 mb-3">
              <TabsTrigger value="image" className="flex items-center gap-1">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Image</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-1">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Video</span>
              </TabsTrigger>
              <TabsTrigger value="twitter" className="flex items-center gap-1">
                <SiX className="h-4 w-4" />
                <span className="hidden sm:inline">Twitter</span>
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

            <TabsContent value="video" className="space-y-3">
              <div>
                <Label htmlFor="video-url" className="text-sm text-muted-foreground">
                  YouTube or Twitch URL
                </Label>
                <Input
                  id="video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="mt-1"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </TabsContent>

            <TabsContent value="twitter" className="space-y-3">
              <div>
                <Label htmlFor="twitter-url" className="text-sm text-muted-foreground">
                  Twitter/X Post URL
                </Label>
                <Input
                  id="twitter-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => handleVideoUrlChange(e.target.value)}
                  placeholder="https://twitter.com/user/status/..."
                  className="mt-1"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </TabsContent>
          </Tabs>

          {mediaError && (
            <div className="mt-2 text-sm text-destructive">{mediaError}</div>
          )}

          {isUploading && (
            <div className="mt-3">
              <Progress value={uploadProgress} className="h-2" />
              <p className="mt-1 text-xs text-muted-foreground">Uploading... {uploadProgress}%</p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowMediaInput(!showMediaInput)}
            disabled={disabled || isRecording || isUploading}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || isUploading || isSending}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"
          >
            <Mic className="h-5 w-5" />
          </button>
        </div>

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
            maxLength={2000}
            rows={1}
            className="w-full resize-none rounded-full bg-background px-4 py-2.5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
            style={{ 
              minHeight: '40px',
              maxHeight: '120px',
              fontSize: '16px'
            }}
          />
          {isTextareaFocused && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-200"
                style={{ width: `${textProgressPercentage}%` }}
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={disabled || (!message.trim() && !selectedFile && !videoUrl.trim()) || isUploading || isSending || isRecording}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
