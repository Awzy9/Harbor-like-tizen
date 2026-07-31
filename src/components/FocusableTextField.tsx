import { useRef } from "react";
import { useFocusable } from "@/navigation/useFocusable";
import "./FocusableTextField.css";

interface FocusableTextFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  type?: "text" | "email" | "password";
}

/**
 * A remote-navigable text field: Enter on the (virtually) focused tile gives
 * the underlying <input> real DOM focus, which is what makes Samsung's
 * on-screen keyboard appear on a real TV. Once the input has real focus,
 * FocusManager gets out of the way of arrow-key/Enter handling (see
 * src/navigation/FocusManager.tsx) so normal text editing works; Back exits
 * the field back to spatial navigation.
 */
export function FocusableTextField({ id, value, onChange, onSubmit, placeholder, autoFocus, type = "text" }: FocusableTextFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { ref, focused } = useFocusable<HTMLDivElement>({
    id,
    autoFocus,
    onEnter: () => inputRef.current?.focus(),
  });

  return (
    <div ref={ref} className={`focusable-text-field ${focused ? "is-focused" : ""}`}>
      <input
        ref={inputRef}
        type={type}
        className="focusable-text-field__input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit?.();
          }
        }}
      />
    </div>
  );
}
