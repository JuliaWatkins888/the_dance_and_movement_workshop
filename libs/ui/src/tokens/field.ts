// Shared prop contract every input primitive (Input, Select, Switch, Slider, Checkbox,
// RadioGroup, Textarea) extends alongside its own value/color props, so label/required/
// disabled/error/helperText behave identically no matter which control renders them.
export interface FieldProps {
  readonly label?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly error?: boolean;
  readonly helperText?: string;
}
