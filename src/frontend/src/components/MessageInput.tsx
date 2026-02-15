import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
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

  const handleCancelMedia = () => {
    setShowMediaInput(false);
    setSelectedFile(null);
    setVideoUrl('');
    setMediaError('');
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canSend = !disabled && !isUploading && !isSending && !isRecording && (
    (showMediaInput && ((mediaTab === 'image' && selectedFile) || (mediaTab !== 'image' && videoUrl.trim()))) ||
    (!showMediaInput && message.trim())
  );

  return (
    <div className="space-y-2">
      {showMediaInput && (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <Label className="text-sm font-medium">Add Media</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancelMedia}
              disabled={isUploading || isSending}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <Tabs value={mediaTab} onValueChange={(v) => setMediaTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="image" disabled={isUploading || isSending}>
                <ImageIcon className="mr-1 h-3 w-3" />
                Image
              </TabsTrigger>
              <TabsTrigger value="video" disabled={isUploading || isSending}>
                <Video className="mr-1 h-3 w-3" />
                Video
              </TabsTrigger>
              <TabsTrigger value="twitter" disabled={isUploading || isSending}>
                <SiX className="mr-1 h-3 w-3" />
                Twitter
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="image" className="space-y-2 mt-3">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isUploading || isSending}
                className="text-sm"
              />
              {selectedFile && (
                <p className="text-xs text-primary">
                  Selected: {selectedFile.name}
                </p>
              )}
              {isUploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {uploadProgress < 40 ? 'Compressing...' : 'Uploading...'} {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="video" className="space-y-2 mt-3">
              <Input
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="YouTube or Twitch URL"
                type="url"
                disabled={isUploading || isSending}
                className="text-sm"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-muted-foreground">
                Paste a YouTube or Twitch video URL - automatically detected
              </p>
            </TabsContent>

            <TabsContent value="twitter" className="space-y-2 mt-3">
              <Input
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="https://twitter.com/user/status/..."
                type="url"
                disabled={isUploading || isSending}
                className="text-sm"
                style={{ fontSize: '16px' }}
              />
              <p className="text-xs text-muted-foreground">
                Paste a Twitter/X post URL
              </p>
            </TabsContent>
          </Tabs>
          
          {mediaError && (
            <p className="mt-2 text-xs text-destructive">{mediaError}</p>
          )}
        </div>
      )}

      {isRecording && (
        <div className="rounded-lg border border-primary bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
              <span className="text-sm font-medium">Recording: {formatRecordingTime(recordingTime)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancelRecording}
                className="h-8"
              >
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={stopRecording}
                className="h-8"
              >
                <Square className="mr-1 h-4 w-4" />
                Stop
              </Button>
            </div>
          </div>
          {recordingError && (
            <p className="mt-2 text-xs text-destructive">{recordingError}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setShowMediaInput(!showMediaInput)}
          disabled={disabled || isUploading || isSending || isRecording}
          className="h-10 w-10 shrink-0 rounded-full"
        >
          <ImageIcon className="h-5 w-5" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isUploading || isSending || showMediaInput}
          className="h-10 w-10 shrink-0 rounded-full"
        >
          <Mic className="h-5 w-5" />
        </Button>

        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Recording..." : "Type a message..."}
          disabled={disabled || isUploading || isSending || isRecording}
          className="min-h-[40px] max-h-[120px] resize-none rounded-full px-4 py-2.5"
          rows={1}
          style={{ fontSize: '16px' }}
        />

        <Button
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
        >
          {isUploading || isSending ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
