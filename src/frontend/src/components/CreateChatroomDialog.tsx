import { useState, useEffect, useRef } from 'react';
import { useCreateChatroom, uploadImage } from '../hooks/useQueries';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Loader2, AlertCircle, Upload, Video, Plus } from 'lucide-react';
import { SiX } from 'react-icons/si';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface CreateChatroomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CATEGORIES = [
  'General',
  'Gaming',
  'Technology',
  'Music',
  'Art',
  'Sports',
  'Entertainment',
  'Education',
  'News',
  'Politics',
  'Finance',
  'Other',
];

// Declare Twitter widgets type
declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void;
        createTweet: (
          tweetId: string,
          targetElement: HTMLElement,
          options?: {
            theme?: 'light' | 'dark';
            align?: 'left' | 'center' | 'right';
            conversation?: 'none' | 'all';
            dnt?: boolean;
          }
        ) => Promise<HTMLElement | undefined>;
      };
      ready?: (callback: () => void) => void;
    };
  }
}

function getTwitterPostId(url: string): string | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
  return match ? match[1] : null;
}

// Load Twitter widgets script
function loadTwitterScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.twttr) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Twitter widgets script'));
    document.body.appendChild(script);
  });
}

export default function CreateChatroomDialog({ open, onOpenChange }: CreateChatroomDialogProps) {
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaTab, setMediaTab] = useState<'upload' | 'video' | 'twitter'>('upload');
  const [tweetLoading, setTweetLoading] = useState(false);
  const tweetPreviewRef = useRef<HTMLDivElement>(null);
  const createChatroom = useCreateChatroom();

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
      return { isValid: true, type: null };
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
      return true;
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
        setMediaUrl('');
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleMediaUrlChange = (value: string) => {
    setMediaUrl(value);
    setSelectedFile(null);
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

  // Load Twitter embed preview when URL changes
  useEffect(() => {
    if (mediaTab === 'twitter' && mediaUrl.trim()) {
      const tweetId = getTwitterPostId(mediaUrl);
      if (tweetId && tweetPreviewRef.current && validateTwitterUrl(mediaUrl)) {
        setTweetLoading(true);
        
        // Clear previous content
        tweetPreviewRef.current.innerHTML = '';
        
        loadTwitterScript()
          .then(() => {
            if (window.twttr && tweetPreviewRef.current) {
              const isDark = document.documentElement.classList.contains('dark');
              
              window.twttr.widgets.createTweet(
                tweetId,
                tweetPreviewRef.current,
                {
                  theme: isDark ? 'dark' : 'light',
                  align: 'center',
                  conversation: 'none',
                  dnt: true,
                }
              ).then(() => {
                setTweetLoading(false);
              }).catch(() => {
                setTweetLoading(false);
              });
            }
          })
          .catch(() => {
            setTweetLoading(false);
          });
      }
    }
  }, [mediaTab, mediaUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!topic.trim() || !description.trim() || !category) {
      setMediaError('Topic, description, and category are required');
      return;
    }

    let finalMediaUrl = '';
    let mediaType = '';

    // Only process media if provided
    if (mediaTab === 'upload' && selectedFile) {
      if (!validateImageFile(selectedFile)) {
        return;
      }
      
      console.log('[CreateChatroom] Starting image upload...');
      
      try {
        setIsUploading(true);
        setUploadProgress(0);
        finalMediaUrl = await uploadImage(selectedFile, (progress) => {
          setUploadProgress(progress);
        });
        mediaType = 'image';
        
        console.log('[CreateChatroom] Image uploaded successfully');
      } catch (error) {
        console.error('[CreateChatroom] Upload error:', error);
        setMediaError(error instanceof Error ? error.message : 'Failed to upload image');
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    } else if (mediaTab === 'video' && mediaUrl.trim()) {
      const validation = validateVideoUrl(mediaUrl);
      if (!validation.isValid) {
        return;
      }
      if (validation.type) {
        finalMediaUrl = mediaUrl.trim();
        mediaType = validation.type;
      }
    } else if (mediaTab === 'twitter' && mediaUrl.trim()) {
      if (!validateTwitterUrl(mediaUrl)) {
        return;
      }
      finalMediaUrl = mediaUrl.trim();
      mediaType = 'twitter';
    }

    console.log('[CreateChatroom] Submitting chatroom creation:', {
      topic: topic.trim(),
      description: description.trim(),
      category,
      mediaUrl: finalMediaUrl,
      mediaType,
    });

    await createChatroom.mutateAsync({
      topic: topic.trim(),
      description: description.trim(),
      mediaUrl: finalMediaUrl,
      mediaType: mediaType,
      category,
    });

    // Reset form
    setTopic('');
    setDescription('');
    setCategory('');
    setMediaUrl('');
    setSelectedFile(null);
    setMediaError('');
    setUploadProgress(0);
    setTweetLoading(false);
    if (tweetPreviewRef.current) {
      tweetPreviewRef.current.innerHTML = '';
    }
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTopic('');
    setDescription('');
    setCategory('');
    setMediaUrl('');
    setSelectedFile(null);
    setMediaError('');
    setUploadProgress(0);
    setIsUploading(false);
    setTweetLoading(false);
    if (tweetPreviewRef.current) {
      tweetPreviewRef.current.innerHTML = '';
    }
    onOpenChange(false);
  };

  const isFormValid = 
    topic.trim() && 
    description.trim() && 
    category &&
    !mediaError;

  const isSubmitting = createChatroom.isPending || isUploading;

  const topicProgressPercentage = (topic.length / 65) * 100;
  const descriptionProgressPercentage = (description.length / 150) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Chat</DialogTitle>
          <DialogDescription>
            Start a conversation around a topic with optional media content
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter chat topic"
              disabled={isSubmitting}
              required
              maxLength={65}
              style={{ fontSize: '16px' }}
            />
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${topicProgressPercentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this chat is about"
              disabled={isSubmitting}
              required
              maxLength={150}
              rows={3}
              style={{ fontSize: '16px' }}
            />
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-accent transition-all duration-200"
                style={{ width: `${descriptionProgressPercentage}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={isSubmitting}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Media Content (Optional)</Label>
            <Tabs value={mediaTab} onValueChange={(v) => setMediaTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload" disabled={isSubmitting}>
                  <Upload className="mr-1 h-3 w-3" />
                  Image
                </TabsTrigger>
                <TabsTrigger value="video" disabled={isSubmitting}>
                  <Video className="mr-1 h-3 w-3" />
                  Video
                </TabsTrigger>
                <TabsTrigger value="twitter" disabled={isSubmitting}>
                  <SiX className="mr-1 h-3 w-3" />
                  Twitter
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
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

              <TabsContent value="video" className="space-y-2">
                <Input
                  value={mediaUrl}
                  onChange={(e) => handleMediaUrlChange(e.target.value)}
                  placeholder="YouTube or Twitch URL"
                  type="url"
                  disabled={isSubmitting}
                  className="text-sm"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a YouTube or Twitch video URL - automatically detected
                </p>
              </TabsContent>

              <TabsContent value="twitter" className="space-y-2">
                <Input
                  value={mediaUrl}
                  onChange={(e) => handleMediaUrlChange(e.target.value)}
                  placeholder="https://twitter.com/user/status/..."
                  type="url"
                  disabled={isSubmitting}
                  className="text-sm"
                  style={{ fontSize: '16px' }}
                />
                <p className="text-xs text-muted-foreground">
                  Paste a Twitter/X post URL
                </p>
                {(tweetLoading || (mediaUrl.trim() && getTwitterPostId(mediaUrl))) && (
                  <>
                    {tweetLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <div ref={tweetPreviewRef} />
                  </>
                )}
              </TabsContent>
            </Tabs>

            {mediaError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{mediaError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Chat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
