import React from 'react';
import { RecoilRoot } from 'recoil';
import { Provider as JotaiProvider, createStore } from 'jotai';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { activeGenerationCreatedAtByConvoId } from '@librechat/chat/react';
import type { Agents } from 'librechat-data-provider';
import { PendingToolApprovalButton, PendingToolApprovalPanel } from '../Review';
import { composerOverlayCountFamily } from '~/components/Chat/Input/overlay';
import ApprovalProvider from '../../Messages/Content/ApprovalContext';
import { pendingApprovalActionFamily } from '../state';
import { ChatContext } from '~/Providers/ChatContext';

jest.mock('@librechat/client', () => ({
  Button: jest
    .requireActual('react')
    .forwardRef(
      (
        { children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>,
        ref: React.Ref<HTMLButtonElement>,
      ) => (
        <button ref={ref} {...props}>
          {children}
        </button>
      ),
    ),
  TextareaAutosize: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
  TooltipAnchor: ({ render }: { render: React.ReactNode }) => render,
}));

let mockAgentsConfig: { toolApproval?: { friendly?: boolean } } | undefined;
const mockMutate = jest.fn();

jest.mock('~/hooks', () => ({
  useGetAgentsConfig: () => ({ agentsConfig: mockAgentsConfig }),
  useLocalize: () => (key: string, values?: Record<string | number, string | number>) => {
    const labels: Record<string, string> = {
      com_ui_review_action: 'Review 1 action',
      com_ui_review_actions: `Review ${values?.[0]} actions`,
      com_ui_review_run_command: 'Run command',
      com_ui_review_create_file: `Create ${values?.[0]}`,
      com_ui_review_create_file_generic: 'Create file',
      com_ui_review_edit_file: `Edit ${values?.[0]}`,
      com_ui_review_edit_file_generic: 'Edit file',
      com_ui_proposed_command: 'Proposed command',
      com_ui_proposed_contents: 'Proposed contents',
      com_ui_proposed_replacements: 'Proposed replacements',
      com_ui_proposed_arguments: 'Proposed arguments',
      com_ui_decisions_selected: `${values?.[0]} of ${values?.[1]} decisions selected`,
      com_ui_approve: 'Approve',
      com_ui_reject: 'Reject',
      com_ui_continue: 'Continue',
      com_ui_collapse: 'Collapse',
      com_ui_dont_approve: "Don't approve",
      com_ui_approve_and_send: 'Approve and send',
    };
    return labels[key] ?? key;
  },
}));

jest.mock('~/data-provider', () => ({
  useSubmitToolApprovalMutation: () => ({ mutate: mockMutate }),
  useSubmitAskAnswerMutation: () => ({ mutate: jest.fn() }),
  useMCPToolsQuery: () => ({ data: undefined }),
}));

jest.mock('~/store/agents', () => ({
  useGetEphemeralAgent: () => () => undefined,
}));

const pendingAction: Agents.PendingAction = {
  actionId: 'action-1',
  streamId: 'stream-1',
  conversationId: 'conversation-1',
  createdAt: 1000,
  payload: {
    type: 'tool_approval',
    action_requests: [
      {
        name: 'create_file',
        source: 'librechat_code',
        tool_call_id: 'call-1',
        arguments: { path: 'src/new.ts', content: 'export const value = 1;' },
      },
      {
        name: 'bash_tool',
        source: 'librechat_code',
        tool_call_id: 'call-2',
        arguments: { command: 'npm test -- new' },
      },
    ],
    review_configs: [
      {
        action_name: 'create_file',
        tool_call_id: 'call-1',
        allowed_decisions: ['approve', 'reject'],
      },
      {
        action_name: 'bash_tool',
        tool_call_id: 'call-2',
        allowed_decisions: ['approve', 'reject'],
      },
    ],
  },
};

describe('PendingToolApproval', () => {
  test('reviews the authoritative batch beside the composer and can be collapsed', async () => {
    const jotaiStore = createStore();
    jotaiStore.set(pendingApprovalActionFamily('conversation-1'), pendingAction);
    render(
      <RecoilRoot>
        <JotaiProvider store={jotaiStore}>
          <ApprovalProvider pendingAction={pendingAction}>
            <PendingToolApprovalPanel conversationId="conversation-1" />
            <PendingToolApprovalButton conversationId="conversation-1" />
          </ApprovalProvider>
        </JotaiProvider>
      </RecoilRoot>,
    );

    expect(await screen.findByRole('region', { name: 'Review 2 actions' })).toBeInTheDocument();
    expect(jotaiStore.get(composerOverlayCountFamily('conversation-1'))).toBe(1);
    expect(screen.getByText(/Create src\/new\.ts/)).toBeInTheDocument();
    expect(screen.getByText('npm test -- new')).toBeInTheDocument();
    expect(screen.getByText('0 of 2 decisions selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();

    const approvals = screen.getAllByRole('button', { name: 'Approve' });
    fireEvent.click(approvals[0]);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(approvals[1]);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expect(screen.getByText('2 of 2 decisions selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByRole('region', { name: 'Review 2 actions' })).not.toBeInTheDocument();
    expect(jotaiStore.get(composerOverlayCountFamily('conversation-1'))).toBe(0);
    expect(screen.getByTestId('pending-tool-approval-button')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  describe('friendly mode', () => {
    const singleAction: Agents.PendingAction = {
      ...pendingAction,
      payload: {
        type: 'tool_approval',
        action_requests: [
          {
            name: 'email_send_client_email_mcp_workbench',
            tool_call_id: 'call-1',
            arguments: { note: 'Thanks' },
          },
        ],
        review_configs: [
          {
            action_name: 'email_send_client_email_mcp_workbench',
            tool_call_id: 'call-1',
            allowed_decisions: ['approve', 'reject', 'edit', 'respond'],
          },
        ],
      },
    };

    const renderFriendly = (action: Agents.PendingAction) => {
      const jotaiStore = createStore();
      jotaiStore.set(pendingApprovalActionFamily('conversation-1'), action);
      jotaiStore.set(activeGenerationCreatedAtByConvoId('conversation-1'), 1000);
      render(
        <RecoilRoot>
          <QueryClientProvider client={new QueryClient()}>
            <JotaiProvider store={jotaiStore}>
              <ChatContext.Provider
                value={{ conversation: { conversationId: 'conversation-1' } } as never}
              >
                <ApprovalProvider pendingAction={action}>
                  <PendingToolApprovalPanel conversationId="conversation-1" />
                </ApprovalProvider>
              </ChatContext.Provider>
            </JotaiProvider>
          </QueryClientProvider>
        </RecoilRoot>,
      );
    };

    beforeEach(() => {
      mockAgentsConfig = { toolApproval: { friendly: true } };
      mockMutate.mockClear();
    });

    afterEach(() => {
      mockAgentsConfig = undefined;
    });

    test('a single action approves and submits in one click, without Continue or a counter', async () => {
      renderFriendly(singleAction);
      await screen.findByRole('region', { name: 'Review 1 action' });
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
      expect(screen.queryByText(/decisions selected/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Approve and send' }));
      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate.mock.calls[0][0]).toMatchObject({
        actionId: 'action-1',
        decisions: [{ tool_call_id: 'call-1', decision: 'approve' }],
      });
    });

    test("Don't approve rejects and submits in one click", async () => {
      renderFriendly(singleAction);
      await screen.findByRole('region', { name: 'Review 1 action' });
      fireEvent.click(screen.getByRole('button', { name: "Don't approve" }));
      expect(mockMutate.mock.calls[0][0]).toMatchObject({
        decisions: [{ tool_call_id: 'call-1', decision: 'reject' }],
      });
    });

    test('a batch keeps per-item decisions and the Continue submit', async () => {
      renderFriendly(pendingAction);
      await screen.findByRole('region', { name: 'Review 2 actions' });
      expect(screen.getByText('0 of 2 decisions selected')).toBeInTheDocument();
      screen.getAllByRole('button', { name: 'Approve' }).forEach((b) => fireEvent.click(b));
      expect(mockMutate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
  });

  describe('collapsing from the keyboard', () => {
    function Harness() {
      const triggerRef = React.useRef<HTMLButtonElement>(null);
      return (
        <>
          <PendingToolApprovalPanel conversationId="conversation-1" triggerRef={triggerRef} />
          <PendingToolApprovalButton conversationId="conversation-1" triggerRef={triggerRef} />
        </>
      );
    }

    const renderPanel = () => {
      const jotaiStore = createStore();
      jotaiStore.set(pendingApprovalActionFamily('conversation-1'), pendingAction);
      render(
        <RecoilRoot>
          <JotaiProvider store={jotaiStore}>
            <ApprovalProvider pendingAction={pendingAction}>
              <Harness />
            </ApprovalProvider>
          </JotaiProvider>
        </RecoilRoot>,
      );
      return jotaiStore;
    };

    test('Escape collapses the panel, keeps decisions and returns focus to the toggle', async () => {
      renderPanel();
      await screen.findByRole('region', { name: 'Review 2 actions' });
      const approve = screen.getAllByRole('button', { name: 'Approve' })[0];
      fireEvent.click(approve);
      approve.focus();

      fireEvent.keyDown(approve, { key: 'Escape', isComposing: true });
      fireEvent.keyDown(approve, { key: 'Escape', keyCode: 229 });
      fireEvent.keyDown(approve, { key: 'Escape', shiftKey: true });
      expect(screen.getByRole('region', { name: 'Review 2 actions' })).toBeInTheDocument();

      fireEvent.keyDown(approve, { key: 'Escape' });
      expect(screen.queryByRole('region', { name: 'Review 2 actions' })).not.toBeInTheDocument();
      const toggle = screen.getByTestId('pending-tool-approval-button');
      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(toggle);
      expect(screen.getByText('1 of 2 decisions selected')).toBeInTheDocument();
    });

    test('the Collapse button also returns focus to the toggle', async () => {
      renderPanel();
      await screen.findByRole('region', { name: 'Review 2 actions' });
      fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
      expect(screen.getByTestId('pending-tool-approval-button')).toHaveFocus();
    });
  });
});
