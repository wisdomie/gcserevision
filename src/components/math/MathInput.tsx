"use client";

import { useEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";

type Mode = "maths" | "text";
const MODE_KEY = "mathInputMode";

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "text" ? "text" : "maths";
  } catch {
    return "maths";
  }
}

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when Enter is pressed in the maths field, with the field's current value. */
  onEnter?: (value: string) => void;
  disabled: boolean;
  describedBy?: string;
  /** Id of the visible label, used to name the maths field for screen readers. */
  labelledBy?: string;
  placeholder?: string;
}

/**
 * Maths answer box: a MathLive field (with an on-screen maths keyboard on
 * touch devices) and a visible toggle to a plain text box. Both produce a
 * string the server-side checker understands (LaTeX or plain text).
 */
export function MathInput({
  id,
  value,
  onChange,
  onEnter,
  disabled,
  describedBy,
  labelledBy,
  placeholder,
}: Props) {
  // Rendered only on the client (after the question loads), so reading storage here is safe
  const [mode, setMode] = useState<Mode>(readMode);
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const handlers = useRef({ onChange, onEnter });
  /** The last value the maths field itself reported, to tell typing apart from outside resets. */
  const emitted = useRef(value);
  const latest = useRef({ value, disabled });

  useEffect(() => {
    handlers.current = { onChange, onEnter };
    latest.current = { value, disabled };
  });

  // Create the MathLive field on the client only
  useEffect(() => {
    if (mode !== "maths") return;
    let cancelled = false;
    let field: MathfieldElement | null = null;
    void import("mathlive").then(({ MathfieldElement }) => {
      if (cancelled || !hostRef.current) return;
      // Fonts come from the KaTeX stylesheet the app already loads
      MathfieldElement.fontsDirectory = null;
      MathfieldElement.soundsDirectory = null;
      field = new MathfieldElement();
      field.id = id;
      field.className =
        "block min-h-12 w-full rounded-xl border border-border bg-background px-2 text-xl";
      if (describedBy) field.setAttribute("aria-describedby", describedBy);
      if (labelledBy) field.setAttribute("aria-labelledby", labelledBy);
      // MathLive sets itself up after it is attached and fires "mount" when ready.
      // Keep it hidden until then so no keystroke lands in a half-ready field.
      field.style.visibility = "hidden";
      field.addEventListener(
        "mount",
        () => {
          if (cancelled || !field) return;
          field.mathVirtualKeyboardPolicy = "auto";
          field.smartMode = false;
          // Keep spaces so "1 1/2" stays a mixed number instead of becoming 11/2
          field.mathModeSpace = "\\,";
          field.menuItems = [];
          field.value = latest.current.value;
          emitted.current = latest.current.value;
          field.readOnly = latest.current.disabled;
          fieldRef.current = field;
          field.style.visibility = "";
          if (!latest.current.disabled) field.focus();
        },
        { once: true },
      );
      field.addEventListener("input", () => {
        emitted.current = field!.value;
        handlers.current.onChange(field!.value);
      });
      field.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          // Pass the live value: React state may not have caught up with the last keystroke
          handlers.current.onEnter?.(field!.value);
        }
      });
      hostRef.current.replaceChildren(field);
    });
    return () => {
      cancelled = true;
      field?.remove();
      fieldRef.current = null;
    };
  }, [mode, id, describedBy, labelledBy]);

  // Push a value into the field only when it changed from outside (e.g. reset
  // for the next question), never to echo typing back, which could race with
  // keystrokes made while the field was loading.
  useEffect(() => {
    const field = fieldRef.current;
    if (field && value !== emitted.current) {
      field.value = value;
      emitted.current = value;
    }
  }, [value]);

  // React to the question being answered (read-only) or the next one starting
  useEffect(() => {
    const field = fieldRef.current;
    if (field && field.readOnly !== disabled) {
      field.readOnly = disabled;
      if (!disabled) field.focus();
    }
    if (mode === "text" && !disabled) textRef.current?.focus();
  }, [disabled, mode]);

  function switchMode() {
    const next: Mode = mode === "maths" ? "text" : "maths";
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts until reload
    }
    emitted.current = "";
    onChange("");
    setMode(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {mode === "maths" ? (
        // MathLive owns this element's children; React never renders into it
        <div ref={hostRef} className="min-h-12" data-testid="math-field-host" />
      ) : (
        <input
          ref={textRef}
          id={id}
          name="answer"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          maxLength={200}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-describedby={describedBy}
          className="border-border bg-background min-h-12 rounded-xl border px-3 text-lg"
        />
      )}
      <button
        type="button"
        onClick={switchMode}
        disabled={disabled}
        className="text-accent min-h-11 self-start rounded-lg px-2 text-sm font-medium underline disabled:opacity-50"
      >
        {mode === "maths" ? "Use a plain text box instead" : "Use the maths keyboard instead"}
      </button>
    </div>
  );
}
