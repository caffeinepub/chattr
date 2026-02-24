import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { ExternalLink } from 'lucide-react';

interface ExternalLinkDialogProps {
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ExternalLinkDialog({ url, open, onOpenChange }: ExternalLinkDialogProps) {
  const handleContinue = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            You are leaving this site
          </DialogTitle>
          <DialogDescription>
            You are about to visit an external website. Please be cautious when visiting external links.
          </DialogDescription>
        </DialogHeader>
        
        <div className="rounded-lg bg-muted p-3">
          <p className="text-sm font-medium text-muted-foreground mb-1">Destination:</p>
          <p className="text-sm break-all text-foreground">{url}</p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleContinue} className="w-full sm:w-auto">
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
