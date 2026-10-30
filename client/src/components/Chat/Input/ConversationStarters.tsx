import { useMemo, useCallback } from 'react';
import { EModelEndpoint, Constants } from 'librechat-data-provider';
import {
  useGetAssistantDocsQuery,
  useGetEndpointsQuery,
  useGetStartupConfig,
} from '~/data-provider';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { getIconEndpoint, getEntity, getModelSpec } from '~/utils';
import { useSubmitMessage, useLocalize } from '~/hooks';

const ConversationStarters = () => {
  const localize = useLocalize();
  const { conversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { data: startupConfig } = useGetStartupConfig();

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (ep === EModelEndpoint.azureOpenAI) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { data: documentsMap = new Map() } = useGetAssistantDocsQuery(endpointType, {
    select: (data) => new Map(data.map((dbA) => [dbA.assistant_id, dbA])),
  });

  const { entity, isAgent } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const modelSpec = useMemo(
    () => getModelSpec({ specName: conversation?.spec, startupConfig }),
    [conversation?.spec, startupConfig],
  );

  const conversation_starters = useMemo(() => {
    if (entity?.conversation_starters?.length) {
      return entity.conversation_starters;
    }

    if (modelSpec?.conversation_starters?.length) {
      return modelSpec.conversation_starters;
    }

    if (isAgent) {
      return [];
    }

    return documentsMap.get(entity?.id ?? '')?.conversation_starters ?? [];
  }, [documentsMap, isAgent, entity, modelSpec]);

  const { submitMessage } = useSubmitMessage();
  const sendConversationStarter = useCallback(
    (text: string) => submitMessage({ text }),
    [submitMessage],
  );

  if (!conversation_starters.length) {
    return null;
  }

  return (
    <section aria-label={localize('com_ui_try_asking')} className="mt-2 mb-8 w-full px-4">
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {conversation_starters
          .slice(0, Constants.MAX_CONVO_STARTERS)
          .map((text: string, index: number) => (
            <button
              key={index}
              type="button"
              onClick={() => sendConversationStarter(text)}
              style={{ animationDelay: `${index * 75}ms`, animationFillMode: 'backwards' }}
              className="border-border-light text-text-secondary fade-in hover:bg-surface-hover hover:text-text-primary focus-visible:ring-text-primary cursor-pointer rounded-xl border px-3.5 py-2.5 text-start text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:outline-hidden [&:nth-child(n+3)]:max-sm:hidden"
            >
              <span className="line-clamp-2 break-words">{text}</span>
            </button>
          ))}
      </div>
    </section>
  );
};

export default ConversationStarters;
