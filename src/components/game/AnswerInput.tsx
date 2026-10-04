"use client";

import { useEffect, useRef } from "react";
import { MathInline } from "@/components/math/MathText";
import type { InputType } from "@/lib/engine/types";

const HINTS: Record<Exclude<InputType, "mcq">, string> = {
  numeric: "Type a number, e.g. 42 or 3.5",
  fraction: "Type a fraction, e.g. 3/4 or 1 1/2",
  expression: "e.g. x = 3, 2:5 or 4.5 x 10^3",
  multi: "Type your answer",
};

interface Props {
  inputType: InputType;
  options?: string[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function AnswerInput({ inputType, options, value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  if (inputType === "mcq" && options) {
    return (
      <fieldset disabled={disabled} className="flex flex-col gap-2">
        <legend className="sr-only">Choose an answer</legend>
        {options.map((opt, i) => (
          <label
            key={i}
            className="border-border bg-background has-[:checked]:border-accent has-[:checked]:ring-accent has-[:focus-visible]:outline-accent flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 has-[:checked]:ring-2 has-[:focus-visible]:outline-3"
          >
            <input
              type="radio"
              name="mcq"
              value={i}
              checked={value === String(i)}
              onChange={() => onChange(String(i))}
              className="size-4"
            />
            <span className="text-lg">
              <MathInline text={opt} />
            </span>
          </label>
        ))}
      </fieldset>
    );
  }

  const hint = HINTS[inputType === "mcq" ? "numeric" : inputType];
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="answer" className="font-medium">
        Your answer
      </label>
      <input
        ref={inputRef}
        id="answer"
        name="answer"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={200}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-describedby="answer-hint"
        className="border-border bg-background min-h-12 rounded-xl border px-3 text-lg"
      />
      <p id="answer-hint" className="text-muted text-sm">
        {hint}
      </p>
    </div>
  );
}
