import { useContext } from 'react';
import { findMessageById } from 'librechat-data-provider';
import {
  useMessagesIsSubmitting,
  useIsMessagesViewReadOnly,
  useOptionalMessagesOperations,
  useOptionalMessagesConversation,
} from '~/Providers/MessagesViewContext';
import useGetAddedConvo from '~/hooks/Conversations/useGetAddedConvo';
import { useMessageContext } from '~/Providers/MessageContext';
import { ErrorAction, ErrorActions, ErrorBody } from './parts';
import { ChatContext } from '~/Providers/ChatContext';
import { useLocalize } from '~/hooks';

/** Sends the turn again as a new run. Only a live, writable chat can do that. */
function RetryAction() {
  const localize = useLocalize();
  const isSubmitting = useMessagesIsSubmitting();
  const { regenerate, getMessages } = useOptionalMessagesOperations();
  const { messageId } = useMessageContext();
  const getAddedConvo = useGetAddedConvo();

  const message = findMessageById(getMessages(), messageId);
  if (message == null) {
    return null;
  }
  return (
    <ErrorActions>
      <ErrorAction
        onClick={() => regenerate(message, { addedConvo: getAddedConvo() })}
        disabled={isSubmitting}
      >
        {localize('com_ui_retry')}
      </ErrorAction>
    </ErrorActions>
  );
}

/**
 * A reply the server stopped running before it finished. Nothing resumes it: the run may have
 * called tools before it stopped, so the reader is told to check and then chooses to send the turn
 * again. A search result, a shared link and a read-only thread show the explanation alone.
 */
export default function InterruptedError() {
  const localize = useLocalize();
  const chat = useContext(ChatContext);
  const readOnly = useIsMessagesViewReadOnly();
  const { conversation } = useOptionalMessagesConversation();
  const canRetry = chat != null && !readOnly && conversation?.subagentThread == null;

  return (
    <ErrorBody>
      <div>{localize('com_error_generation_interrupted')}</div>
      {canRetry && <RetryAction />}
    </ErrorBody>
  );
}
