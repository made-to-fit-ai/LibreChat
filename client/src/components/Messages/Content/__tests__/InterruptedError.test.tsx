import React from 'react';
import userEvent from '@testing-library/user-event';
import { ErrorTypes } from 'librechat-data-provider';
import { render, screen } from '@testing-library/react';
import type { TConversation, TMessage } from 'librechat-data-provider';
import type { MessagesViewContextValue } from '~/Providers/MessagesViewContext';
import type { ChatContract } from '~/hooks/Chat/contract';
import {
  MessagesViewContext,
  MessagesSubmittingContext,
  MessagesOperationsContext,
} from '~/Providers/MessagesViewContext';
import { MessageContext } from '~/Providers/MessageContext';
import InterruptedError from '../Error/InterruptedError';
import translation from '~/locales/en/translation.json';
import { ChatContext } from '~/Providers/ChatContext';
import { errorRenderers } from '../Error/registry';

const catalog = translation as Record<string, string>;

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    (jest.requireActual('~/locales/en/translation.json') as Record<string, string>)[key] ?? key,
}));

jest.mock('~/hooks/Conversations/useGetAddedConvo', () => ({
  __esModule: true,
  default: () => () => null,
}));

const question = {
  messageId: 'u1',
  parentMessageId: '00000000-0000-0000-0000-000000000000',
  conversationId: 'convo',
  isCreatedByUser: true,
  text: 'send the report',
} as TMessage;
const reply = {
  messageId: 'a1',
  parentMessageId: 'u1',
  conversationId: 'convo',
  isCreatedByUser: false,
  text: '',
} as TMessage;

function renderError({
  inChat = true,
  readOnly = false,
  isSubmitting = false,
}: { inChat?: boolean; readOnly?: boolean; isSubmitting?: boolean } = {}) {
  const regenerate = jest.fn();
  const conversation = { conversationId: 'convo', endpoint: 'agents' } as TConversation;
  const operations = {
    ask: jest.fn(),
    regenerate,
    handleContinue: jest.fn(),
    getMessages: () => [question, reply],
    setMessages: jest.fn(),
  } as unknown as MessagesViewContextValue;
  const view = {
    ...operations,
    conversation,
    conversationId: 'convo',
    readOnly,
    isSubmitting,
  } as MessagesViewContextValue;
  const content = (
    <MessagesOperationsContext.Provider value={operations}>
      <MessagesSubmittingContext.Provider value={isSubmitting}>
        <MessagesViewContext.Provider value={view}>
          <MessageContext.Provider
            value={{ messageId: 'a1', partIndex: 1, isExpanded: true, conversationId: 'convo' }}
          >
            <InterruptedError />
          </MessageContext.Provider>
        </MessagesViewContext.Provider>
      </MessagesSubmittingContext.Provider>
    </MessagesOperationsContext.Provider>
  );
  render(
    inChat ? (
      <ChatContext.Provider value={{ conversation } as unknown as ChatContract}>
        {content}
      </ChatContext.Provider>
    ) : (
      content
    ),
  );
  return { regenerate };
}

describe('InterruptedError', () => {
  it('is the renderer for an interrupted generation', () => {
    expect(errorRenderers[ErrorTypes.GENERATION_INTERRUPTED]).toBe(InterruptedError);
  });

  it('explains the interruption and sends the turn again only when asked', async () => {
    const { regenerate } = renderError();

    expect(screen.getByText(catalog.com_error_generation_interrupted)).toBeInTheDocument();
    expect(regenerate).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: catalog.com_ui_retry }));

    expect(regenerate).toHaveBeenCalledTimes(1);
    expect(regenerate).toHaveBeenCalledWith(reply, { addedConvo: null });
  });

  it('disables retry while another reply is being generated', () => {
    renderError({ isSubmitting: true });

    expect(screen.getByRole('button', { name: catalog.com_ui_retry })).toBeDisabled();
  });

  it.each([
    ['outside a chat', { inChat: false }],
    ['in a read-only view', { readOnly: true }],
  ])('shows the explanation without a retry %s', (_name, options) => {
    renderError(options);

    expect(screen.getByText(catalog.com_error_generation_interrupted)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: catalog.com_ui_retry })).not.toBeInTheDocument();
  });
});
