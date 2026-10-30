import { useMemo } from 'react';
import { EModelEndpoint, parseEphemeralAgentId, stripAgentIdSuffix } from 'librechat-data-provider';
import type { Agent } from 'librechat-data-provider';
import { useAgentsMapContext } from '~/Providers';

export type Speaker = {
  name: string;
  endpoint: string;
  model?: string;
  agent?: Agent;
};

/**
 * Display name and icon inputs for the agent a content part carries: a real agent
 * (with any `____N` parallel suffix stripped), an ephemeral `endpoint__model___sender`
 * id, or the raw id when neither resolves.
 */
export default function useSpeaker(agentId?: string): Speaker {
  const agentsMap = useAgentsMapContext();
  return useMemo(() => {
    if (!agentId) {
      return { name: 'Agent', endpoint: EModelEndpoint.agents };
    }
    const baseAgentId = stripAgentIdSuffix(agentId);
    const agent = agentsMap?.[baseAgentId] as Agent | undefined;
    if (agent) {
      return {
        name: agent.name ?? '',
        endpoint: EModelEndpoint.agents,
        model: agent.model ?? undefined,
        agent,
      };
    }
    const parsed = parseEphemeralAgentId(agentId);
    if (parsed) {
      return {
        name: parsed.sender || parsed.model || 'AI',
        endpoint: parsed.endpoint,
        model: parsed.model,
      };
    }
    return { name: baseAgentId, endpoint: EModelEndpoint.agents };
  }, [agentId, agentsMap]);
}
