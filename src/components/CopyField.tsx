"use client";

import { useState } from "react";
import type { ChannelField } from "@/lib/channels";

/**
 * Clipboard write with a fallback, because `navigator.clipboard` is missing on
 * older iOS and on any page served over plain http from another device — which
 * is exactly how you would test this from a phone on the home network.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export default function CopyField({ field }: { field: ChannelField }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    const ok = await copyText(field.value);
    setState(ok ? "copied" : "failed");
    window.setTimeout(() => setState("idle"), 1800);
  }

  return (
    <div className="field">
      <div className="field-head">
        <h3>{field.label}</h3>
        <button className="btn-small" onClick={handleCopy} type="button">
          {state === "copied" ? "Copied" : state === "failed" ? "Select it manually" : "Copy"}
        </button>
      </div>
      <div className="field-value">{field.value}</div>
      {field.hint && <p className="help">{field.hint}</p>}
    </div>
  );
}
