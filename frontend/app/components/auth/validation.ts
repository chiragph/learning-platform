export type AuthMode = "login" | "register";
export type FieldName = "name" | "email" | "password" | "confirmPassword";
export type AuthValues = Record<FieldName, string>;
export type AuthErrors = Partial<Record<FieldName, string>>;

export function validateAuth(values: AuthValues, mode: AuthMode): AuthErrors {
  const errors: AuthErrors = {};
  if (mode === "register" && values.name.trim().length < 2) {
    errors.name = "Enter your full name (at least 2 characters).";
  }
  if (mode === "register" && values.name.trim().length > 100) errors.name = "Use no more than 100 characters for your name.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address, such as you@example.com.";
  }
  if (values.email.trim().length > 254) errors.email = "Use no more than 254 characters for your email address.";
  if (!values.password) errors.password = "Enter your password.";
  else if (mode === "register" && values.password.length < 8) {
    errors.password = "Use at least 8 characters for your password.";
  }
  if (values.password.length > 1024) errors.password = "Use no more than 1024 characters for your password.";
  if (mode === "register") {
    if (!values.confirmPassword) errors.confirmPassword = "Confirm your password.";
    else if (values.confirmPassword !== values.password) errors.confirmPassword = "Your passwords do not match.";
  }
  return errors;
}
