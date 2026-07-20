/**
 * Shared Password Complexity Validator
 * Ensures consistent password validation rules between frontend and backend.
 */

export function validatePasswordComplexity(password) {
  if (!password) {
    return {
      isValid: false,
      message: "Password is required."
    };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters long."
    };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      message: "Password must not exceed 128 characters."
    };
  }

  let categoriesCount = 0;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (hasUpper) categoriesCount++;
  if (hasLower) categoriesCount++;
  if (hasDigit) categoriesCount++;
  if (hasSpecial) categoriesCount++;

  if (categoriesCount < 3) {
    return {
      isValid: false,
      message: "Password must contain characters from at least three of the following categories: uppercase letters (A-Z), lowercase letters (a-z), numbers (0-9), and special characters."
    };
  }

  return {
    isValid: true,
    message: ""
  };
}
