import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

export type UnsafeLog = {
  file: string;
  line: number;
  reason: string;
};

const consoleMethods = new Set(["debug", "error", "info", "log", "warn"]);
const privateNames =
  /^(?:body|content|email|emailAddress|medicalConditions|name|notes|paymentLink|phone|recipient|recipients|recipientAddress|responses|token|to)$/i;
const errorNames = /^(?:e|err|error|exception)$/i;
const approvedMetadataNames = new Set([
  "duration",
  "event",
  "eventCount",
  "method",
  "path",
  "status",
  "statusCode",
]);

function propertyName(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
    return node.text;
  }
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
}

function unsafeReason(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node)) {
    if (errorNames.test(node.text)) return "raw error object";
    if (privateNames.test(node.text)) return `private field "${node.text}"`;
  }

  if (ts.isPropertyAccessExpression(node)) {
    const name = node.name.text;
    if (privateNames.test(name)) return `private field "${name}"`;
  }

  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const name = propertyName(node.argumentExpression);
    if (name && privateNames.test(name)) return `private field "${name}"`;
  }

  if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
    const name = propertyName(node.name);
    if (name && privateNames.test(name)) return `private field "${name}"`;
  }

  let reason: string | undefined;
  node.forEachChild((child) => {
    reason ??= unsafeReason(child);
  });
  return reason;
}

function isApprovedMetadata(node: ts.Expression): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }
  if (ts.isIdentifier(node)) {
    return approvedMetadataNames.has(node.text);
  }
  if (ts.isPropertyAccessExpression(node)) {
    return approvedMetadataNames.has(node.name.text);
  }
  if (ts.isElementAccessExpression(node) && node.argumentExpression) {
    const name = propertyName(node.argumentExpression);
    return Boolean(name && approvedMetadataNames.has(name));
  }
  if (ts.isTemplateExpression(node)) {
    return node.templateSpans.every((span) => isApprovedMetadata(span.expression));
  }
  if (ts.isParenthesizedExpression(node)) {
    return isApprovedMetadata(node.expression);
  }
  return false;
}

function isConsoleCall(node: ts.CallExpression): boolean {
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === "console" &&
    consoleMethods.has(node.expression.name.text)
  );
}

function isIdentifier(node: ts.Node | undefined, name: string): boolean {
  return Boolean(node && ts.isIdentifier(node) && node.text === name);
}

function matchesTemplate(
  node: ts.Expression,
  head: string,
  expressions: string[],
  tails: string[],
): boolean {
  return (
    ts.isTemplateExpression(node) &&
    node.head.text === head &&
    node.templateSpans.length === expressions.length &&
    node.templateSpans.every(
      (span, index) =>
        isIdentifier(span.expression, expressions[index]) &&
        span.literal.text === tails[index],
    )
  );
}

function isApprovedSafeLoggerCall(
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
): boolean {
  if (
    sourceFile.fileName.endsWith("server/safe-logging.ts") &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "error" &&
    node.arguments.length === 2 &&
    matchesTemplate(node.arguments[0], "", ["context"], [":"]) &&
    ts.isCallExpression(node.arguments[1]) &&
    isIdentifier(node.arguments[1].expression, "getSafeErrorSummary") &&
    node.arguments[1].arguments.length === 1 &&
    isIdentifier(node.arguments[1].arguments[0], "error")
  ) {
    return true;
  }

  return (
    sourceFile.fileName.endsWith("server/index.ts") &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "log" &&
    node.arguments.length === 1 &&
    matchesTemplate(
      node.arguments[0],
      "",
      ["formattedTime", "source", "message"],
      [" [", "] ", ""],
    )
  );
}

export function findUnsafeServerLogs(
  source: string,
  file = "server/unknown.ts",
): UnsafeLog[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".js") ? ts.ScriptKind.JS : ts.ScriptKind.TS,
  );
  const findings: UnsafeLog[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      isConsoleCall(node) &&
      !isApprovedSafeLoggerCall(node, sourceFile)
    ) {
      for (const argument of node.arguments) {
        const reason =
          unsafeReason(argument) ??
          (isApprovedMetadata(argument)
            ? undefined
            : "unapproved dynamic value; use the shared safe logger");
        if (reason) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          findings.push({ file, line: line + 1, reason });
          break;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

async function serverSourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return serverSourceFiles(file);
      if (
        entry.isFile() &&
        /\.[cm]?[jt]sx?$/.test(entry.name) &&
        !/\.test\.[cm]?[jt]sx?$/.test(entry.name)
      ) {
        return [file];
      }
      return [];
    }),
  );
  return nested.flat();
}

export async function checkServerLogs(directory = "server"): Promise<UnsafeLog[]> {
  const files = await serverSourceFiles(directory);
  const findings = await Promise.all(
    files.map(async (file) =>
      findUnsafeServerLogs(await readFile(file, "utf8"), file),
    ),
  );
  return findings.flat();
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  const findings = await checkServerLogs();
  if (findings.length) {
    console.error("Unsafe server logging detected:");
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line}: ${finding.reason}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Server logging safety check passed.");
  }
}