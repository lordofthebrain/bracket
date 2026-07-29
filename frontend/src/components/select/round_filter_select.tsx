import { ActionIcon, Group, Select } from '@mantine/core';
import { useTranslation } from 'react-i18next';

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function RoundFilterSelect({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  style?: React.CSSProperties;
}) {
  const { t } = useTranslation();

  if (options.length < 1) return null;

  const currentIndex = options.findIndex((option) => option.value === value);

  return (
    <Group gap={0} wrap="nowrap" align="center" style={style}>
      <ActionIcon
        variant="default"
        size={36}
        disabled={currentIndex <= 0}
        onClick={() => onChange(options[currentIndex - 1].value)}
        aria-label={t('previous_round_button')}
        style={{
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          borderRight: 'none',
          borderColor: 'var(--mantine-color-default-border)',
        }}
      >
        <ChevronLeftIcon />
      </ActionIcon>
      <Select
        data={options}
        value={value}
        onChange={onChange}
        allowDeselect={false}
        style={{ flex: 1 }}
        styles={{
          input: {
            borderRadius: 0,
          },
        }}
      />
      <ActionIcon
        variant="default"
        size={36}
        disabled={currentIndex < 0 || currentIndex >= options.length - 1}
        onClick={() => onChange(options[currentIndex + 1].value)}
        aria-label={t('next_round_button')}
        style={{
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          borderLeft: 'none',
          borderColor: 'var(--mantine-color-default-border)',
        }}
      >
        <ChevronRightIcon />
      </ActionIcon>
    </Group>
  );
}
