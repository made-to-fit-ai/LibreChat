import { ContentTypes } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import {
  buildArgumentRows,
  findDraftPreview,
  formatArgumentValue,
  friendlyToolTitle,
  humaniseFieldName,
  humaniseToolName,
  indexFriendlyTools,
  isDraftProducingTool,
  parseToolOutput,
  stripMCPSuffix,
} from '../friendly';

const labels = { yes: 'Yes', no: 'No', none: 'None' };

describe('humaniser', () => {
  test('strips the MCP suffix and capitalises the first word', () => {
    expect(stripMCPSuffix('email_send_client_email_mcp_workbench')).toBe('email_send_client_email');
    expect(humaniseToolName('email_send_client_email_mcp_workbench')).toBe(
      'Email send client email',
    );
    expect(humaniseToolName('xero_send_invoice')).toBe('Xero send invoice');
    expect(humaniseToolName('_mcp_server')).toBe('Mcp server');
  });

  test('prefers the MCP title, then the annotation title, then the humanised name', () => {
    expect(
      friendlyToolTitle('email_send_client_email_mcp_workbench', { title: 'Send client email' }),
    ).toBe('Send client email');
    expect(
      friendlyToolTitle('email_send_client_email_mcp_workbench', {
        annotations: { title: 'Send client email' },
      }),
    ).toBe('Send client email');
    expect(friendlyToolTitle('email_send_client_email_mcp_workbench', { title: '  ' })).toBe(
      'Email send client email',
    );
    expect(friendlyToolTitle('email_send_client_email_mcp_workbench')).toBe(
      'Email send client email',
    );
  });

  test('humanises field names', () => {
    expect(humaniseFieldName('draft_id')).toBe('Draft id');
    expect(humaniseFieldName('due_date')).toBe('Due date');
  });
});

describe('argument formatter', () => {
  test('formats booleans, numbers, dates, ids and empties', () => {
    expect(formatArgumentValue(true, labels)).toEqual({ value: 'Yes', kind: 'text' });
    expect(formatArgumentValue(false, labels)).toEqual({ value: 'No', kind: 'text' });
    expect(formatArgumentValue(1234.5, labels)).toEqual({ value: '1,234.5', kind: 'text' });
    expect(formatArgumentValue('2026-10-28', labels)).toEqual({
      value: '28 October 2026',
      kind: 'text',
    });
    expect(formatArgumentValue('d_8f3a2c', labels)).toEqual({ value: 'd_8f3a2c', kind: 'code' });
    expect(formatArgumentValue('3f2b9c1e-5d6a-4b7c-8e9f-0a1b2c3d4e5f', labels)).toEqual({
      value: '3f2b9c1e-5d6a-4b7c-8e9f-0a1b2c3d4e5f',
      kind: 'code',
    });
    expect(formatArgumentValue(null, labels)).toEqual({ value: 'None', kind: 'empty' });
    expect(formatArgumentValue('', labels)).toEqual({ value: 'None', kind: 'empty' });
    expect(formatArgumentValue('Please send this today.', labels)).toEqual({
      value: 'Please send this today.',
      kind: 'text',
    });
    expect(formatArgumentValue({ a: 1 }, labels)).toEqual({ value: '{"a":1}', kind: 'code' });
  });

  test('labels rows from the schema description, else the humanised field name', () => {
    const rows = buildArgumentRows(
      { draft_id: 'd_8f3a2c', note: 'Looks good', send_copy: true, cc: undefined },
      {
        parameters: {
          type: 'object',
          properties: {
            draft_id: { type: 'string', description: 'The draft id returned by a draft_ tool.' },
          },
        },
      },
      labels,
    );
    expect(rows).toEqual([
      {
        key: 'draft_id',
        label: 'The draft id returned by a draft_ tool',
        value: 'd_8f3a2c',
        kind: 'code',
      },
      { key: 'note', label: 'Note', value: 'Looks good', kind: 'text' },
      { key: 'send_copy', label: 'Send copy', value: 'Yes', kind: 'text' },
    ]);
  });

  test('accepts JSON string arguments and rejects non-objects', () => {
    expect(buildArgumentRows('{"draft_id":"d_1"}', undefined, labels)).toEqual([
      { key: 'draft_id', label: 'Draft id', value: 'd_1', kind: 'code' },
    ]);
    expect(buildArgumentRows('[1]', undefined, labels)).toEqual([]);
    expect(buildArgumentRows('not json', undefined, labels)).toEqual([]);
  });
});

describe('draft preview', () => {
  const draftOutput = JSON.stringify({
    ok: true,
    data: {
      draft_id: 'd_8f3a2c',
      title: 'Email to Ethan Jansen: September quarter BAS',
      subject: 'September quarter BAS',
      to_name: 'Ethan Jansen',
      due_date: '2026-10-28',
      amount: 1540,
      internal: { nested: true },
    },
  });

  function message(name: string, output: string | undefined): TMessage {
    return {
      messageId: `m-${name}`,
      conversationId: 'c-1',
      text: '',
      content: [
        { type: ContentTypes.TEXT, text: 'hello' },
        { type: ContentTypes.TOOL_CALL, tool_call: { name, args: {}, output } },
      ],
    } as unknown as TMessage;
  }

  test('recognises draft-producing tools', () => {
    expect(isDraftProducingTool('email_draft_client_email_mcp_workbench')).toBe(true);
    expect(isDraftProducingTool('drafts_get_draft_mcp_workbench')).toBe(true);
    expect(isDraftProducingTool('email_send_client_email_mcp_workbench')).toBe(false);
  });

  test('parses plain and wrapped JSON output', () => {
    expect(parseToolOutput('{"a":1}')).toEqual({ a: 1 });
    expect(parseToolOutput('Result:\n{"a":1}\n')).toEqual({ a: 1 });
    expect(parseToolOutput('[1]')).toBeUndefined();
    expect(parseToolOutput(undefined)).toBeUndefined();
  });

  test('finds the latest matching draft result and keeps only known keys', () => {
    const messages = [
      message('email_draft_client_email_mcp_workbench', draftOutput),
      message('email_send_client_email_mcp_workbench', '{"data":{"draft_id":"d_8f3a2c"}}'),
      message(
        'drafts_get_draft_mcp_workbench',
        JSON.stringify({ data: { draft_id: 'd_other', title: 'Other' } }),
      ),
    ];
    expect(findDraftPreview(messages, 'd_8f3a2c')).toEqual({
      draftId: 'd_8f3a2c',
      toolName: 'email_draft_client_email',
      fields: [
        { key: 'title', value: 'Email to Ethan Jansen: September quarter BAS' },
        { key: 'subject', value: 'September quarter BAS' },
        { key: 'to_name', value: 'Ethan Jansen' },
        { key: 'amount', value: '1,540' },
        { key: 'due_date', value: '28 October 2026' },
      ],
    });
    expect(findDraftPreview(messages, 'd_missing')).toBeUndefined();
    expect(findDraftPreview(messages, undefined)).toBeUndefined();
    expect(findDraftPreview(undefined, 'd_8f3a2c')).toBeUndefined();
  });

  test('indexes the MCP catalog by runtime name', () => {
    const index = indexFriendlyTools({
      workbench: {
        tools: [
          {
            name: 'email_send_client_email',
            pluginKey: 'email_send_client_email_mcp_workbench',
            description: 'Send a drafted client email.',
            title: 'Send client email',
          },
        ],
      },
    });
    expect(index.get('email_send_client_email_mcp_workbench')).toEqual({
      title: 'Send client email',
      description: 'Send a drafted client email.',
      annotations: undefined,
      parameters: undefined,
    });
  });
});
