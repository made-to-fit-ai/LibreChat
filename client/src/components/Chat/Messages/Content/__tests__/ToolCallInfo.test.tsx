import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolCallInfo from '~/components/Chat/Messages/Content/ToolCallInfo';

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => {
    const translations: Record<string, string> = {
      com_ui_parameters: 'Parameters',
      com_ui_tool_looked_up: 'What was looked up',
      com_ui_tool_show_raw: 'Show raw data',
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
  isError: (text: string) => text.startsWith('Error'),
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

    it('labels arguments by schema title or humanised key, without the Parameters toggle', () => {
      render(<ToolCallInfo input={input} output='{"rows": 3}' plain info={info} />);
      expect(screen.getByText('What was looked up')).toBeInTheDocument();
      expect(screen.getByText('Min days overdue')).toBeInTheDocument();
      expect(screen.getByText('Clinic')).toBeInTheDocument();
      expect(screen.getByText('Richmond')).toBeInTheDocument();
      expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
      expect(screen.queryByText(/min_days_overdue|\{/)).not.toBeInTheDocument();
    });

    it('keeps the raw output collapsed behind Show raw data', () => {
      render(<ToolCallInfo input={input} output='{"rows": 3}' plain info={info} />);
      const toggle = screen.getByText('Show raw data').closest('button')!;
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('output-renderer')).not.toBeInTheDocument();
      fireEvent.click(toggle);
      expect(screen.getByTestId('output-renderer').textContent).toBe('{"rows": 3}');
    });

    it('shows an error output directly', () => {
      render(<ToolCallInfo input={input} output="Error: timed out" plain />);
      expect(screen.getByTestId('output-renderer').textContent).toBe('Error: timed out');
      expect(screen.queryByText('Show raw data')).not.toBeInTheDocument();
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
