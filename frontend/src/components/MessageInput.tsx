import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Send, Image as ImageIcon, Mic, Square, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
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
  const [detectedMedia, setDetectedMedia] = useState<DetectedMedia | null>(null);
  const [giphySearch, setGiphySearch] = useState('');
  const [giphyGifs, setGiphyGifs] = useState<GiphyGif[]>([]);
  const [isLoadingGiphy, setIsLoadingGiphy] = useState(false);
  const [giphyError, setGiphyError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_MESSAGE_LENGTH = 2000;

  const debouncedGiphySearch = useDebouncedValue(giphySearch, 500);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
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
    if (!urls || urls.length === 0) { setDetectedMedia(null); return; }
    for (const url of urls) {
      if (isYouTubeUrl(url)) { setDetectedMedia({ url, type: 'youtube' }); return; }
      if (isTwitchUrl(url)) { setDetectedMedia({ url, type: 'twitch' }); return; }
      if (isTwitterUrl(url)) { setDetectedMedia({ url, type: 'twitter' }); return; }
    }
    setDetectedMedia(null);
  }, [message, showMediaInput]);

  // Load trending GIFs when Giphy tab is opened
  useEffect(() => {
    if (showMediaInput && mediaTab === 'giphy' && giphyGifs.length === 0 && !debouncedGiphySearch) {
      loadTrendingGifs();
    }
  }, [showMediaInput, mediaTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search GIFs when search term changes
  useEffect(() => {
    if (showMediaInput && mediaTab === 'giphy') {
      if (debouncedGiphySearch.trim()) {
        searchGifs(debouncedGiphySearch);
      } else {
        loadTrendingGifs();
      }
    }
  }, [debouncedGiphySearch, showMediaInput, mediaTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrendingGifs = async () => {
    setIsLoadingGiphy(true);
    setGiphyError('');
    try {
      const result = await fetchTrendingGiphy();
      if (result.error) setGiphyError(result.error);
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
      if (result.error) setGiphyError(result.error);
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
      try { localStorage.setItem(storageKey, dataUrl); } catch { /* localStorage full */ }
      setUploadProgress(100);
      return `data:${audioBlob.type};blob-storage-id=${audioId};base64,${dataUrl.split(',')[1]}`;
    } catch (error) {
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
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    if (showMediaInput) {
      if (mediaTab === 'image' && selectedFile) {
        if (!validateImageFile(selectedFile)) return;
        try {
          setIsUploading(true);
          const mediaUrl = await uploadImage(selectedFile, (progress) => setUploadProgress(progress));
          const content = message.trim() || 'Image';
          onSendMessage(content, mediaUrl, 'image');
          setMessage('');
          setSelectedFile(null);
          setShowMediaInput(false);
          setMediaError('');
          setUploadProgress(0);
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          if (fileInputRef.current) fileInputRef.current.value = '';
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
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
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
  const ringRadius = 10;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference * (1 - Math.min(messageProgressPercentage / 100, 1));
  const isNearLimit = message.length > MAX_MESSAGE_LENGTH * 0.8;
  const isOverLimit = message.length > MAX_MESSAGE_LENGTH;

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
            <p className="text-xs text-muted-foreground mt-1 truncate">{detectedMedia.url}</p>
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
    <div className="w-full">
      {recordingError && (
        <div className="mb-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
          {recordingError}
        </div>
      )}

      {isRecording && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-destructive/10 p-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-destructive" />
            <span className="text-sm font-medium text-foreground">
              Recording: {formatRecordingTime(recordingTime)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelRecording}
              className="inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-full border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground transition-all"
              title="Cancel recording"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={stopRecording}
              className="inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-full border bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-all"
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
            <div className="mb-2 rounded-lg border bg-card p-4">
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
                      <div className="text-sm text-muted-foreground">
                        Selected: {selectedFile.name}
                      </div>
                    )}
                    {isUploading && (
                      <div className="text-sm text-muted-foreground">
                        Uploading... {uploadProgress}%
                      </div>
                    )}
                    {mediaError && (
                      <div className="text-sm text-destructive">{mediaError}</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="giphy">
                  <div className="space-y-3">
                    <Input
                      placeholder="Search GIFs..."
                      value={giphySearch}
                      onChange={(e) => setGiphySearch(e.target.value)}
                    />
                    {giphyError && (
                      <div className="text-sm text-destructive">{giphyError}</div>
                    )}
                    <ScrollArea className="h-48">
                      {isLoadingGiphy ? (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          Loading GIFs...
                        </div>
                      ) : giphyGifs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          No GIFs found
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1">
                          {giphyGifs.map((gif) => (
                            <button
                              key={gif.id}
                              onClick={() => handleGifSelect(gif)}
                              className="aspect-square overflow-hidden rounded hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={gif.previewUrl}
                                alt={gif.title}
                                className="h-full w-full object-cover"
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

          {/* Main input row — flex with no overflow:hidden so send button is never clipped */}
          <div className="flex items-end gap-2 w-full">
            {/* Pill-shaped input area — flex-1 with min-w-0 so it shrinks, not the buttons */}
            <div className="relative flex flex-1 min-w-0 items-end rounded-full bg-muted px-3 py-2">
              {/* Left action buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0 mr-1 pb-0.5">
                <button
                  type="button"
                  onClick={handleImageButtonClick}
                  disabled={isRecording}
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors disabled:opacity-40"
                  title="Upload image or GIF"
                >
                  <ImageIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                disabled={disabled || isRecording}
                rows={1}
                className="flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-sm placeholder:text-muted-foreground py-0.5 leading-5 max-h-[120px] overflow-y-auto"
                style={{ scrollbarWidth: 'none' }}
              />

              {/* Character counter ring — inside pill, flex-shrink-0 */}
              {message.length > 0 && (
                <div className="flex-shrink-0 ml-1 pb-0.5">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    className="rotate-[-90deg]"
                    aria-label={`${message.length}/${MAX_MESSAGE_LENGTH} characters`}
                  >
                    <circle
                      cx="12" cy="12" r={ringRadius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-muted-foreground/20"
                    />
                    <circle
                      cx="12" cy="12" r={ringRadius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
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

            {/* Mic button — outside pill, flex-shrink-0 */}
            <div className="flex-shrink-0">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={handleMicButtonClick}
                disabled={disabled || showMediaInput}
                className="rounded-full h-10 w-10 text-muted-foreground hover:text-foreground"
                title={isRecording ? 'Cancel recording' : 'Record voice message'}
              >
                <Mic className="h-5 w-5" />
              </Button>
            </div>

            {/* Send button — outside pill, flex-shrink-0, always fully visible */}
            <div className="flex-shrink-0">
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                disabled={
                  disabled ||
                  isUploading ||
                  isSending ||
                  isRecording ||
                  isOverLimit ||
                  (!message.trim() && !showMediaInput)
                }
                className="rounded-full h-10 w-10"
                title="Send message"
              >
                {isSending ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
