"use client";

import { useEffect, useState } from "react";

import { leaveRoom } from "@/app/actions";

import { Button } from "../ui";
import { useGame } from "./shared";

export function TopBarActions({ code }: { code: string }) {
  const { run, busy } = useGame();
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const id = setTimeout(() => setConfirming(false), 3000);
    return () => clearTimeout(id);
  }, [confirming]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked; the code is visible anyway.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={copy}
        className="group flex h-9 items-center gap-2 rounded-md border border-rule-strong bg-card pl-3 pr-2.5 text-sm transition-colors hover:border-ink"
        title="Copy invite link"
      >
        <span className="font-mono font-semibold tracking-[0.25em]">{code}</span>
        <span className="text-xs text-muted group-hover:text-ink">{copied ? "Copied" : "Copy link"}</span>
      </button>
      <Button
        variant={confirming ? "solid" : "ghost"}
        size="sm"
        className="h-9"
        disabled={busy}
        onClick={() => (confirming ? run(() => leaveRoom(code)) : setConfirming(true))}
      >
        {confirming ? "Leave room?" : "Leave"}
      </Button>
    </div>
  );
}
