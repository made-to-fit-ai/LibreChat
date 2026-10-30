import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  useMCPIconMap,
  useMCPToolTitles,
  useMCPServerNames,
  useMCPServerTitles,
  useMCPReadOnlyTools,
} from '../useMCPIconMap';
import { activateCatalog, resetCatalogWarmup } from '../../useCatalogWarmup';

const mockUseMCPServersQuery = jest.fn();
const mockUseMCPToolsQuery = jest.fn();
jest.mock('~/data-provider', () => ({
  useMCPServersQuery: (config: unknown) => mockUseMCPServersQuery(config),
  useMCPToolsQuery: (config: unknown) => mockUseMCPToolsQuery(config),
}));

describe('useMCPIconMap', () => {
  beforeEach(() => {
    resetCatalogWarmup();
    mockUseMCPServersQuery.mockReturnValue({ data: undefined });
    mockUseMCPServersQuery.mockClear();
  });

  it('keeps the servers query disabled until warmup releases the catalog', () => {
    renderHook(() => {
      useMCPIconMap();
      useMCPServerNames();
    });

    expect(mockUseMCPServersQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it('enables the servers query once the catalog is active', () => {
    renderHook(() => {
      useMCPIconMap();
      useMCPServerNames();
    });
    expect(mockUseMCPServersQuery).toHaveBeenLastCalledWith({ enabled: false });

    act(() => {
      activateCatalog('mcpServers');
    });

    expect(mockUseMCPServersQuery).toHaveBeenLastCalledWith({ enabled: true });
  });

  it('maps configured server titles by server name, skipping servers without one', () => {
    mockUseMCPServersQuery.mockReturnValue({
      data: {
        accounting_insights: { title: 'Practice insights' },
        drafts: { title: '  ' },
        xero: {},
      },
    });
    const { result } = renderHook(() => useMCPServerTitles());
    expect([...result.current]).toEqual([['accounting_insights', 'Practice insights']]);
  });
});

describe('MCP tool catalog hooks', () => {
  beforeEach(() => {
    mockUseMCPToolsQuery.mockReturnValue({
      data: {
        servers: {
          xestro: {
            tools: [
              { pluginKey: 'list_mcp_xestro', title: '  List patients ', annotations: {} },
              {
                pluginKey: 'book_mcp_xestro',
                annotations: { title: 'Book appointment', readOnlyHint: false },
              },
            ],
          },
          billing: {
            tools: [
              { pluginKey: 'sum_mcp_billing', annotations: { readOnlyHint: true } },
              { pluginKey: 'blank_mcp_billing', title: '   ' },
            ],
          },
        },
      },
    });
  });

  it('maps trimmed tool titles by plugin key, falling back to the annotation title', () => {
    const { result } = renderHook(() => useMCPToolTitles());
    expect([...result.current]).toEqual([
      ['list_mcp_xestro', 'List patients'],
      ['book_mcp_xestro', 'Book appointment'],
    ]);
  });

  it('collects only tools whose server marks them read-only', () => {
    const { result } = renderHook(() => useMCPReadOnlyTools());
    expect([...result.current]).toEqual(['sum_mcp_billing']);
  });
});
