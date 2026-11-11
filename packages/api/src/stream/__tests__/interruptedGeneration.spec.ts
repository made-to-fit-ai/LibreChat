import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ContentTypes, ErrorTypes } from 'librechat-data-provider';
import { createMethods, createModels } from '@librechat/data-schemas';
import type { InterruptedGenerationRecorder } from '../interfaces/IJobStore';
import { createInterruptedGenerationRecorder, INTERRUPTED_GENERATION_ERROR } from '../interrupted';
import { InMemoryJobStore } from '../implementations/InMemoryJobStore';

/** Suppress winston Console transport output */
jest.spyOn(console, 'log').mockImplementation();

const USER = 'user-1';
const CONVERSATION = '6a1f7f9e-3c1d-4d0a-9a53-0f1f3a0f8c11';
const USER_MESSAGE = 'user-message-1';
const REPLY = 'reply-message-1';

const job = {
  streamId: CONVERSATION,
  userId: USER,
  conversationId: CONVERSATION,
  responseMessageId: REPLY,
  userMessage: { messageId: USER_MESSAGE, conversationId: CONVERSATION },
};

describe('createInterruptedGenerationRecorder', () => {
  let mongoServer: MongoMemoryServer;
  let methods: ReturnType<typeof createMethods>;
  let record: InterruptedGenerationRecorder;

  const saveUserMessage = (ctx: { isTemporary?: boolean; expiredAt?: Date } = {}) =>
    methods.saveMessage(
      { userId: USER, ...ctx },
      {
        messageId: USER_MESSAGE,
        conversationId: CONVERSATION,
        parentMessageId: '00000000-0000-0000-0000-000000000000',
        sender: 'User',
        endpoint: 'agents',
        model: 'mock-model',
        text: 'please send the report',
        isCreatedByUser: true,
      },
    );

  const saveReply = (fields: { unfinished: boolean; conversationId?: string }) =>
    methods.saveMessage(
      { userId: USER },
      {
        messageId: REPLY,
        conversationId: CONVERSATION,
        parentMessageId: USER_MESSAGE,
        sender: 'AI',
        text: '',
        content: [{ type: ContentTypes.TEXT, text: 'Here is the first half' }],
        error: false,
        isCreatedByUser: false,
        ...fields,
      },
    );

  const getReply = () => methods.getMessage({ user: USER, messageId: REPLY });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    createModels(mongoose);
    methods = createMethods(mongoose);
    record = createInterruptedGenerationRecorder(methods);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.dropDatabase();
  });

  it('closes a saved partial reply with an interrupted error and keeps its content', async () => {
    await saveUserMessage();
    await saveReply({ unfinished: true });

    await record(job);

    const reply = await getReply();
    expect(reply?.unfinished).toBe(false);
    expect(reply?.error).toBe(false);
    expect(reply?.content).toEqual([
      { type: ContentTypes.TEXT, text: 'Here is the first half' },
      { type: ContentTypes.ERROR, error: INTERRUPTED_GENERATION_ERROR },
    ]);
    expect(INTERRUPTED_GENERATION_ERROR).toContain(
      JSON.stringify({ type: ErrorTypes.GENERATION_INTERRUPTED }),
    );
  });

  it('saves an interrupted reply when the turn has none, under the user message', async () => {
    const expiredAt = new Date(Date.now() + 60_000);
    await saveUserMessage({ isTemporary: true, expiredAt });

    await record(job);

    const reply = await getReply();
    expect(reply).toMatchObject({
      conversationId: CONVERSATION,
      parentMessageId: USER_MESSAGE,
      isCreatedByUser: false,
      unfinished: false,
      error: false,
      endpoint: 'agents',
      model: 'mock-model',
      isTemporary: true,
      content: [{ type: ContentTypes.ERROR, error: INTERRUPTED_GENERATION_ERROR }],
    });
    expect(reply?.expiredAt).toEqual(expiredAt);
  });

  it('leaves a reply that already settled untouched', async () => {
    await saveUserMessage();
    await saveReply({ unfinished: false });

    await record(job);

    const reply = await getReply();
    expect(reply?.content).toEqual([{ type: ContentTypes.TEXT, text: 'Here is the first half' }]);
  });

  it('marks a reply once when two sweeps record it together', async () => {
    await saveUserMessage();
    await saveReply({ unfinished: true });

    await Promise.all([record(job), record(job)]);
    await record(job);

    expect((await getReply())?.content).toHaveLength(2);
  });

  it('writes nothing when the turn was never saved', async () => {
    await record(job);

    expect(await getReply()).toBeNull();
  });

  it('does not touch a row of the same id in another conversation', async () => {
    await saveUserMessage();
    await saveReply({ unfinished: true });

    await record({ ...job, conversationId: '0b7a55f4-58a5-4c2c-8a4e-6c8f6f1f2a22' });

    expect((await getReply())?.unfinished).toBe(true);
  });

  it('throws when the record cannot be written', async () => {
    const failing = createInterruptedGenerationRecorder({
      ...methods,
      closeUnfinishedMessage: () => Promise.reject(new Error('database unavailable')),
    });

    await expect(failing(job)).rejects.toThrow('database unavailable');
  });
});

describe('InMemoryJobStore interrupted generation record', () => {
  const makeStale = async (store: InMemoryJobStore, streamId: string) => {
    await store.createJob(streamId, USER, streamId);
    await store.updateJob(streamId, { createdAt: Date.now() - 5000 });
  };

  it('records a stale running job while it still exists, then deletes it', async () => {
    const store = new InMemoryJobStore({ ttlAfterComplete: 0, staleJobTimeout: 1000 });
    await store.initialize();
    await makeStale(store, 's1');
    const seen: boolean[] = [];
    const recorder = jest.fn(async () => {
      seen.push(await store.hasJob('s1'));
    });
    store.setInterruptedGenerationRecorder(recorder);

    expect(await store.cleanup()).toBe(1);

    expect(recorder).toHaveBeenCalledTimes(1);
    expect(recorder).toHaveBeenCalledWith(
      expect.objectContaining({ streamId: 's1', userId: USER }),
    );
    expect(seen).toEqual([true]);
    expect(await store.hasJob('s1')).toBe(false);
    await store.destroy();
  });

  it('keeps the job when the record fails and retries on the next sweep', async () => {
    const store = new InMemoryJobStore({ ttlAfterComplete: 0, staleJobTimeout: 1000 });
    await store.initialize();
    await makeStale(store, 's1');
    const recorder = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue(undefined);
    store.setInterruptedGenerationRecorder(recorder);

    expect(await store.cleanup()).toBe(0);
    expect(await store.hasJob('s1')).toBe(true);

    expect(await store.cleanup()).toBe(1);
    expect(await store.hasJob('s1')).toBe(false);
    expect(recorder).toHaveBeenCalledTimes(2);
    await store.destroy();
  });

  it('keeps a job that became active while its record was written', async () => {
    const store = new InMemoryJobStore({ ttlAfterComplete: 0, staleJobTimeout: 1000 });
    await store.initialize();
    await makeStale(store, 's1');
    store.setInterruptedGenerationRecorder(async () => {
      await store.updateJob('s1', { lastActiveAt: Date.now() });
    });

    expect(await store.cleanup()).toBe(0);
    expect(await store.hasJob('s1')).toBe(true);
    await store.destroy();
  });

  it('does not record a job that is not stale', async () => {
    const store = new InMemoryJobStore({ ttlAfterComplete: 0, staleJobTimeout: 1000 });
    await store.initialize();
    await store.createJob('s1', USER, 's1');
    const recorder = jest.fn(async () => undefined);
    store.setInterruptedGenerationRecorder(recorder);

    expect(await store.cleanup()).toBe(0);

    expect(recorder).not.toHaveBeenCalled();
    await store.destroy();
  });
});
