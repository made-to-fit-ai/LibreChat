import { Constants, ContentTypes } from 'librechat-data-provider';
import type { Agents, MCPTool, TMessage } from 'librechat-data-provider';

/** Tool metadata the friendly card renders; a subset of the MCP catalog entry. */
export type FriendlyToolInfo = Pick<
  MCPTool,
  'title' | 'description' | 'annotations' | 'parameters'
>;

export interface ArgumentRow {
  key: string;
  label: string;
  /** Display text; `kind` picks the rendering (monospace for ids and JSON). */
  value: string;
  kind: 'text' | 'code' | 'empty';
}

const DRAFT_PREVIEW_KEYS = [
  'title',
  'subject',
  'to_name',
  'contact',
  'description',
  'amount',
  'due_date',
] as const;

export type DraftPreviewKey = (typeof DRAFT_PREVIEW_KEYS)[number];

export interface DraftPreview {
  draftId: string;
  /** Name of the tool whose result produced the draft, with the MCP suffix removed. */
  toolName: string;
  fields: Array<{ key: DraftPreviewKey; value: string }>;
}

const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
/** Longest string shown inline before the row wraps into a block. */
const MAX_INLINE_CHARS = 120;

/** Strip the `_mcp_<server>` suffix LibreChat appends to MCP tool names at runtime. */
export function stripMCPSuffix(name: string): string {
  const index = name.lastIndexOf(Constants.mcp_delimiter);
  return index > 0 ? name.slice(0, index) : name;
}

/** `email_send_client_email_mcp_workbench` becomes `Email send client email`. */
export function humaniseToolName(name: string): string {
  const words = stripMCPSuffix(name)
    .split(/[_\s]+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return name;
  }
  const [first, ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest.map((w) => w.toLowerCase())].join(
    ' ',
  );
}

/** Prefer the MCP title, then the annotation title, then a humanised runtime name. */
export function friendlyToolTitle(name: string, info?: FriendlyToolInfo): string {
  const title = info?.title?.trim() || info?.annotations?.title?.trim();
  return title && title.length > 0 ? title : humaniseToolName(name);
}

/** Whether approving the call sends something out: a `send` word in the runtime name or title. */
export function isSendTool(name: string, info?: FriendlyToolInfo): boolean {
  const words = `${stripMCPSuffix(name)} ${info?.title ?? ''} ${info?.annotations?.title ?? ''}`;
  return words
    .toLowerCase()
    .split(/[_\s]+/)
    .includes('send');
}

/** Field name with underscores as spaces and a capital first letter. */
export function humaniseFieldName(key: string): string {
  const spaced = key.replace(/[_\s]+/g, ' ').trim();
  return spaced.length === 0 ? key : spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A schema `title` names the field for people; descriptions are written for the model,
 *  so they are not used as labels. Without a title the field name is humanised. */
function fieldLabel(key: string, info?: FriendlyToolInfo): string {
  const title = info?.parameters?.properties?.[key]?.title?.trim();
  return title && title.length > 0 ? title : humaniseFieldName(key);
}

function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const options: Intl.DateTimeFormatOptions =
    value.length === 10
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' };
  return date.toLocaleString('en-AU', options);
}

/** Render one argument value for a non-technical reader. */
export function formatArgumentValue(
  value: unknown,
  labels: { yes: string; no: string; none: string },
): Pick<ArgumentRow, 'value' | 'kind'> {
  if (value === null || value === undefined) {
    return { value: labels.none, kind: 'empty' };
  }
  if (typeof value === 'boolean') {
    return { value: value ? labels.yes : labels.no, kind: 'text' };
  }
  if (typeof value === 'number') {
    return { value: value.toLocaleString('en-AU'), kind: 'text' };
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return { value: labels.none, kind: 'empty' };
    }
    if (ISO_DATE.test(trimmed)) {
      return { value: formatDate(trimmed), kind: 'text' };
    }
    /** Short tokens without spaces are ids, references or codes: keep them exact. */
    if (trimmed.length <= 64 && !/\s/.test(trimmed) && /[\d_-]/.test(trimmed)) {
      return { value: trimmed, kind: 'code' };
    }
    return { value, kind: 'text' };
  }
  try {
    return { value: JSON.stringify(value), kind: 'code' };
  } catch {
    return { value: String(value), kind: 'code' };
  }
}

export function parseArguments(
  args: Agents.ToolApprovalRequest['arguments'] | undefined,
): Record<string, unknown> | undefined {
  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    return args;
  }
  if (typeof args !== 'string') {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(args);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Arguments as label and value rows, labelled from the tool's input schema when present. */
export function buildArgumentRows(
  args: Agents.ToolApprovalRequest['arguments'] | undefined,
  info: FriendlyToolInfo | undefined,
  labels: { yes: string; no: string; none: string },
): ArgumentRow[] {
  const parsed = parseArguments(args);
  if (parsed == null) {
    return [];
  }
  return Object.entries(parsed)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      label: fieldLabel(key, info),
      ...formatArgumentValue(value, labels),
    }));
}

/** Whether a long text value should wrap in its own block rather than sit beside the label. */
export function isLongValue(row: ArgumentRow): boolean {
  return row.kind === 'text' && (row.value.length > MAX_INLINE_CHARS || row.value.includes('\n'));
}

/** Parse a tool result that is JSON, or JSON wrapped in other text. */
export function parseToolOutput(output: unknown): Record<string, unknown> | undefined {
  if (typeof output === 'object' && output !== null && !Array.isArray(output)) {
    return output as Record<string, unknown>;
  }
  if (typeof output !== 'string') {
    return undefined;
  }
  const attempt = (text: string): Record<string, unknown> | undefined => {
    try {
      const parsed: unknown = JSON.parse(text);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined;
    } catch {
      return undefined;
    }
  };
  const direct = attempt(output);
  if (direct) {
    return direct;
  }
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  return start >= 0 && end > start ? attempt(output.slice(start, end + 1)) : undefined;
}

/** Tools whose result carries the draft a later send or approve call refers to. */
export function isDraftProducingTool(name: string): boolean {
  /** LibreChat strips a leading `<server>_` from MCP tool names, so `email_draft_client_email`
   *  on server `email` arrives as `draft_client_email`. */
  const bare = stripMCPSuffix(name);
  return (
    bare.startsWith('draft_') ||
    bare.includes('_draft_') ||
    bare === 'get_draft' ||
    bare.endsWith('_get_draft')
  );
}

function draftIdOf(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return undefined;
}

function previewField(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    return ISO_DATE.test(trimmed) ? formatDate(trimmed) : value;
  }
  if (typeof value === 'number') {
    return value.toLocaleString('en-AU');
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

/**
 * Find the most recent draft tool result in the conversation whose `data.draft_id`
 * matches, and return its reviewer-facing fields. Scans `message.content` parts of
 * type `tool_call` and reads their `output`.
 */
export function findDraftPreview(
  messages: TMessage[] | undefined,
  draftId: unknown,
): DraftPreview | undefined {
  const wanted = draftIdOf(draftId);
  if (!wanted || !messages?.length) {
    return undefined;
  }
  for (let m = messages.length - 1; m >= 0; m -= 1) {
    const content = messages[m]?.content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (let p = content.length - 1; p >= 0; p -= 1) {
      const part = content[p];
      if (part?.type !== ContentTypes.TOOL_CALL) {
        continue;
      }
      const toolCall = (part as { tool_call?: Agents.ToolCall }).tool_call;
      if (toolCall?.name == null || !isDraftProducingTool(toolCall.name)) {
        continue;
      }
      const parsed = parseToolOutput(toolCall.output);
      const data = parsed?.data;
      if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        continue;
      }
      /** A batch tool lists its drafts in an array (e.g. `data.rows`), one record each. */
      const candidates = [data, ...Object.values(data).flatMap((v) => (Array.isArray(v) ? v : []))];
      const record = candidates.find(
        (c): c is Record<string, unknown> =>
          typeof c === 'object' &&
          c !== null &&
          draftIdOf((c as Record<string, unknown>).draft_id) === wanted,
      );
      if (record == null) {
        continue;
      }
      const fields: DraftPreview['fields'] = [];
      for (const key of DRAFT_PREVIEW_KEYS) {
        const value = previewField(record[key]);
        if (value !== undefined) {
          fields.push({ key, value });
        }
      }
      return { draftId: wanted, toolName: stripMCPSuffix(toolCall.name), fields };
    }
  }
  return undefined;
}

/** Index the MCP tools catalog by runtime name (`<tool>_mcp_<server>`). */
export function indexFriendlyTools(
  servers: Record<string, { tools?: MCPTool[] }> | undefined,
): Map<string, FriendlyToolInfo> {
  const index = new Map<string, FriendlyToolInfo>();
  if (!servers) {
    return index;
  }
  for (const server of Object.values(servers)) {
    for (const tool of server.tools ?? []) {
      index.set(tool.pluginKey, {
        title: tool.title,
        description: tool.description,
        annotations: tool.annotations,
        parameters: tool.parameters,
      });
    }
  }
  return index;
}
