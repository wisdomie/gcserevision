// Algebraic expressions: parsing, evaluation, equivalence and form checks
// (PLAN.md 6.3). Accepts typed text ("2(x+2)", "x^2 - 4") and LaTeX from
// MathLive ("2\left(x+2\right)", "x^{2}-4", "\frac{y-2}{3}").
//
// Form checks are best-effort and look at the structure the player wrote:
// - expanded:   no product, power or negation applied to a sum, and like terms collected
// - factorised: the top level is a product (or a power of a sum), and each
//               bracket has no common factor left in it
// - simplified: like terms collected, at most one number and one power of each
//               letter in each term
// They do not try to recognise every textbook convention (e.g. they accept
// either sign convention for factorising out -1).

import { createRng } from "../rng";
import { gcd } from "../util/numbers";

export type Node =
  | { type: "num"; value: number }
  | { type: "var"; name: string }
  | { type: "add"; args: Node[] }
  | { type: "mul"; args: Node[] }
  | { type: "div"; num: Node; den: Node }
  | { type: "pow"; base: Node; exp: Node }
  | { type: "neg"; arg: Node }
  | { type: "sqrt"; arg: Node };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type Token =
  | { t: "num"; v: number }
  | { t: "var"; v: string }
  | { t: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { t: "open"; v: "(" | "{" }
  | { t: "close"; v: ")" | "}" }
  | { t: "frac" }
  | { t: "sqrt" };

const CONSTANTS: Record<string, number> = { pi: Math.PI };

function tokenize(input: string): Token[] | null {
  const s = input
    .replace(/\\left|\\right/g, "")
    .replace(/\\[dt]?frac/g, "\\frac")
    .replace(/\\(?:cdot|times)/g, "*")
    .replace(/\\div/g, "/")
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\[|\]/g, (b) => (b === "[" ? "(" : ")"));
  const out: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      // A number straight after a number ("1..2", "2 3") is never meaningful
      if (!m || out.at(-1)?.t === "num") return null;
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      out.push({ t: "var", v: c });
      i++;
      continue;
    }
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
      if (!m) return null;
      const cmd = m[1];
      i += m[0].length;
      if (cmd === "frac") out.push({ t: "frac" });
      else if (cmd === "sqrt") out.push({ t: "sqrt" });
      else if (cmd in CONSTANTS) out.push({ t: "num", v: CONSTANTS[cmd] });
      else if (/^(?:alpha|beta|theta|lambda|mu)$/.test(cmd)) out.push({ t: "var", v: cmd });
      else return null; // unknown command, e.g. \sin (not needed yet)
      continue;
    }
    if ("+-*/^".includes(c)) out.push({ t: "op", v: c as "+" });
    else if (c === "(" || c === "{") out.push({ t: "open", v: c });
    else if (c === ")" || c === "}") out.push({ t: "close", v: c });
    else return null;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent)
// ---------------------------------------------------------------------------

class Parser {
  private i = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node | null {
    const node = this.expr();
    return node && this.i === this.tokens.length ? node : null;
  }

  private peek() {
    return this.tokens[this.i];
  }

  private isOp(v: string) {
    const tok = this.peek();
    return tok?.t === "op" && tok.v === v;
  }

  private expr(): Node | null {
    const terms: Node[] = [];
    const first = this.term();
    if (!first) return null;
    terms.push(first);
    while (this.isOp("+") || this.isOp("-")) {
      const minus = this.isOp("-");
      this.i++;
      const next = this.term();
      if (!next) return null;
      terms.push(minus ? { type: "neg", arg: next } : next);
    }
    return terms.length === 1 ? terms[0] : { type: "add", args: terms };
  }

  /** Can the current token start a factor (for implicit multiplication)? */
  private startsFactor() {
    const tok = this.peek();
    return (
      !!tok &&
      (tok.t === "num" ||
        tok.t === "var" ||
        tok.t === "open" ||
        tok.t === "frac" ||
        tok.t === "sqrt")
    );
  }

  private term(): Node | null {
    let node = this.unary();
    if (!node) return null;
    for (;;) {
      if (this.isOp("*")) {
        this.i++;
        const right = this.unary();
        if (!right) return null;
        node = mul(node, right);
      } else if (this.isOp("/")) {
        this.i++;
        const right = this.unary();
        if (!right) return null;
        node = { type: "div", num: node, den: right };
      } else if (this.startsFactor()) {
        // Implicit multiplication: 2x, 2(x+1), (x+1)(x+2), x\frac{1}{2}
        const right = this.power();
        if (!right) return null;
        node = mul(node, right);
      } else {
        return node;
      }
    }
  }

  private unary(): Node | null {
    if (this.isOp("-")) {
      this.i++;
      const arg = this.unary();
      return arg && { type: "neg", arg };
    }
    if (this.isOp("+")) {
      this.i++;
      return this.unary();
    }
    return this.power();
  }

  private power(): Node | null {
    const base = this.primary();
    if (!base) return null;
    if (this.isOp("^")) {
      this.i++;
      const exp = this.unary(); // right-associative, allows x^-1 and x^{-1}
      return exp && { type: "pow", base, exp };
    }
    return base;
  }

  private group(open: "(" | "{"): Node | null {
    const tok = this.peek();
    if (tok?.t !== "open" || tok.v !== open) return null;
    this.i++;
    const inner = this.expr();
    const close = this.peek();
    if (!inner || close?.t !== "close" || close.v !== (open === "(" ? ")" : "}")) return null;
    this.i++;
    return inner;
  }

  private primary(): Node | null {
    const tok = this.peek();
    if (!tok) return null;
    if (tok.t === "num") {
      this.i++;
      return { type: "num", value: tok.v };
    }
    if (tok.t === "var") {
      this.i++;
      return { type: "var", name: tok.v };
    }
    if (tok.t === "open") return this.group(tok.v);
    if (tok.t === "frac") {
      this.i++;
      const num = this.group("{");
      const den = num && this.group("{");
      return den ? { type: "div", num: num!, den } : null;
    }
    if (tok.t === "sqrt") {
      this.i++;
      const arg = this.group("{") ?? this.primary();
      return arg && { type: "sqrt", arg };
    }
    return null;
  }
}

function mul(a: Node, b: Node): Node {
  const args = [...(a.type === "mul" ? a.args : [a]), ...(b.type === "mul" ? b.args : [b])];
  return { type: "mul", args };
}

/** Parses an expression, or returns null if it can't be read. */
export function parseExpression(input: string): Node | null {
  if (input.length > 200) return null;
  const tokens = tokenize(input);
  if (!tokens || tokens.length === 0) return null;
  try {
    return new Parser(tokens).parse();
  } catch {
    return null;
  }
}

/** Removes a leading "x =" so "x = (y-2)/3" can be compared with "(y-2)/3". */
export function stripSubject(input: string): string {
  return input.replace(/^\s*[a-zA-Z]\s*=(?!=)/, "");
}

// ---------------------------------------------------------------------------
// Evaluation and equivalence
// ---------------------------------------------------------------------------

export function evaluate(node: Node, env: Record<string, number>): number {
  switch (node.type) {
    case "num":
      return node.value;
    case "var":
      return env[node.name] ?? NaN;
    case "add":
      return node.args.reduce((s, a) => s + evaluate(a, env), 0);
    case "mul":
      return node.args.reduce((p, a) => p * evaluate(a, env), 1);
    case "div":
      return evaluate(node.num, env) / evaluate(node.den, env);
    case "pow":
      return evaluate(node.base, env) ** evaluate(node.exp, env);
    case "neg":
      return -evaluate(node.arg, env);
    case "sqrt":
      return Math.sqrt(evaluate(node.arg, env));
  }
}

export function variablesOf(node: Node, out = new Set<string>()): Set<string> {
  switch (node.type) {
    case "var":
      out.add(node.name);
      break;
    case "add":
    case "mul":
      node.args.forEach((a) => variablesOf(a, out));
      break;
    case "div":
      variablesOf(node.num, out);
      variablesOf(node.den, out);
      break;
    case "pow":
      variablesOf(node.base, out);
      variablesOf(node.exp, out);
      break;
    case "neg":
    case "sqrt":
      variablesOf(node.arg, out);
      break;
  }
  return out;
}

const MIN_POINTS = 8;

/**
 * Numerical equivalence: both expressions agree (relative tolerance 1e-9) at
 * at least 8 random points, skipping points where either is undefined.
 * Deterministic: the points come from a fixed seed.
 */
export function equivalent(a: Node, b: Node): boolean {
  const vars = [...new Set([...variablesOf(a), ...variablesOf(b)])];
  const rng = createRng(0x5eed);
  let agreed = 0;
  for (let attempt = 0; attempt < 60 && agreed < MIN_POINTS; attempt++) {
    const env: Record<string, number> = {};
    for (const v of vars) env[v] = (rng.next() * 2 - 1) * 4 + 0.137; // avoid 0 and small integers
    const x = evaluate(a, env);
    const y = evaluate(b, env);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (Math.abs(x - y) > 1e-9 * Math.max(1, Math.abs(x), Math.abs(y))) return false;
    agreed++;
  }
  return agreed >= MIN_POINTS;
}

// ---------------------------------------------------------------------------
// Polynomials (for form checks)
// ---------------------------------------------------------------------------

/** monomial key ("x^2*y") -> coefficient. Keys are sorted; "" is the constant term. */
type Poly = Map<string, number>;

function monoKey(powers: Record<string, number>): string {
  return Object.keys(powers)
    .filter((v) => powers[v] !== 0)
    .sort()
    .map((v) => (powers[v] === 1 ? v : `${v}^${powers[v]}`))
    .join("*");
}

function parseKey(key: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!key) return out;
  for (const part of key.split("*")) {
    const [v, e] = part.split("^");
    out[v] = e ? Number(e) : 1;
  }
  return out;
}

function addPoly(a: Poly, b: Poly, sign = 1): Poly {
  const out = new Map(a);
  for (const [k, c] of b) out.set(k, (out.get(k) ?? 0) + sign * c);
  for (const [k, c] of out) if (Math.abs(c) < 1e-12) out.delete(k);
  return out;
}

function mulPoly(a: Poly, b: Poly): Poly {
  let out: Poly = new Map();
  for (const [ka, ca] of a) {
    for (const [kb, cb] of b) {
      const pa = parseKey(ka);
      const pb = parseKey(kb);
      for (const [v, e] of Object.entries(pb)) pa[v] = (pa[v] ?? 0) + e;
      out = addPoly(out, new Map([[monoKey(pa), ca * cb]]));
    }
  }
  return out;
}

/** The expression as a polynomial, or null if it isn't one (e.g. division by a variable). */
export function toPolynomial(node: Node): Poly | null {
  switch (node.type) {
    case "num":
      return node.value === 0 ? new Map() : new Map([["", node.value]]);
    case "var":
      return new Map([[node.name, 1]]);
    case "add": {
      let out: Poly = new Map();
      for (const a of node.args) {
        const p = toPolynomial(a);
        if (!p) return null;
        out = addPoly(out, p);
      }
      return out;
    }
    case "mul": {
      let out: Poly = new Map([["", 1]]);
      for (const a of node.args) {
        const p = toPolynomial(a);
        if (!p) return null;
        out = mulPoly(out, p);
      }
      return out;
    }
    case "neg": {
      const p = toPolynomial(node.arg);
      return p && addPoly(new Map(), p, -1);
    }
    case "div": {
      const num = toPolynomial(node.num);
      const den = toPolynomial(node.den);
      if (!num || !den || den.size !== 1 || !den.has("")) return null; // only division by a number
      const d = den.get("")!;
      return new Map([...num].map(([k, c]) => [k, c / d]));
    }
    case "pow": {
      const base = toPolynomial(node.base);
      const exp = toPolynomial(node.exp);
      const n = exp?.size === 0 ? 0 : exp?.size === 1 ? exp.get("") : undefined;
      if (!base || n === undefined || !Number.isInteger(n) || n < 0 || n > 12) return null;
      let out: Poly = new Map([["", 1]]);
      for (let i = 0; i < n; i++) out = mulPoly(out, base);
      return out;
    }
    case "sqrt":
      return null;
  }
}

// ---------------------------------------------------------------------------
// Form checks
// ---------------------------------------------------------------------------

const stripNeg = (n: Node): Node => (n.type === "neg" ? stripNeg(n.arg) : n);
const isSum = (n: Node) => stripNeg(n).type === "add";
const children = (n: Node): Node[] =>
  n.type === "add" || n.type === "mul"
    ? n.args
    : n.type === "div"
      ? [n.num, n.den]
      : n.type === "pow"
        ? [n.base, n.exp]
        : n.type === "neg" || n.type === "sqrt"
          ? [n.arg]
          : [];

/** True if some product, power or negation is applied to a sum, e.g. 2(x+1), (x+1)^2, -(x+1). */
function hasBracketedSum(node: Node): boolean {
  if (node.type === "mul" && node.args.some(isSum)) return true;
  if (node.type === "pow" && isSum(node.base)) return true;
  if (node.type === "neg" && node.arg.type === "add") return true;
  if (node.type === "div" && isSum(node.den)) return true;
  return children(node).some(hasBracketedSum);
}

/** Top-level terms of an expression, with signs folded in. */
function topTerms(node: Node): Node[] {
  return node.type === "add" ? node.args : [node];
}

/**
 * Like terms are collected: each top-level term is a single monomial and no two
 * terms share one. Terms that aren't polynomial monomials are left alone.
 */
export function likeTermsCollected(node: Node): boolean {
  const seen = new Set<string>();
  for (const term of topTerms(node)) {
    const p = toPolynomial(term);
    if (!p) continue;
    if (p.size === 0) return false; // a zero term such as "+ 0" or "x - x"
    if (p.size > 1) return false; // e.g. a bracket that still holds a sum
    const key = [...p.keys()][0];
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** Within each term, at most one number and each letter appears once (x*x should be x^2). */
function termsTidy(node: Node): boolean {
  for (const term of topTerms(node)) {
    const t = stripNeg(term);
    if (t.type !== "mul") continue;
    const nums = t.args.filter((a) => a.type === "num").length;
    const letters = t.args.flatMap((a) =>
      a.type === "var" ? [a.name] : a.type === "pow" && a.base.type === "var" ? [a.base.name] : [],
    );
    if (nums > 1 || new Set(letters).size !== letters.length) return false;
  }
  return true;
}

export function isSimplified(node: Node): boolean {
  return likeTermsCollected(node) && termsTidy(node);
}

export function isExpanded(node: Node): boolean {
  return !hasBracketedSum(node) && isSimplified(node);
}

/** A bracket with no common factor left in it: coefficient gcd 1 and no letter in every term. */
function bracketFullyFactorised(node: Node): boolean {
  const p = toPolynomial(node);
  if (!p || p.size < 2) return true;
  const coeffs = [...p.values()];
  if (coeffs.every(Number.isInteger) && coeffs.reduce((g, c) => gcd(g, c), 0) > 1) return false;
  const keys = [...p.keys()].map(parseKey);
  const letters = new Set(keys.flatMap(Object.keys));
  for (const v of letters) if (keys.every((k) => (k[v] ?? 0) > 0)) return false;
  return true;
}

export function isFactorised(node: Node): boolean {
  const top = stripNeg(node);
  const factors =
    top.type === "mul" ? top.args : top.type === "pow" && isSum(top.base) ? [top.base] : null;
  if (!factors || !factors.some((f) => isSum(f) || (f.type === "pow" && isSum(f.base))))
    return false;
  return factors.every((f) => {
    const inner = f.type === "pow" ? f.base : f;
    return !isSum(inner) || bracketFullyFactorised(stripNeg(inner));
  });
}
