import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import HelpGuide from '../HelpGuide';

let mockStartupConfig: Record<string, unknown> = {};
let mockToolApproval: { enabled: boolean } | undefined;

jest.mock('librechat-data-provider', () => ({
  normalizeServerName: (name: string) => name,
}));

jest.mock('@librechat/client', () => ({
  OGDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  OGDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  OGDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: mockStartupConfig }),
}));

jest.mock('~/hooks/MCP', () => ({
  useMCPServerTitles: () => new Map([['xestro', 'Xestro']]),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useGetAgentsConfig: () => ({ agentsConfig: { toolApproval: mockToolApproval } }),
}));

const clinicSpec = {
  name: 'clinic',
  label: 'Clinic analyst',
  mcpServers: ['xestro'],
  conversation_starters: ['How many referrals came in last week?'],
};

function openGuide() {
  render(<HelpGuide />);
  fireEvent.click(screen.getByRole('button', { name: 'com_ui_help' }));
  return screen.getByRole('dialog');
}

describe('HelpGuide', () => {
  beforeEach(() => {
    mockToolApproval = undefined;
    mockStartupConfig = { interface: { helpGuide: true }, modelSpecs: { list: [clinicSpec] } };
  });

  it('renders nothing unless the deployment enables it', () => {
    mockStartupConfig = { interface: {}, modelSpecs: { list: [clinicSpec] } };
    const { container } = render(<HelpGuide />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each assistant with its connected systems and starters', () => {
    const dialog = openGuide();

    expect(dialog).toHaveTextContent('Clinic analyst');
    expect(dialog).toHaveTextContent('com_ui_connected_to Xestro');
    expect(dialog).toHaveTextContent('How many referrals came in last week?');
    expect(dialog).toHaveTextContent('com_ui_help_guide_tip_sources');
    expect(dialog).not.toHaveTextContent('com_ui_help_guide_tip_approval');
  });

  it('mentions approvals only when tool approval is on', () => {
    mockToolApproval = { enabled: true };
    expect(openGuide()).toHaveTextContent('com_ui_help_guide_tip_approval');
  });

  it('drops the sources tip when no assistant reaches a system', () => {
    mockStartupConfig = {
      interface: { helpGuide: true },
      modelSpecs: { list: [{ ...clinicSpec, mcpServers: undefined }] },
    };
    const dialog = openGuide();

    expect(dialog).not.toHaveTextContent('com_ui_help_guide_tip_sources');
    expect(dialog).not.toHaveTextContent('com_ui_connected_to');
  });
});
