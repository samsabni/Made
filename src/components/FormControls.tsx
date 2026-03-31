import type { ReactNode } from "react";

interface BaseFieldProps {
  label: string;
  className?: string;
  disabled?: boolean;
}

interface TextInputProps extends BaseFieldProps {
  value: string;
  type?: "text" | "number" | "color";
  placeholder?: string;
  onChange: (value: string) => void;
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends BaseFieldProps {
  value?: string;
  placeholder?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Field({ label, className, children }: BaseFieldProps & { children: ReactNode }) {
  return (
    <label className={`field-shell ${className ?? ""}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  className,
  disabled,
}: TextInputProps) {
  return (
    <Field label={label} className={className} disabled={disabled}>
      <input
        className="field-input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </Field>
  );
}

export function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  className,
  disabled,
}: SelectFieldProps) {
  return (
    <Field label={label} className={className} disabled={disabled}>
      <select
        className="field-input"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">{placeholder ?? "Select…"}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className="toggle-shell">
      <input
        className=""
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
      />
      <span className="toggle-label">{label}</span>
    </label>
  );
}
