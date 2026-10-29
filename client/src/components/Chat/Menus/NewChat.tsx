import { TooltipAnchor, NewChatIcon, Button } from '@librechat/client';
import type { MouseEvent } from 'react';
import { useShortcutAriaKey, useShortcutHint } from '~/hooks/useKeyboardShortcuts';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

/**
 * Header entry point for starting a new conversation. Renders as an anchor so
 * modified clicks still open `/c/new` in a new tab; `useNewChat` claims only
 * plain left clicks.
 */
export default function NewChat({
  onClick,
  className,
}: {
  /** `useNewChat().handleNewChatClick`, owned by the header. */
  onClick: (event: MouseEvent<HTMLElement>) => void;
  className?: string;
}) {
  const localize = useLocalize();
  const tooltipDescription = useShortcutHint('newChat', localize('com_ui_new_chat'));
  const ariaKey = useShortcutAriaKey('newChat');

  return (
    <TooltipAnchor
      description={tooltipDescription}
      render={
        <Button
          asChild
          size="icon"
          variant="header-action"
          className={cn('size-9 shrink-0', className)}
        >
          <a
            href="/c/new"
            data-testid="header-new-chat-button"
            aria-label={localize('com_ui_new_chat')}
            aria-keyshortcuts={ariaKey}
            onClick={onClick}
          >
            <NewChatIcon className="icon-md" aria-hidden="true" />
          </a>
        </Button>
      }
    />
  );
}
