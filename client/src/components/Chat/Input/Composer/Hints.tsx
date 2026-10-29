import { memo } from 'react';
import type { ComposerHintState } from '~/hooks/Input/useComposerHint';
import useComposerHint from '~/hooks/Input/useComposerHint';

/** Scoped per pane: split view mounts one composer per index, and a shared id
 *  would point every textarea's `aria-describedby` at the first pane's hint. */
export const composerHintId = (index: number) => `composer-hint-${index}`;

/**
 * The composer's accessible description: whatever the current state affords
 * (during-run modifiers, upload progress, a paused question). The textarea
 * points at it via `aria-describedby`. An `aria-live` region here would
 * re-announce on every keystroke as the hint flips between idle and typing, so
 * the description channel carries it instead.
 *
 * `sendKeyHint` (`interface.composerSendHint`) also shows the send line to sighted
 * users while the composer is focused and holds text. Its row is reserved whenever
 * the lever is on, so the composer never moves and nothing positioned beneath the
 * form can overlap it. Below `sm`, where a touch keyboard has no ⌘ or Ctrl to
 * name, the row is not rendered.
 */
function Hints({
  index,
  enterToSend,
  sendKeyHint = false,
  focused = false,
  ...state
}: ComposerHintState & { index: number; sendKeyHint?: boolean; focused?: boolean }) {
  const hint = useComposerHint({ ...state, enterToSend });
  const showSendKey = focused && state.hasText && !state.isSubmitting && hint.kind === 'tip';

  return (
    <>
      <span id={composerHintId(index)} className="sr-only">
        {hint.text}
      </span>
      {sendKeyHint && (
        <div aria-hidden="true" className="hidden h-4 justify-end px-4 sm:flex">
          {showSendKey && (
            <span
              data-testid="composer-send-hint"
              className="text-text-secondary text-xs leading-4"
            >
              {hint.text}
            </span>
          )}
        </div>
      )}
    </>
  );
}

export default memo(Hints);
