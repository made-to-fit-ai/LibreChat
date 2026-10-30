import React from 'react';
import { ContentTypes } from 'librechat-data-provider';
import { render, screen } from '@testing-library/react';
import type { TMessageContentParts } from 'librechat-data-provider';
import { groupSequentialToolCalls } from '~/utils';

/** Flipped per test: `interface.handoffSpeakers` from the startup config. */
let mockHandoffSpeakers = false;

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: { interface: { handoffSpeakers: mockHandoffSpeakers } } }),
  useGetEndpointsQuery: () => ({ data: undefined }),
  useSubagentAttachmentCallsQueries: () => [],
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: Record<string | number, string>) =>
    key === 'com_ui_reply_from' ? `Reply from ${values?.[0] ?? ''}` : key,
}));

jest.mock('~/Providers', () => ({
  MessageContext: jest.requireActual<typeof import('~/Providers/MessageContext')>(
    '~/Providers/MessageContext',
  ).MessageContext,
  SearchContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
  useSearchContext: () => ({ searchResults: undefined }),
  MediaContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
  useMediaContext: () => ({ attachmentsByName: undefined }),
  useAgentsMapContext: () => ({
    agent_a: { id: 'agent_a', name: 'A' },
    agent_b: { id: 'agent_b', name: 'B' },
  }),
}));

jest.mock('~/utils', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  mapAttachments: () => ({}),
  filterAttachmentsForPart: (attachments: unknown) => attachments,
  groupSequentialToolCalls: jest.fn(),
  hasPendingApprovalInPart: jest.requireActual('~/utils/groupToolCalls').hasPendingApprovalInPart,
  getPartKeyIndex: jest.requireActual('~/utils/messages').getPartKeyIndex,
  ...jest.requireActual<typeof import('~/utils/media')>('~/utils/media'),
}));

jest.mock('~/components/Chat/Messages/MessageIcon', () => ({
  __esModule: true,
  default: () => <span data-testid="message-icon" />,
}));

jest.mock('../Parts', () => ({
  EmptyText: () => <div data-testid="empty-text" />,
  AttachmentGroup: () => null,
  AgentUpdate: () => null,
}));

jest.mock('../MemoryArtifacts', () => ({
  __esModule: true,
  default: () => null,
  hasMemoryArtifacts: () => false,
}));

jest.mock('../Parts/WorkspaceChanges', () => ({
  __esModule: true,
  default: () => null,
  partitionWorkspaceChanges: (attachments?: unknown[]) => ({
    inlineAttachments: attachments ?? [],
    workspaceChanges: [],
  }),
}));

jest.mock('../Part', () => ({
  __esModule: true,
  default: ({ part }: { part: { type: string; text?: string } }) => (
    <div data-testid={`real-part-${part.type}`}>{part.text}</div>
  ),
}));

import ContentParts from '../ContentParts';

const text = (value: string, agentId?: string) =>
  ({ type: ContentTypes.TEXT, text: value, agentId }) as unknown as TMessageContentParts;

const baseProps = {
  messageId: 'msg-1',
  messageAgentId: 'agent_a',
  isLast: false,
  isSubmitting: false,
  isLatestMessage: false,
  isCreatedByUser: false,
  showThinking: false,
};

/** Two blocks from A, two from B, one from A: headers belong before parts 2 and 4 only. */
const handoffContent = [
  text('one', 'agent_a'),
  text('two', 'agent_a'),
  text('three', 'agent_b'),
  text('four', 'agent_b'),
  text('five', 'agent_a'),
];

const follows = (before: Element, after: Element) =>
  before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING;

beforeEach(() => {
  jest
    .mocked(groupSequentialToolCalls)
    .mockImplementation((parts) => parts.map((part) => ({ type: 'single', part })));
});

describe('SpeakerHeader', () => {
  it('names each agent that takes over from the previous block when the lever is on', () => {
    mockHandoffSpeakers = true;
    render(<ContentParts {...baseProps} content={handoffContent} />);

    const headings = screen.getAllByRole('heading');
    expect(headings.map((h) => h.getAttribute('aria-label'))).toEqual([
      'Reply from B',
      'Reply from A',
    ]);

    const parts = screen.getAllByTestId(`real-part-${ContentTypes.TEXT}`);
    expect(parts).toHaveLength(5);
    expect(follows(parts[0], headings[0])).toBeTruthy();
    expect(follows(parts[1], headings[0])).toBeTruthy();
    expect(follows(headings[0], parts[2])).toBeTruthy();
    expect(follows(parts[3], headings[1])).toBeTruthy();
    expect(follows(headings[1], parts[4])).toBeTruthy();
  });

  it('renders no speaker headings when the lever is off', () => {
    mockHandoffSpeakers = false;
    render(<ContentParts {...baseProps} content={handoffContent} />);

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(screen.getAllByTestId(`real-part-${ContentTypes.TEXT}`)).toHaveLength(5);
  });

  it('renders no speaker headings when parts carry no agent id', () => {
    mockHandoffSpeakers = true;
    render(<ContentParts {...baseProps} content={[text('one'), text('two'), text('three')]} />);

    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });
});
