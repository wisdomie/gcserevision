// Plain-words versions of short LaTeX answers, used as accessible names for
// answer options (screen readers can't always read rendered maths in a label).

const REPLACEMENTS: [RegExp, string][] = [
  [/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1 over $2"],
  [/\\sqrt\{([^{}]*)\}/g, "square root of $1"],
  [/\^\{?\\circ\}?/g, " degrees"],
  [/\^\{2\}|\^2(?!\d)/g, " squared"],
  [/\^\{3\}|\^3(?!\d)/g, " cubed"],
  [/\^\{([^{}]*)\}|\^(\S)/g, " to the power $1$2"],
  [/\\times/g, " times "],
  [/\\div/g, " divided by "],
  [/\\pi/g, "pi"],
  [/\\left|\\right/g, ""],
  [/\\[,;:! ]/g, " "],
  [/\\text\{([^{}]*)\}/g, "$1"],
];

export function mathToSpeech(text: string): string {
  let s = text.replace(/(?<!\\)\$/g, "");
  // Inner fractions first, so nested ones are read from the inside out
  for (let i = 0; i < 3; i++) for (const [re, out] of REPLACEMENTS) s = s.replace(re, out);
  return s
    .replace(/[{}\\]/g, "")
    .replace(/(\d)\s*-\s*(?=\d)/g, "$1 minus ")
    .replace(/(^|[\s(=])-\s*/g, "$1minus ")
    .replace(/\s+/g, " ")
    .trim();
}
