import { GitBranchPlus } from 'lucide-react';
import type { TMessage } from 'librechat-data-provider';
import MessageTimestamp from '~/components/Chat/Messages/ui/MessageTimestamp';
import { useMessagePartsHost } from '~/Providers/MessagePartsHostContext';
import { useBranchMessageMutation } from '~/data-provider/Messages';
import MessageIcon from '~/components/Share/MessageIcon';
import { useLocalize } from '~/hooks';
import useSpeaker from './speaker';
import { cn } from '~/utils';

type SiblingHeaderProps = {
  /** The agentId from the content part (could be real agent ID or endpoint__model format) */
  agentId?: string;
  /** The messageId of the parent message */
  messageId?: string;
  /** ISO timestamp of the parent message */
  createdAt?: string | null;
  /** The conversationId */
  conversationId?: string | null;
  /** Whether a submission is in progress */
  isSubmitting?: boolean;
};

/**
 * Header component for sibling content parts in parallel agent responses.
 * Displays the agent/model icon and name for each parallel response.
 */
export default function SiblingHeader({
  agentId,
  messageId,
  createdAt,
  conversationId,
  isSubmitting,
}: SiblingHeaderProps) {
  const localize = useLocalize();
  const showToast = useMessagePartsHost().useToast();

  const branchMessage = useBranchMessageMutation(conversationId ?? null, {
    onSuccess: () => {
      showToast({
        message: localize('com_ui_branch_created'),
        status: 'success',
      });
    },
    onError: () => {
      showToast({
        message: localize('com_ui_branch_error'),
        status: 'error',
      });
    },
  });

  const handleBranch = () => {
    if (!messageId || !agentId || isSubmitting || branchMessage.isLoading) {
      return;
    }
    branchMessage.mutate({ messageId, agentId });
  };

  const {
    name: displayName,
    endpoint: displayEndpoint,
    model: displayModel,
    agent,
  } = useSpeaker(agentId);

  return (
    <div className="border-border-light mb-2 flex items-center justify-between gap-2 border-b pb-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
          <MessageIcon
            message={
              {
                endpoint: displayEndpoint,
                model: displayModel,
                isCreatedByUser: false,
              } as TMessage
            }
            agent={agent || undefined}
          />
        </div>
        <span className="text-text-primary truncate text-sm font-medium">{displayName}</span>
        <MessageTimestamp value={createdAt} />
      </div>
      <button
        type="button"
        onClick={handleBranch}
        disabled={!messageId || !agentId || isSubmitting || branchMessage.isLoading}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          'text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors',
          'focus:ring-border-medium focus:ring-2 focus:ring-offset-1 focus:outline-hidden',
          'disabled:cursor-not-allowed disabled:opacity-50',
          (!messageId || !agentId || isSubmitting) && 'invisible',
        )}
        aria-label={localize('com_ui_branch_message')}
        title={localize('com_ui_branch_message')}
      >
        <GitBranchPlus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
