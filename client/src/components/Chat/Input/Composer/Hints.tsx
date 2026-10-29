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
 * `showSendKey` (`interface.composerSendHint` while the composer has focus) also
 * shows the send line to sighted users once there is text. It sits in the band's
 * bottom clearance, so it never moves the composer; below `sm` that clearance is
 * gone, and a touch keyboard has no ⌘ or Ctrl to name anyway.
 */
function Hints({
  index,
  enterToSend,
  showSendKey = false,
  ...state
}: ComposerHintState & { index: number; showSendKey?: boolean }) {
  const hint = useComposerHint({ ...state, enterToSend });
  const showVisible = showSendKey && state.hasText && !state.isSubmitting && hint.kind === 'tip';

  return (
    <>
      <span id={composerHintId(index)} className="sr-only">
        {hint.text}
      </span>
      {showVisible && (
        <span
          aria-hidden="true"
          data-testid="composer-send-hint"
          className="text-text-secondary pointer-events-none absolute end-4 top-full hidden text-xs leading-4 sm:block"
        >
          {hint.text}
        </span>
      )}
    </>
  );
}

export default memo(Hints);
