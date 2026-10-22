import { useMemo, useState } from 'react';
import { QueryKeys } from 'librechat-data-provider';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import type { Agents, TMessage } from 'librechat-data-provider';
import type { DraftPreviewKey, FriendlyToolInfo } from '~/components/Chat/approval/friendly';
import type { TranslationKeys } from '~/hooks';
import {
  buildArgumentRows,
  findDraftPreview,
  friendlyToolTitle,
  isLongValue,
  parseArguments,
} from '~/components/Chat/approval/friendly';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const FIELD_LABELS: Record<DraftPreviewKey, TranslationKeys> = {
  title: 'com_ui_approval_field_title',
  subject: 'com_ui_approval_field_subject',
  to_name: 'com_ui_approval_field_to_name',
  contact: 'com_ui_approval_field_contact',
  description: 'com_ui_approval_field_description',
  amount: 'com_ui_approval_field_amount',
  due_date: 'com_ui_approval_field_due_date',
};

/**
 * The review card body for non-technical reviewers: what the action is in plain
 * words, what will be sent, and the remaining inputs as a labelled list. The
 * runtime name and raw arguments stay behind "Details".
 */
export default function FriendlyReview({
  conversationId,
  request,
  info,
  heading,
  reason,
}: {
  conversationId: string;
  request: Agents.ToolApprovalRequest;
  info?: FriendlyToolInfo;
  /** Prefix for numbered batches, e.g. "2. ". */
  heading?: string;
  /** The policy reason shown on the card, when the deployment sets one. */
  reason?: string;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const title = friendlyToolTitle(request.name, info);
  /** Tool descriptions are written for the model; the first sentence is the plain summary. */
  const summary = info?.description?.trim().split(/(?<=[.!?])\s+/)[0];

  const { draft, rows, raw } = useMemo(() => {
    const args = parseArguments(request.arguments);
    const messages = queryClient.getQueryData<TMessage[]>([QueryKeys.messages, conversationId]);
    const draft = args?.draft_id != null ? findDraftPreview(messages, args.draft_id) : undefined;
    const labels = {
      yes: localize('com_ui_yes'),
      no: localize('com_ui_no'),
      none: localize('com_ui_approval_value_none'),
    };
    /** When the draft is previewed, its id is noise for the reader. */
    const rows = buildArgumentRows(request.arguments, info, labels).filter(
      (row) => !(draft != null && row.key === 'draft_id'),
    );
    const raw =
      typeof request.arguments === 'string'
        ? request.arguments
        : JSON.stringify(request.arguments ?? {}, null, 2);
    return { draft, rows, raw };
  }, [conversationId, info, localize, queryClient, request.arguments]);

  const args = parseArguments(request.arguments);
  const missingDraft = args?.draft_id != null && draft == null;

  return (
    <div className="mb-3 space-y-3">
      <div>
        <h3
          id={`approval-${request.tool_call_id}`}
          className="text-text-primary text-base font-semibold [overflow-wrap:anywhere]"
        >
          {heading}
          {title}
        </h3>
        {summary && <p className="text-text-secondary mt-0.5 text-sm">{summary}</p>}
      </div>

      {draft != null && draft.fields.length > 0 && (
        <div className="border-border-light bg-surface-primary rounded-lg border p-3">
          <p className="text-text-secondary mb-2 text-xs font-medium tracking-wide uppercase">
            {localize('com_ui_approval_what_will_be_sent')}
          </p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
            {draft.fields.map(({ key, value }) => (
              <div key={key} className="contents">
                <dt className="text-text-secondary">{localize(FIELD_LABELS[key])}</dt>
                <dd
                  className={cn(
                    'text-text-primary [overflow-wrap:anywhere]',
                    (key === 'title' || key === 'subject') && 'font-medium',
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {missingDraft && (
        <p className="text-text-secondary text-sm">
          {localize('com_ui_approval_draft_not_found', { 0: String(args?.draft_id) })}
        </p>
      )}

      {rows.length > 0 && (
        <dl className="space-y-1.5 text-sm">
          {rows.map((row) =>
            isLongValue(row) ? (
              <div key={row.key}>
                <dt className="text-text-secondary">{row.label}</dt>
                <dd className="text-text-primary mt-0.5 [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {row.value}
                </dd>
              </div>
            ) : (
              <div key={row.key} className="flex flex-wrap gap-x-3">
                <dt className="text-text-secondary">{row.label}</dt>
                <dd
                  className={cn(
                    'text-text-primary [overflow-wrap:anywhere]',
                    row.kind === 'code' && 'font-mono text-xs leading-5',
                    row.kind === 'empty' && 'text-text-secondary italic',
                  )}
                >
                  {row.value}
                </dd>
              </div>
            ),
          )}
        </dl>
      )}

      <p className="text-text-secondary flex items-center gap-1.5 text-sm">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        {reason?.trim() || localize('com_ui_approval_nothing_sent')}
      </p>

      <div>
        <button
          type="button"
          className="text-text-secondary hover:text-text-primary inline-flex items-center gap-1 text-xs"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          )}
          {localize('com_ui_details')}
        </button>
        {detailsOpen && (
          <div className="mt-1.5 space-y-1.5">
            <p className="text-text-secondary text-xs">
              {localize('com_ui_approval_technical_name')}:{' '}
              <span className="font-mono">{request.name}</span>
            </p>
            <pre className="border-border-light bg-surface-tertiary text-text-primary max-h-40 overflow-auto rounded-lg border p-2 font-mono text-xs break-words whitespace-pre-wrap">
              {raw}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
