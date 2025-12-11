"use client";

import type { Course } from "@/types/models";
import { getLiveUrl } from "@/lib/live";
import { useToast } from "@/hooks/use-toast";

export type LiveSessionButtonProps = {
  course?: Course;
  courseId?: string; // fallback legacy prop to compute default Jitsi room if course is absent
  label?: string;
};

export default function LiveSessionButton({ course, courseId, label }: LiveSessionButtonProps) {
  const { toast } = useToast();
  const handleClick = () => {
    let url: string | null = null;
    if (course) {
      url = getLiveUrl(course);
    } else if (courseId) {
      // legacy behavior if no course object
      const room = `CloudAIAcademy-${courseId}`;
      url = `https://meet.jit.si/${encodeURIComponent(room)}`;
    }
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast({
        variant: "destructive",
        title: "Live session not configured",
        description: "This course does not have a live meeting link configured.",
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
    >
      {label ?? "Join Live Session"}
    </button>
  );
}
