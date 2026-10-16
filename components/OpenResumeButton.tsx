"use client";

import { useState } from "react";
import { toast } from "sonner";

export function OpenResumeButton({
  applicationId,
  className,
}: {
  applicationId: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  const open = async () => {
    const popup = window.open("about:blank", "_blank");
    setPending(true);
    try {
      const response = await fetch("/api/resume/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId }),
      });
      const body = (await response.json()) as { url?: string; message?: string };
      if (!response.ok || !body.url) throw new Error(body.message);
      const pdf = await fetch(body.url);
      if (!pdf.ok) throw new Error("Resume not found");
      const objectUrl = URL.createObjectURL(
        new Blob([await pdf.arrayBuffer()], { type: "application/pdf" }),
      );
      if (popup && !popup.closed) popup.location.replace(objectUrl);
      else window.open(objectUrl, "_blank");
    } catch {
      popup?.close();
      toast.error("Couldn't open resume");
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={pending}
      className={className}
    >
      {pending ? "Opening..." : "View Resume"}
    </button>
  );
}
