import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolCallInfo from '~/components/Chat/Messages/Content/ToolCallInfo';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const translations: Record<string, string> = {
      com_ui_parameters: 'Parameters',
      com_ui_tool_looked_up: 'What was looked up',
      com_ui_tool_show_raw: 'Show raw data',
      com_ui_tool_sent: 'What was sent',
      com_ui_details: 'Details',
    };
    return translations[key] || key;
  },
  useExpandCollapse: (isExpanded: boolean) => ({
    style: {
      display: 'grid',
      gridTemplateRows: isExpanded ? '1fr' : '0fr',
      opacity: isExpanded ? 1 : 0,
    },
    ref: { current: null },
  }),
}));

jest.mock('../ToolOutput', () => ({
  OutputRenderer: ({ text }: { text: string }) => <div data-testid="output-renderer">{text}</div>,
}));

jest.mock('~/utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('lucide-react', () => ({
  ChevronDown: () => <span aria-hidden="true" />,
}));

describe('ToolCallInfo', () => {
  const baseProps = { input: '{"query": "test"}' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('output rendering', () => {
    it('renders output text', () => {
      render(<ToolCallInfo {...baseProps} output="Some output" />);
      expect(screen.getByTestId('output-renderer').textContent).toBe('Some output');
    });

    it('renders nothing when output is absent', () => {
      render(<ToolCallInfo {...baseProps} />);
      expect(screen.queryByTestId('output-renderer')).not.toBeInTheDocument();
    });

    it('renders null output without crashing', () => {
      render(<ToolCallInfo {...baseProps} output={null} />);
      expect(screen.queryByTestId('output-renderer')).not.toBeInTheDocument();
    });
  });

  describe('parameters toggle', () => {
    it('shows toggle when input has JSON content', () => {
      render(<ToolCallInfo {...baseProps} output="output" />);
      expect(screen.getByText('Parameters')).toBeInTheDocument();
    });

    it('hides toggle when input is empty', () => {
      render(<ToolCallInfo input="" output="output" />);
      expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    });

    it('hides toggle when input is whitespace only', () => {
      render(<ToolCallInfo input="   " output="output" />);
      expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    });

    it('toggles expanded state when clicked', () => {
      render(<ToolCallInfo {...baseProps} output="output" />);
      const button = screen.getByText('Parameters').closest('button')!;
      expect(button).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('plain mode', () => {
    const input = '{"min_days_overdue": 60, "clinic_name": "Richmond"}';
    const info = {
      description: '',
      parameters: { properties: { clinic_name: { title: 'Clinic' } } },
    };

    it('labels a lookup by schema title or humanised key, without the Parameters toggle', () => {
      render(<ToolCallInfo input={input} output='{"rows": 3}' wording="lookup" info={info} />);
      expect(screen.getByText('What was looked up')).toBeInTheDocument();
      expect(screen.getByText('Min days overdue')).toBeInTheDocument();
      expect(screen.getByText('Clinic')).toBeInTheDocument();
      expect(screen.getByText('Richmond')).toBeInTheDocument();
      expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
      expect(screen.queryByText(/min_days_overdue|\{/)).not.toBeInTheDocument();
    });

    it('keeps a lookup output collapsed behind Show raw data', () => {
      render(<ToolCallInfo input={input} output='{"rows": 3}' wording="lookup" info={info} />);
      const toggle = screen.getByText('Show raw data').closest('button')!;
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull();
      expect(screen.queryByTestId('output-renderer')).not.toBeInTheDocument();
      fireEvent.click(toggle);
      expect(screen.getByTestId('output-renderer').textContent).toBe('{"rows": 3}');
    });

    it('shows a send output inline under sent wording', () => {
      render(<ToolCallInfo input={input} output="Sent" wording="send" info={info} />);
      expect(screen.getByText('What was sent')).toBeInTheDocument();
      expect(screen.getByTestId('output-renderer').textContent).toBe('Sent');
      expect(screen.queryByText('Show raw data')).not.toBeInTheDocument();
    });

    it('uses neutral wording for other tools', () => {
      render(<ToolCallInfo input={input} output="Done" wording="action" />);
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByTestId('output-renderer').textContent).toBe('Done');
    });

    it('shows a failed lookup output directly', () => {
      render(<ToolCallInfo input={input} output="Timed out" wording="lookup" failed />);
      expect(screen.getByTestId('output-renderer').textContent).toBe('Timed out');
      expect(screen.queryByText('Show raw data')).not.toBeInTheDocument();
    });

    it('falls back to the raw input when the arguments are not an object', () => {
      render(<ToolCallInfo input='{"min_days_ove' wording="lookup" />);
      expect(screen.getByText('{"min_days_ove')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('renders with only input and no output', () => {
      render(<ToolCallInfo {...baseProps} />);
      expect(screen.getByText('Parameters')).toBeInTheDocument();
    });

    it('renders with empty props', () => {
      render(<ToolCallInfo input="" />);
      expect(screen.queryByTestId('output-renderer')).not.toBeInTheDocument();
      expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    });
  });
});
