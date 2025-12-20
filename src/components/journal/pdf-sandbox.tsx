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
  title?: string;
  viewHref: string;
  downloadHref: string;
};

export default function PdfSandbox({ title, viewHref, downloadHref }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className="bg-accent text-accent-foreground" onClick={() => setOpen(true)}>
        View PDF
      </Button>
      <Button asChild variant="outline">
        <a href={downloadHref} target="_blank" rel="noopener noreferrer">
          Download PDF
        </a>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{title || 'PDF'}</DialogTitle>
            <DialogDescription>Preview the paper here, then download if needed.</DialogDescription>
          </DialogHeader>

          <div className="h-[75vh] w-full overflow-hidden rounded-md border bg-background">
            <iframe title="PDF preview" src={viewHref} className="h-full w-full" />
          </div>

          <DialogFooter>
            <Button asChild>
              <a href={downloadHref} target="_blank" rel="noopener noreferrer">
                Download PDF
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={viewHref} target="_blank" rel="noopener noreferrer">
                Open in new tab
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

