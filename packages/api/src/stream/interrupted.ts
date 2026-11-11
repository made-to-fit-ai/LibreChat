import { logger, tenantStorage } from '@librechat/data-schemas';
import { ContentTypes, ErrorTypes } from 'librechat-data-provider';
import type {
  IJobStore,
  SerializableJobData,
  InterruptedGenerationRecorder,
} from './interfaces/IJobStore';
import { filterPersistableAbortContent } from './abortContent';

/** Shown as-is by a client bundle that predates `ErrorTypes.GENERATION_INTERRUPTED`. */
const INTERRUPTED_FALLBACK =
  'This reply was interrupted before it finished and was not resumed. ' +
  'Steps it had already started may have taken effect. Check before trying again.';

/** Typed payload a current client localizes, after prose an older one can still show. */
export const INTERRUPTED_GENERATION_ERROR: string = `${INTERRUPTED_FALLBACK}\n${JSON.stringify({
  type: ErrorTypes.GENERATION_INTERRUPTED,
})}`;

type InterruptedJob = Parameters<InterruptedGenerationRecorder>[0];

/** The saved fields of a message row this module reads. */
interface SavedMessage {
  conversationId?: string;
  endpoint?: string;
  model?: string;
  isTemporary?: boolean;
  expiredAt?: Date | null;
}

export interface InterruptedGenerationMethods {
  getMessage(params: { user: string; messageId: string }): Promise<SavedMessage | null>;
  closeUnfinishedMessage(params: {
    user: string;
    messageId: string;
    conversationId: string;
    part: Record<string, unknown>;
    content?: readonly unknown[];
  }): Promise<boolean>;
  saveMessage(
    ctx: { userId: string; isTemporary?: boolean; expiredAt?: Date },
    params: {
      messageId: string;
      conversationId: string;
      parentMessageId: string;
      sender: string;
      endpoint?: string;
      model?: string;
      text: string;
      content: unknown[];
      unfinished: boolean;
      error: boolean;
      isCreatedByUser: boolean;
    },
    metadata?: { context?: string; insertOnly?: boolean },
  ): Promise<unknown>;
}

const CONTEXT = 'packages/api/src/stream/interrupted.ts - interrupted generation';

const interruptedPart = () => ({
  type: ContentTypes.ERROR,
  [ContentTypes.ERROR]: INTERRUPTED_GENERATION_ERROR,
});

/**
 * The content a stale job's store still holds, filtered the way a disconnect
 * snapshot is. A compaction's snapshot carries markers this cannot rebuild, so
 * it keeps its saved row, and a failed read costs the newer content, not the
 * record.
 */
export async function readInterruptedContent(
  store: Pick<IJobStore, 'getContentParts'>,
  job: Pick<SerializableJobData, 'streamId' | 'createdAt' | 'compact'>,
): Promise<unknown[]> {
  if (job.compact === true) {
    return [];
  }
  try {
    const streamed = await store.getContentParts(job.streamId, job.createdAt);
    return filterPersistableAbortContent(streamed?.content);
  } catch (error) {
    logger.warn(
      `[InterruptedGeneration] Could not read streamed content for ${job.streamId}`,
      error,
    );
    return [];
  }
}

/**
 * Builds the recorder that gives an ownerless generation a durable outcome.
 *
 * A partial reply saved while the run was live is closed with an error part
 * that says it was interrupted; a turn with no saved reply gets one ending in
 * that part. Content the job streamed after its last saved snapshot is kept in
 * both cases. A reply that already settled is left alone. Nothing is
 * resumed or rerun: the run may have called tools before it stopped, so only a
 * person can decide to try again.
 *
 * Throws when the write fails, so the caller keeps the job and tries again on
 * its next sweep instead of dropping the only record of the generation.
 */
export function createInterruptedGenerationRecorder(
  methods: InterruptedGenerationMethods,
): InterruptedGenerationRecorder {
  const record = async (job: InterruptedJob, streamed: readonly unknown[]): Promise<void> => {
    const userMessageId = job.userMessage?.messageId;
    const conversationId = job.conversationId ?? job.userMessage?.conversationId;
    if (!userMessageId || !conversationId) {
      logger.warn(`[InterruptedGeneration] No saved turn to mark for ${job.streamId}`);
      return;
    }
    const messageId = job.responseMessageId || `${userMessageId}_`;
    const closed = await methods.closeUnfinishedMessage({
      user: job.userId,
      messageId,
      conversationId,
      part: interruptedPart(),
      ...(streamed.length > 0 && { content: streamed }),
    });
    // A reply that is saved but was not closed has already settled, or is not this turn's.
    if (closed || (await methods.getMessage({ user: job.userId, messageId })) != null) {
      return;
    }

    const userMessage = await methods.getMessage({ user: job.userId, messageId: userMessageId });
    if (userMessage == null || userMessage.conversationId !== conversationId) {
      logger.warn(`[InterruptedGeneration] No saved turn to mark for ${job.streamId}`);
      return;
    }
    await methods.saveMessage(
      {
        userId: job.userId,
        ...(userMessage.isTemporary != null && { isTemporary: userMessage.isTemporary }),
        ...(userMessage.expiredAt != null && { expiredAt: userMessage.expiredAt }),
      },
      {
        messageId,
        conversationId,
        parentMessageId: userMessageId,
        sender: 'AI',
        ...(userMessage.endpoint != null && { endpoint: userMessage.endpoint }),
        ...(userMessage.model != null && { model: userMessage.model }),
        text: '',
        content: [...streamed, interruptedPart()],
        unfinished: false,
        error: false,
        isCreatedByUser: false,
      },
      // A reply saved since the read above is a newer outcome; never overwrite it.
      { context: CONTEXT, insertOnly: true },
    );
  };

  return (job, streamed = []) =>
    job.tenantId
      ? tenantStorage.run({ tenantId: job.tenantId, userId: job.userId }, () =>
          record(job, streamed),
        )
      : record(job, streamed);
}
