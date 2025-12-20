'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  title: string;
  triggerLabel: string;
  iframeSrc: string;
  openHref?: string;
  description?: string;
};

export default function ToolSandbox({
  title,
  triggerLabel,
  iframeSrc,
  openHref,
  description,
}: Props) {
  const [open, setOpen] = useState(false);
  const href = openHref || iframeSrc;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description || 'If the embed is blocked, use "Open in new tab".'}
            </DialogDescription>
          </DialogHeader>

          <div className="h-[75vh] w-full overflow-hidden rounded-md border bg-background">
            <iframe
              title={title}
              src={iframeSrc}
              className="h-full w-full"
              allow="fullscreen; clipboard-read; clipboard-write; geolocation; microphone; camera"
              loading="lazy"
            />
          </div>

          <DialogFooter>
            <Button asChild>
              <a href={href} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
