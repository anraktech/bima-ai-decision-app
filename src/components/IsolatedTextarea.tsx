import { useState, useEffect, memo } from 'react';

interface IsolatedTextareaProps {
  initialValue: string;
  placeholder: string;
  className: string;
  rows: number;
  onChange: (value: string) => void;
}

export const IsolatedTextarea = memo(({ initialValue, placeholder, className, rows, onChange }: IsolatedTextareaProps) => {
  const [value, setValue] = useState(initialValue);

  // Sync internal state when initialValue changes (for reset scenarios)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange(newValue);
  };

  return (
    <textarea
      value={value}
      placeholder={placeholder}
      className={className}
      rows={rows}
      onChange={handleChange}
    />
  );
});