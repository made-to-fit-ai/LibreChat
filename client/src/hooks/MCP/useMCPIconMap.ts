import { useMemo } from 'react';
import { normalizeServerName } from 'librechat-data-provider';
import type { MCPTool } from 'librechat-data-provider';
import { useMCPServersQuery, useMCPToolsQuery } from '~/data-provider';
import { useCatalogReady } from '../useCatalogWarmup';

/** These observers mount from rendered messages, so they must not pull the
 * server catalog onto the first-render path ahead of the warmup schedule. */
export function useMCPIconMap(): Map<string, string> {
  const mcpServersReady = useCatalogReady('mcpServers');
  const { data: servers } = useMCPServersQuery({ enabled: mcpServersReady });

  return useMemo(() => {
    const map = new Map<string, string>();
    if (!servers) {
      return map;
    }
    for (const [serverName, config] of Object.entries(servers)) {
      if (config.iconPath) {
        /** Looked up with a server name parsed out of a tool key, which carries the
         *  normalized form, so key the map the same way. */
        map.set(normalizeServerName(serverName), config.iconPath);
      }
    }
    return map;
  }, [servers]);
}

/**
 * Configured MCP server names in the normalized form tool keys are built from,
 * so they can be matched against a key. The config is keyed by the raw name.
 */
export function useMCPServerNames(): string[] {
  const mcpServersReady = useCatalogReady('mcpServers');
  const { data: servers } = useMCPServersQuery({ enabled: mcpServersReady });
  return useMemo(() => (servers ? Object.keys(servers).map(normalizeServerName) : []), [servers]);
}

/** MCP tool titles keyed by runtime tool name (`<tool>_mcp_<server>`), for tool-call labels. */
export function useMCPToolTitles(): Map<string, string> {
  const tools = useMCPToolCatalog();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const tool of tools) {
      const title = (tool.title ?? tool.annotations?.title)?.trim();
      if (title) {
        map.set(tool.pluginKey, title);
      }
    }
    return map;
  }, [tools]);
}

/** Runtime names of MCP tools whose server marks them read-only, so a call can read as a lookup. */
export function useMCPReadOnlyTools(): Set<string> {
  const tools = useMCPToolCatalog();
  return useMemo(
    () =>
      new Set(
        tools.filter((tool) => tool.annotations?.readOnlyHint === true).map((t) => t.pluginKey),
      ),
    [tools],
  );
}

/** MCP catalog entries keyed by runtime tool name, for labelling a call's arguments. */
export function useMCPToolInfo(): Map<string, MCPTool> {
  const tools = useMCPToolCatalog();
  return useMemo(() => new Map(tools.map((tool) => [tool.pluginKey, tool])), [tools]);
}

function useMCPToolCatalog(): MCPTool[] {
  const mcpServersReady = useCatalogReady('mcpServers');
  const { data } = useMCPToolsQuery({ enabled: mcpServersReady });
  return useMemo(
    () => Object.values(data?.servers ?? {}).flatMap((server) => server.tools ?? []),
    [data],
  );
}

/** Configured server titles keyed by the normalized server name, for tool-call labels. */
export function useMCPServerTitles(): Map<string, string> {
  const mcpServersReady = useCatalogReady('mcpServers');
  const { data: servers } = useMCPServersQuery({ enabled: mcpServersReady });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const [serverName, config] of Object.entries(servers ?? {})) {
      const title = config.title?.trim();
      if (title) {
        map.set(normalizeServerName(serverName), title);
      }
    }
    return map;
  }, [servers]);
}
