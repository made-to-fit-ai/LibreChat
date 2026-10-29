import { useId, useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { FriendlyToolInfo } from '~/components/Chat/approval/friendly';
import { buildArgumentRows, isLongValue } from '~/components/Chat/approval/friendly';
import { useLocalize, useExpandCollapse } from '~/hooks';
import { OutputRenderer } from './ToolOutput';
import { hasToolParams } from './params';
import { cn } from '~/utils';

function isSimpleObject(obj: unknown): obj is Record<string, string | number | boolean | null> {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return false;
  }
  const entries = Object.entries(obj);
  if (entries.length === 0 || entries.length > 8) {
    return false;
  }
  return entries.every(
    ([, v]) =>
      v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
  );
}

function KeyValueInput({ data }: { data: Record<string, string | number | boolean | null> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-1.5">
          <span className="text-text-secondary font-medium">{key}</span>
          <span className="bg-surface-tertiary text-text-primary rounded px-1.5 py-0.5">
            {String(value ?? 'null')}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatParamValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.length > 200 ? value.slice(0, 200) + '...' : value;
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  const str = JSON.stringify(value);
  return str.length > 200 ? str.slice(0, 200) + '...' : str;
}

function ComplexInput({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-1.5">
          <span className="text-text-secondary font-medium">{key}</span>
          <span className="bg-surface-tertiary text-text-primary max-w-[18.75rem] truncate overflow-hidden rounded px-1.5 py-0.5 font-mono">
            {formatParamValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function InputRenderer({ input }: { input: string }) {
  if (!input || input.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(input);
    if (isSimpleObject(parsed)) {
      return <KeyValueInput data={parsed} />;
    }
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return <ComplexInput data={parsed as Record<string, unknown>} />;
    }
    // Valid JSON but not a plain object (array, string, number, boolean) — render formatted
    return (
      <pre dir="ltr" className="text-text-primary text-xs whitespace-pre-wrap">
        {typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    // Not JSON — render as plain text
    return (
      <pre dir="ltr" className="text-text-primary text-xs whitespace-pre-wrap">
        {input}
      </pre>
    );
  }
}

/** How a plain-mode panel names the call: read-only lookups, sends, and anything else. */
export type ToolCallWording = 'lookup' | 'send' | 'action';

const WORDING_HEADINGS = {
  lookup: 'com_ui_tool_looked_up',
  send: 'com_ui_tool_sent',
  action: 'com_ui_details',
} as const;

/** `interface.plainToolDetails`: the arguments as labelled rows, for readers who don't read
 *  JSON. A lookup's raw output sits behind a disclosure; a write's output is its confirmation,
 *  and a failure is the fact the reader needs, so both stay inline. */
function PlainToolCallInfo({
  input,
  output,
  info,
  wording,
  failed,
}: {
  input: string;
  output?: string | null;
  info?: FriendlyToolInfo;
  wording: ToolCallWording;
  failed: boolean;
}) {
  const localize = useLocalize();
  const rawId = useId();
  const [showRaw, setShowRaw] = useState(false);
  const rows = useMemo(
    () =>
      buildArgumentRows(input, info, {
        yes: localize('com_ui_yes'),
        no: localize('com_ui_no'),
        none: localize('com_ui_approval_value_none'),
      }),
    [input, info, localize],
  );
  const collapseOutput = wording === 'lookup' && !failed;

  return (
    <div className="w-full space-y-2 px-3 py-3.5 text-xs">
      {rows.length > 0 && (
        <div>
          <p className="text-text-secondary mb-1 font-medium">
            {localize(WORDING_HEADINGS[wording])}
          </p>
          <dl className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1">
            {rows.map((row) => (
              <div key={row.key} className="contents">
                <dt className="text-text-secondary-alt">{row.label}</dt>
                <dd
                  className={cn(
                    'text-text-primary [overflow-wrap:anywhere]',
                    isLongValue(row) && 'whitespace-pre-wrap',
                    row.kind === 'code' && 'font-mono',
                    row.kind === 'empty' && 'text-text-secondary-alt italic',
                  )}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {rows.length === 0 && <InputRenderer input={input} />}
      {output && !collapseOutput && <OutputRenderer text={output} />}
      {output && collapseOutput && (
        <div>
          <button
            type="button"
            className={cn(
              'text-text-secondary inline-flex items-center gap-1',
              'focus-visible:ring-focus-subtle focus-visible:ring-2 focus-visible:outline-hidden',
            )}
            onClick={() => setShowRaw((prev) => !prev)}
            aria-expanded={showRaw}
            aria-controls={rawId}
          >
            <span>{localize('com_ui_tool_show_raw')}</span>
            <ChevronDown
              className={cn(
                'size-3 shrink-0 transition-transform duration-200 ease-out',
                showRaw && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
          <div id={rawId} className="pt-1" hidden={!showRaw}>
            {showRaw && <OutputRenderer text={output} />}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ToolCallInfo({
  input,
  output,
  wording,
  failed = false,
  info,
}: {
  input: string;
  output?: string | null;
  /** Set when `interface.plainToolDetails` is on for an MCP call. */
  wording?: ToolCallWording;
  failed?: boolean;
  info?: FriendlyToolInfo;
}) {
  if (wording != null) {
    return (
      <PlainToolCallInfo
        input={input}
        output={output}
        info={info}
        wording={wording}
        failed={failed}
      />
    );
  }
  return <DefaultToolCallInfo input={input} output={output} />;
}

function DefaultToolCallInfo({ input, output }: { input: string; output?: string | null }) {
  const localize = useLocalize();
  const [showParams, setShowParams] = useState(false);
  const { style: paramsExpandStyle, ref: paramsExpandRef } = useExpandCollapse(showParams);

  const hasParams = useMemo(() => hasToolParams(input), [input]);

  return (
    <div className="w-full px-3 py-3.5">
      {output && <OutputRenderer text={output} />}
      {output && hasParams && <div className="border-border-inset my-2 border-t" />}
      {hasParams && (
        <>
          <button
            type="button"
            className={cn(
              'text-text-secondary inline-flex items-center gap-1 text-xs',
              'focus-visible:ring-focus-subtle focus-visible:ring-2 focus-visible:outline-hidden',
            )}
            onClick={() => setShowParams((prev) => !prev)}
            aria-expanded={showParams}
          >
            <span>{localize('com_ui_parameters')}</span>
            <ChevronDown
              className={cn(
                'size-3 shrink-0 transition-transform duration-200 ease-out',
                showParams && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
          <div style={paramsExpandStyle}>
            <div className="overflow-hidden pt-1" ref={paramsExpandRef}>
              <InputRenderer input={input} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
