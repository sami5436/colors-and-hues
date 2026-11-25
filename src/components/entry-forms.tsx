"use client";

import { useActionState, useState } from "react";

import { createRoom, joinRoom, type FormState } from "@/app/actions";
import { normalizeCode } from "@/lib/game";

import { Button, Card, inputClass, Label } from "./ui";

const MODES = [
  { id: "clue", title: "Clue", body: "One player describes a hidden square. Everyone else hunts for it on the board." },
  { id: "recall", title: "Recall", body: "A color flashes for five seconds. Rebuild it from memory." },
] as const;

function ErrorLine({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="text-sm text-accent">
      {state.error}
    </p>
  );
}

export function CreateRoomForm() {
  const [state, action, pending] = useActionState(createRoom, undefined);
  const [mode, setMode] = useState<"clue" | "recall">("clue");

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-3xl leading-none">Start a room</h2>
      <p className="mt-2 text-sm text-muted">You&apos;ll be the host. Share the code with friends.</p>
      <form action={action} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="create-name">Your name</Label>
          <input
            id="create-name"
            name="name"
            maxLength={16}
            autoComplete="nickname"
            placeholder="Sam"
            className={inputClass}
            required
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-medium uppercase tracking-[0.08em] text-muted">Mode</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODES.map((m) => (
              <label
                key={m.id}
                className={`cursor-pointer rounded-md border p-3 transition-colors ${
                  mode === m.id ? "border-ink bg-paper" : "border-rule-strong hover:border-ink-2"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={m.id}
                  checked={mode === m.id}
                  onChange={() => setMode(m.id)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className={`size-3 rounded-full border-2 border-ink ${mode === m.id ? "bg-ink" : ""}`} />
                  {m.title}
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-muted">{m.body}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">You can switch modes in the lobby.</p>
        </fieldset>
        <ErrorLine state={state} />
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Creating..." : "Create room"}
        </Button>
      </form>
    </Card>
  );
}

export function JoinRoomForm({ initialCode = "" }: { initialCode?: string }) {
  const [state, action, pending] = useActionState(joinRoom, undefined);
  const [code, setCode] = useState(initialCode);

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-3xl leading-none">Join a room</h2>
      <p className="mt-2 text-sm text-muted">Ask the host for the four letter code.</p>
      <form action={action} className="mt-6 space-y-5">
        <div>
          <Label htmlFor="join-code">Room code</Label>
          <input
            id="join-code"
            name="code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="ABCD"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${inputClass} h-14 text-center font-mono text-2xl font-medium tracking-[0.5em] uppercase`}
            required
          />
        </div>
        <div>
          <Label htmlFor="join-name">Your name</Label>
          <input
            id="join-name"
            name="name"
            maxLength={16}
            autoComplete="nickname"
            placeholder="Alex"
            className={inputClass}
            required
          />
        </div>
        <ErrorLine state={state} />
        <Button
          type="submit"
          size="lg"
          variant={initialCode ? "solid" : "outline"}
          className="w-full"
          disabled={pending || code.length < 4}
        >
          {pending ? "Joining..." : "Join room"}
        </Button>
      </form>
    </Card>
  );
}
