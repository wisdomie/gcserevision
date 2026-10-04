import katex from "katex";
import { Fragment } from "react";

/** Splits text on unescaped $...$ into alternating text and maths segments. */
export function splitMath(text: string): { math: boolean; value: string }[] {
  const out: { math: boolean; value: string }[] = [];
  const re = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > last) out.push({ math: false, value: text.slice(last, match.index) });
    out.push({ math: true, value: match[1] });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ math: false, value: text.slice(last) });
  return out.map((s) => (s.math ? s : { ...s, value: s.value.replace(/\\\$/g, "$") }));
}

function renderMath(latex: string): string {
  return katex.renderToString(latex, {
    throwOnError: false,
    strict: "ignore",
    output: "htmlAndMathml",
  });
}

/** Renders one line of text with inline $LaTeX$. */
export function MathInline({ text }: { text: string }) {
  return (
    <>
      {splitMath(text).map((seg, i) =>
        seg.math ? (
          // KaTeX output is generated from our own LaTeX and escapes its input.
          <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(seg.value) }} />
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        ),
      )}
    </>
  );
}

/** Renders paragraphs (split on blank lines) of text with inline $LaTeX$. */
export function MathText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="my-2 first:mt-0 last:mb-0">
          <MathInline text={para} />
        </p>
      ))}
    </div>
  );
}
