import { useEffect, useState, type InputHTMLAttributes } from 'react';

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
};

/**
 * Number field that keeps its own text while typing (so "", "1." etc. are allowed)
 * and commits a clean number to the parent.
 */
export function NumberInput({ value, onChange, prefix = '$', suffix, className, ...rest }: NumberInputProps) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // Only resync when the external value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`num-input ${className ?? ''}`}>
      {prefix && <span className="affix">{prefix}</span>}
      <input
        inputMode="decimal"
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.]/g, '');
          setText(t);
          const n = parseFloat(t);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        onBlur={() => setText(String(value))}
        {...rest}
      />
      {suffix && <span className="affix">{suffix}</span>}
    </span>
  );
}
