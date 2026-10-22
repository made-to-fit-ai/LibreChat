import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useMCPIconMap, useMCPServerNames, useMCPServerTitles } from '../useMCPIconMap';
import { activateCatalog, resetCatalogWarmup } from '../../useCatalogWarmup';

const mockUseMCPServersQuery = jest.fn();
jest.mock('~/data-provider', () => ({
  useMCPServersQuery: (config: unknown) => mockUseMCPServersQuery(config),
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
