import { Range } from "./ast";
import { DiagnosticCode, diagnosticCodeToString } from "./diagnosticMessages.generated";
import { CharCode, isLineBreak } from "./util/charcode";
import { sb } from "./util/sb";

export { DiagnosticCode, diagnosticCodeToString } from "./diagnosticMessages.generated";

export enum DiagnosticCategory {
  INFO,
  WARNING,
  ERROR
}

export function diagnosticCategoryToString(category: DiagnosticCategory): string {
  switch (category) {
    case DiagnosticCategory.INFO: return "INFO";
    case DiagnosticCategory.WARNING: return "WARNING";
    case DiagnosticCategory.ERROR: return "ERROR";
    default: return "";
  }
}

const colorBlue: string = "\u001b[93m";
const colorYellow: string = "\u001b[93m";
const colorRed: string = "\u001b[91m";
const colorReset: string = "\u001b[0m";

export function diagnosticCategoryToColor(category: DiagnosticCategory): string {
  switch (category) {
    case DiagnosticCategory.INFO: return colorBlue;
    case DiagnosticCategory.WARNING: return colorYellow;
    case DiagnosticCategory.ERROR: return colorRed;
    default: return "";
  }
}

export class DiagnosticMessage {

  code: i32;
  category: DiagnosticCategory;
  message: string;
  range: Range | null = null;

  constructor(code: i32, category: DiagnosticCategory, message: string) {
    this.code = code;
    this.category = category;
    this.message = message;
  }

  static create(code: DiagnosticCode, category: DiagnosticCategory, arg0: string | null = null, arg1: string | null = null): DiagnosticMessage {
    let message: string = diagnosticCodeToString(code);
    if (arg0 != null)
      message = message.replace("{0}", arg0);
    if (arg1 != null)
      message = message.replace("{1}", arg1);
    return new DiagnosticMessage(code, category, message);
  }

  static createInfo(code: DiagnosticCode, arg0: string | null = null, arg1: string | null = null): DiagnosticMessage {
    return DiagnosticMessage.create(code, DiagnosticCategory.INFO, arg0, arg1);
  }

  static createWarning(code: DiagnosticCode, arg0: string | null = null, arg1: string | null = null): DiagnosticMessage {
    return DiagnosticMessage.create(code, DiagnosticCategory.WARNING, arg0, arg1);
  }

  static createError(code: DiagnosticCode, arg0: string | null = null, arg1: string | null = null): DiagnosticMessage {
    return DiagnosticMessage.create(code, DiagnosticCategory.ERROR, arg0, arg1);
  }

  withRange(range: Range): this {
    this.range = range;
    return this;
  }

  toString(): string {
    if (this.range)
      return diagnosticCategoryToString(this.category) + " " + this.code + ": \"" + this.message + "\" in " + this.range.source.path + " @ " + this.range.start + "," + this.range.end;
    return diagnosticCategoryToString(this.category) + " " + this.code + ": " + this.message;
  }
}

export function formatDiagnosticMessage(message: DiagnosticMessage, useColors: bool = false, showContext: bool = false): string {
  // format context first (uses same string builder)
  let context: string = "";
  if (message.range && showContext)
    context = formatDiagnosticContext(message.range, useColors)

  // general information
  sb.length = 0;
  if (useColors) sb.push(diagnosticCategoryToColor(message.category));
  sb.push(diagnosticCategoryToString(message.category));
  if (useColors) sb.push(colorReset);
  sb.push(" AS");
  sb.push(message.code.toString(10));
  sb.push(": ");
  sb.push(message.message);

  // range information if available
  if (message.range) {
    const range: Range = message.range;
    const text: string = range.source.text;
    if (showContext) {
      sb.push("\n");
      sb.push(context);
    }
    sb.push("\n");
    let pos: i32 = range.start;
    let line: i32 = 1;
    let column: i32 = 1;
    while (pos-- > 0)
      if (text.charCodeAt(pos) == CharCode.LINEFEED)
        line++;
      else if (line == 1)
        column++;
    sb.push(" in ");
    sb.push(range.source.path);
    sb.push("(");
    sb.push(line.toString(10));
    sb.push(",");
    sb.push(column.toString(10));
    sb.push(")");
  }
  return sb.join("");
}

export function formatDiagnosticContext(range: Range, useColors: bool = false): string {
  const text: string = range.source.text;
  const len: i32 = text.length;
  let start: i32 = range.start;
  let end: i32 = range.end;
  while (start > 0 && !isLineBreak(text.charCodeAt(start - 1)))
    start--;
  while (end < len && !isLineBreak(text.charCodeAt(end)))
    end++;
  sb.length = 0;
  sb.push("\n ");
  sb.push(text.substring(start, end));
  sb.push("\n ");
  while (start < range.start) {
    sb.push(" ");
    start++;
  }
  if (useColors) sb.push(colorRed);
  if (range.start == range.end) {
    sb.push("^");
  } else while (start++ < range.end)
    sb.push("~");
  if (useColors) sb.push(colorReset);
  return sb.join("");
}

export abstract class DiagnosticEmitter {

  diagnostics: DiagnosticMessage[];
  silentDiagnostics: bool = false;

  constructor(diagnostics: DiagnosticMessage[] | null = null) {
    this.diagnostics = diagnostics ? <DiagnosticMessage[]>diagnostics : new Array();
  }

  emitDiagnostic(code: DiagnosticCode, category: DiagnosticCategory, range: Range, arg0: string | null = null, arg1: string | null = null) {
    const message: DiagnosticMessage = DiagnosticMessage.create(code, category, arg0, arg1).withRange(range);
    this.diagnostics.push(message);
    if (!this.silentDiagnostics) {
      console.log(formatDiagnosticMessage(message, true, true) + "\n"); // temporary
      console.log(<string>new Error("stack").stack);
    }
  }

  error(code: DiagnosticCode, range: Range, arg0: string | null = null, arg1: string | null = null): void {
    this.emitDiagnostic(code, DiagnosticCategory.ERROR, range, arg0, arg1);
  }

  info(code: DiagnosticCode, range: Range, arg0: string | null = null, arg1: string | null = null): void {
    this.emitDiagnostic(code, DiagnosticCategory.INFO, range, arg0, arg1);
  }

  warning(code: DiagnosticCode, range: Range, arg0: string | null = null, arg1: string | null = null): void {
    this.emitDiagnostic(code, DiagnosticCategory.WARNING, range, arg0, arg1);
  }
}
