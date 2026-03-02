import { ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

interface ExternalLinkDisclaimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUrl: string | null;
  onConfirm: () => void;
}

export default function ExternalLinkDisclaimerModal({
  isOpen,
  onClose,
  targetUrl,
  onConfirm,
}: ExternalLinkDisclaimerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Leaving Chattr
          </DialogTitle>
          <DialogDescription className="pt-1">
            You are about to leave Chattr. External links may be unsafe — proceed with caution.
          </DialogDescription>
        </DialogHeader>
        {targetUrl && (
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground break-all font-mono">
            {targetUrl}
          </div>
        )}
        <DialogFooter className="gap-4 sm:gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
