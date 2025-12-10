"use client";

import Link from "next/link";

export type LiveSessionButtonProps = {
  courseId: string;
  label?: string;
};

export default function LiveSessionButton({ courseId, label }: LiveSessionButtonProps) {
  const roomName = `CloudAIAcademy-${courseId}`;
  const href = `/live/${encodeURIComponent(roomName)}`;

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
    >
      {label ?? "Join Live Session"}
    </Link>
  );
}
