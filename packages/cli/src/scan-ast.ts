import { promises as fs } from "node:fs";
import ts from "typescript";
import type { UnresolvedEntry } from "./scan-profile.js";
import { MAX_FILE_BYTES, relOf } from "./scan-fs.js";

function scriptKindFor(file: string): ts.ScriptKind {
  if (file.endsWith(".ts")) return ts.ScriptKind.TS;
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  return ts.ScriptKind.JS;
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name)) return name.text;
  if (ts.isStringLiteral(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  return null;
}

/** Top-level `const X = <expression>` aliases, one level of reference resolution. */
function collectAliases(sf: ts.SourceFile): Map<string, ts.Expression> {
  const aliases = new Map<string, ts.Expression>();
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer) {
        aliases.set(decl.name.text, decl.initializer);
      }
    }
  }
  return aliases;
}

/**
 * Resolves one expression to a literal value, or returns null. Only evaluates
 * literals, arrays, plain objects, one level of `const` aliases and
 * parenthesized expressions. Anything else (calls, spreads, templates with
 * expressions, property access) is unresolvable ON PURPOSE.
 */
function resolveLiteral(node: ts.Expression, sf: ts.SourceFile, aliases: Map<string, ts.Expression>, depth: number): unknown {
  if (depth > 8) return null;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text);
  }
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return resolveLiteral(node.expression, sf, aliases, depth + 1);
  if (ts.isArrayLiteralExpression(node)) {
    const out: unknown[] = [];
    for (const el of node.elements) {
      if (ts.isSpreadElement(el)) return null;
      const value = resolveLiteral(el as ts.Expression, sf, aliases, depth + 1);
      if (value === null) return null;
      out.push(value);
    }
    return out;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (ts.isShorthandPropertyAssignment(prop)) {
        // { brand } means { brand: brand } — resolve the identifier like a value.
        const value = resolveLiteral(prop.name, sf, aliases, depth + 1);
        if (value === null) return null;
        out[prop.name.text] = value;
        continue;
      }
      if (!ts.isPropertyAssignment(prop)) return null;
      const key = propertyName(prop.name);
      if (!key) return null;
      const value = resolveLiteral(prop.initializer, sf, aliases, depth + 1);
      if (value === null) return null;
      out[key] = value;
    }
    return out;
  }
  if (ts.isIdentifier(node)) {
    const alias = aliases.get(node.text);
    return alias ? resolveLiteral(alias, sf, aliases, depth + 1) : null;
  }
  return null;
}

/** Loose resolver: returns the literal value or null, and records unresolvable leaves. */
function looseResolve(node: ts.Expression, sf: ts.SourceFile, aliases: Map<string, ts.Expression>, path: string, unresolved: UnresolvedEntry[], file: string): unknown {
  const value = resolveLiteral(node, sf, aliases, 0);
  if (value !== null) return value;
  if (ts.isObjectLiteralExpression(node)) {
    const out: Record<string, unknown> = {};
    for (const prop of node.properties) {
      if (ts.isShorthandPropertyAssignment(prop)) {
        const key = prop.name.text;
        const childPath = path ? `${path}.${key}` : key;
        const child = resolveLiteral(prop.name, sf, aliases, 0);
        if (child === null) {
          unresolved.push({ file, key: childPath, reason: "shorthand reference not statically resolvable" });
          continue;
        }
        out[key] = child;
        continue;
      }
      if (!ts.isPropertyAssignment(prop)) {
        unresolved.push({ file, key: path || "(spread)", reason: "spread or method — not a literal" });
        continue;
      }
      const key = propertyName(prop.name);
      if (!key) {
        unresolved.push({ file, key: path || "(computed)", reason: "computed property name" });
        continue;
      }
      const childPath = path ? `${path}.${key}` : key;
      const child = looseResolve(prop.initializer, sf, aliases, childPath, unresolved, file);
      if (child !== null) out[key] = child;
    }
    return out;
  }
  if (ts.isIdentifier(node)) {
    unresolved.push({ file, key: path || node.text, reason: `reference to '${node.text}' is not a literal (or is defined outside the file)` });
    return null;
  }
  if (ts.isCallExpression(node)) {
    unresolved.push({ file, key: path || "(call)", reason: "function call — code cannot be executed" });
    return null;
  }
  if (ts.isTemplateExpression(node)) {
    unresolved.push({ file, key: path || "(template)", reason: "template literal with expressions" });
    return null;
  }
  if (ts.isPropertyAccessExpression(node)) {
    unresolved.push({ file, key: path || `${node.getText(sf)}`, reason: "property access — not a literal" });
    return null;
  }
  unresolved.push({ file, key: path || "(expression)", reason: "not statically resolvable" });
  return null;
}

function findExportedObjectLiteral(sf: ts.SourceFile): ts.ObjectLiteralExpression | null {
  let found: ts.ObjectLiteralExpression | null = null;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isExportAssignment(node) && !node.isExportEquals && ts.isObjectLiteralExpression(node.expression)) {
      found = node.expression;
      return;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === "module" &&
      node.left.name.text === "exports" &&
      ts.isObjectLiteralExpression(node.right)
    ) {
      found = node.right;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

export interface ParsedConfig {
  theme: Record<string, unknown>;
  unresolved: UnresolvedEntry[];
}

/** Parses a tailwind-style config. Returns the `theme` object plus per-leaf unresolved entries. */
export async function parseStaticConfig(file: string, projectRoot: string): Promise<ParsedConfig> {
  const rel = relOf(projectRoot, file);
  const unresolved: UnresolvedEntry[] = [];

  let text: string | null = null;
  try {
    const stats = await fs.stat(file);
    if (stats.size <= MAX_FILE_BYTES) text = await fs.readFile(file, "utf-8");
  } catch {
    text = null;
  }
  if (text === null) {
    unresolved.push({ file: rel, key: "(file)", reason: "missing, unreadable, or over the 512 KB limit" });
    return { theme: {}, unresolved };
  }
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const aliases = collectAliases(sf);
  const root = findExportedObjectLiteral(sf);
  if (!root) {
    unresolved.push({ file: rel, key: "(exports)", reason: "no top-level object export found" });
    return { theme: {}, unresolved };
  }
  const value = looseResolve(root, sf, aliases, "", unresolved, rel);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    unresolved.push({ file: rel, key: "(exports)", reason: "the exported object is not statically resolvable" });
    return { theme: {}, unresolved };
  }
  const theme = (value as Record<string, unknown>)["theme"];
  return {
    theme: theme && typeof theme === "object" && !Array.isArray(theme) ? (theme as Record<string, unknown>) : {},
    unresolved,
  };
}
