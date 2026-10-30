import { memo } from 'react';
import MessageIcon from '~/components/Chat/Messages/MessageIcon';
import { useGetStartupConfig } from '~/data-provider';
import AuthorHeader from './Parts/AuthorHeader';
import { useLocalize } from '~/hooks';
import useSpeaker from './speaker';

function Speaker({ agentId }: { agentId: string }) {
  const localize = useLocalize();
  const { name, endpoint, model, agent } = useSpeaker(agentId);
  return (
    <AuthorHeader
      icon={
        <MessageIcon
          iconData={{ endpoint, model, modelLabel: name, isCreatedByUser: false }}
          agent={agent}
        />
      }
      label={name}
      ariaLabel={localize('com_ui_reply_from', { 0: name })}
    />
  );
}

/**
 * Names the agent that speaks the parts below it after a handoff, so a reply several
 * agents wrote shows who wrote each block. Renders only under `interface.handoffSpeakers`.
 */
const SpeakerHeader = memo(function SpeakerHeader({ agentId }: { agentId: string }) {
  const { data: startupConfig } = useGetStartupConfig();
  if (startupConfig?.interface?.handoffSpeakers !== true) {
    return null;
  }
  return <Speaker agentId={agentId} />;
});

export default SpeakerHeader;
