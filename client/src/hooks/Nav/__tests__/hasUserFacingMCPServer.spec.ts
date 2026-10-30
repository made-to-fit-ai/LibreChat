import type { MCPServerDefinition } from '~/hooks/MCP/useMCPServerManager';
import { hasUserFacingMCPServer } from '../useSideNavLinks';

jest.mock('~/hooks', () => ({}));
jest.mock('~/components/SidePanel/MCPBuilder/MCPBuilderPanel', () => () => null);
jest.mock('~/components/SidePanel/Agents/AgentPanelSwitch', () => () => null);
jest.mock('~/components/SidePanel/Bookmarks/BookmarkPanel', () => () => null);
jest.mock('~/components/SidePanel/Builder/PanelSwitch', () => () => null);
jest.mock('~/components/SidePanel/Schedules', () => ({}));
jest.mock('~/components/SidePanel/Parameters/Panel', () => () => null);
jest.mock('~/components/SidePanel/Memories', () => ({}));
jest.mock('~/components/Prompts', () => ({}));
jest.mock('~/components/Skills', () => ({}));

const server = (config: Partial<MCPServerDefinition['config']>) =>
  ({ serverName: 'xestro', config }) as MCPServerDefinition;

describe('hasUserFacingMCPServer', () => {
  it('is true when a server is offered in the chat menu', () => {
    expect(hasUserFacingMCPServer([server({ chatMenu: false }), server({})])).toBe(true);
  });

  it('is false when every server is hidden from chat and needs nothing from the user', () => {
    expect(hasUserFacingMCPServer([server({ chatMenu: false }), server({ chatMenu: false })])).toBe(
      false,
    );
  });

  it('is true when a hidden server needs sign-in or user values', () => {
    expect(hasUserFacingMCPServer([server({ chatMenu: false, requiresOAuth: true })])).toBe(true);
    expect(
      hasUserFacingMCPServer([
        server({
          chatMenu: false,
          customUserVars: { API_KEY: { title: 'API key', description: 'Your key' } },
        }),
      ]),
    ).toBe(true);
  });

  it('is false with no servers', () => {
    expect(hasUserFacingMCPServer(undefined)).toBe(false);
    expect(hasUserFacingMCPServer([])).toBe(false);
  });
});
