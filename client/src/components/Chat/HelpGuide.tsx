import { useMemo, useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { normalizeServerName } from 'librechat-data-provider';
import { OGDialog, OGDialogTitle, OGDialogContent, OGDialogDescription } from '@librechat/client';
import { useGetAgentsConfig, useLocalize } from '~/hooks';
import { useGetStartupConfig } from '~/data-provider';
import { useMCPServerTitles } from '~/hooks/MCP';

/**
 * "Help" in the chat header, enabled by `interface.helpGuide`: what each assistant is for,
 * the systems it reaches and what to ask it, built from the deployment's model specs so it
 * says nothing the configuration does not.
 */
export default function HelpGuide() {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const { data: startupConfig } = useGetStartupConfig();
  const { agentsConfig } = useGetAgentsConfig();
  const mcpServerTitles = useMCPServerTitles();

  const assistants = useMemo(
    () =>
      (startupConfig?.modelSpecs?.list ?? []).map((spec) => ({
        name: spec.name,
        label: spec.label,
        description: spec.description,
        examples: spec.conversation_starters ?? [],
        systems: (spec.mcpServers ?? []).map(
          (server) => mcpServerTitles.get(normalizeServerName(server)) ?? server,
        ),
      })),
    [startupConfig?.modelSpecs?.list, mcpServerTitles],
  );

  if (startupConfig?.interface?.helpGuide !== true) {
    return null;
  }

  const title = startupConfig.appTitle
    ? localize('com_ui_help_guide_title_app', { 0: startupConfig.appTitle })
    : localize('com_ui_help_guide_title');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="help-guide-button"
        className="border-border-chrome bg-presentation text-text-primary hover:bg-surface-active-alt focus-visible:ring-text-primary inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
      >
        <CircleHelp className="size-4" aria-hidden="true" />
        {localize('com_ui_help')}
      </button>
      <OGDialog open={open} onOpenChange={setOpen}>
        <OGDialogContent className="max-h-[85vh] w-11/12 max-w-2xl overflow-y-auto p-6">
          <OGDialogTitle className="text-lg font-semibold">{title}</OGDialogTitle>
          <OGDialogDescription className="text-sm">
            {localize('com_ui_help_guide_intro')}
          </OGDialogDescription>

          <div className="mt-4 flex flex-col gap-4">
            {assistants.map((assistant) => (
              <section
                key={assistant.name}
                aria-labelledby={`help-${assistant.name}`}
                className="border-border-light rounded-xl border p-4"
              >
                <h3 id={`help-${assistant.name}`} className="text-text-primary font-semibold">
                  {assistant.label}
                </h3>
                {assistant.description && (
                  <p className="text-text-secondary mt-1 text-sm">{assistant.description}</p>
                )}
                {assistant.systems.length > 0 && (
                  <p className="text-text-secondary mt-2 text-sm">
                    <span className="text-text-primary font-medium">
                      {localize('com_ui_connected_to')}
                    </span>{' '}
                    {assistant.systems.join(', ')}
                  </p>
                )}
                {assistant.examples.length > 0 && (
                  <>
                    <p className="text-text-primary mt-2 text-sm font-medium">
                      {localize('com_ui_try_asking')}
                    </p>
                    <ul className="text-text-secondary mt-1 list-disc ps-5 text-sm">
                      {assistant.examples.map((example) => (
                        <li key={example}>{example}</li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            ))}
          </div>

          <h3 className="text-text-primary mt-5 font-semibold">
            {localize('com_ui_help_guide_tips')}
          </h3>
          <ul className="text-text-secondary mt-1 list-disc ps-5 text-sm">
            <li>{localize('com_ui_help_guide_tip_words')}</li>
            {assistants.length > 1 && <li>{localize('com_ui_help_guide_tip_switch')}</li>}
            <li>{localize('com_ui_help_guide_tip_sources')}</li>
            {agentsConfig?.toolApproval?.enabled === true && (
              <li>{localize('com_ui_help_guide_tip_approval')}</li>
            )}
            <li>{localize('com_ui_help_guide_tip_new_chat')}</li>
          </ul>
        </OGDialogContent>
      </OGDialog>
    </>
  );
}
