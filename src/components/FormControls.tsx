import type { ReactNode } from "react";

interface BaseFieldProps {
  label: string;
  className?: string;
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
}

export function Field({ label, className, children }: BaseFieldProps & { children: ReactNode }) {
  return (
    <label className={`field-shell ${className ?? ""}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ label, value, onChange, type = "text", placeholder, className }: TextInputProps) {
  return (
    <Field label={label} className={className}>
      <input
        className="field-input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

export function SelectField({ label, value, placeholder, options, onChange, className }: SelectFieldProps) {
  return (
    <Field label={label} className={className}>
      <select
        className="field-input"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
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

export function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="toggle-shell">
      <input
        className=""
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-label">{label}</span>
    </label>
  );
}
