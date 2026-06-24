# [Auth][Password] Reset Password via Email

## Description
- Overview: Users who have forgotten their password can request a unique reset password link via email. This link is valid for 30 minutes and can only be used once. Upon clicking the link, users can set a new password that meets specific strength criteria (minimum 8 characters, at least one uppercase letter, and at least one number).
- Figma: TBD
- PRD / Confluence: TBD
- Postman: TBD
- API contract & path: TBD

## User Acceptance Criteria (UAC)

# 1. SCENARIO: REQUEST RESET PASSWORD LINK SUCCESSFULLY

GIVEN the user is on the "Forgot Password" page,
AND the user enters a registered email address "user@example.com" into the email field,

WHEN the user clicks the "Send Reset Link" button,

THEN a success message "We've sent a password reset link to your email address." is displayed,
AND an email containing a unique reset password link is sent to "user@example.com".

| EN | ID |
|---|---|
| Forgot Password | Lupa Kata Sandi |
| Send Reset Link | Kirim Tautan Reset |
| We've sent a password reset link to your email address. | Kami telah mengirimkan tautan reset kata sandi ke alamat email Anda. |

[image-or-design-ui-from-figma](https://example-image.com)

# 2. SCENARIO: REQUEST RESET PASSWORD LINK FOR UNREGISTERED EMAIL

GIVEN the user is on the "Forgot Password" page,
AND the user enters an unregistered email address "unregistered@example.com" into the email field,

WHEN the user clicks the "Send Reset Link" button,

THEN a success message "We've sent a password reset link to your email address." is displayed (to prevent email enumeration),
AND no password reset email is sent to "unregistered@example.com".

| EN | ID |
|---|---|
| Forgot Password | Lupa Kata Sandi |
| Send Reset Link | Kirim Tautan Reset |
| We've sent a password reset link to your email address. | Kami telah mengirimkan tautan reset kata sandi ke alamat email Anda. |

[image-or-design-ui-from-figma](https://example-image.com)

# 3. SCENARIO: DISPLAY ERROR FOR INVALID EMAIL FORMAT

GIVEN the user is on the "Forgot Password" page,
AND the user enters an invalid email format "invalid-email" into the email field,

WHEN the user clicks the "Send Reset Link" button,

THEN an error message "Please enter a valid email address." is displayed below the email field,
AND no password reset email is sent.

| EN | ID |
|---|---|
| Forgot Password | Lupa Kata Sandi |
| Send Reset Link | Kirim Tautan Reset |
| Please enter a valid email address. | Mohon masukkan alamat email yang valid. |

[image-or-design-ui-from-figma](https://example-image.com)

# 4. SCENARIO: EMAIL CONTENT OF RESET PASSWORD LINK

GIVEN a password reset link has been requested for "user@example.com",

WHEN the user opens the email,

THEN the email subject is "Reset Your Password",
AND the email body contains a clear instruction to click the link to reset the password,
AND the email body contains a unique, clickable link to the password reset page,
AND the email body states the link is valid for 30 minutes.

| EN | ID |
|---|---|
| Reset Your Password | Reset Kata Sandi Anda |
| Hello, <br><br> You recently requested to reset your password for your account. Click the link below to proceed:<br><br> [Reset Password Link] <br><br> This link is valid for 30 minutes. If you did not request a password reset, please ignore this email. <br><br> Thank you, <br> The Team | Halo, <br><br> Anda baru saja meminta untuk mereset kata sandi akun Anda. Klik tautan di bawah ini untuk melanjutkan:<br><br> [Tautan Reset Kata Sandi] <br><br> Tautan ini berlaku selama 30 menit. Jika Anda tidak meminta reset kata sandi, mohon abaikan email ini. <br><br> Terima kasih, <br> Tim |

# 5. SCENARIO: SUCCESSFULLY RESET PASSWORD WITH VALID LINK AND NEW PASSWORD

GIVEN the user has received a valid, unused, unexpired reset password link for "user@example.com",
AND the user clicks the reset password link,
AND the user is on the "Reset Password" page,
AND the user enters a new password "NewPassword123" in the "New Password" field,
AND the user enters "NewPassword123" in the "Confirm New Password" field,

WHEN the user clicks the "Reset Password" button,

THEN the password for "user@example.com" is updated successfully,
AND the user is redirected to the "Login" page,
AND a success message "Your password has been reset successfully. Please log in with your new password." is displayed on the "Login" page.

| EN | ID |
|---|---|
| Reset Password | Reset Kata Sandi |
| New Password | Kata Sandi Baru |
| Confirm New Password | Konfirmasi Kata Sandi Baru |
| Your password has been reset successfully. Please log in with your new password. | Kata sandi Anda berhasil direset. Silakan masuk dengan kata sandi baru Anda. |

[image-or-design-ui-from-figma](https://example-image.com)

# 6. SCENARIO: DISPLAY ERROR WHEN NEW PASSWORD IS TOO SHORT

GIVEN the user is on the "Reset Password" page via a valid link,
AND the user enters a new password "Pass123" (less than 8 characters) in the "New Password" field,
AND the user enters "Pass123" in the "Confirm New Password" field,

WHEN the user clicks the "Reset Password" button,

THEN an error message "Password must be at least 8 characters long." is displayed below the "New Password" field,
AND the password is not updated.

| EN | ID |
|---|---|
| Reset Password | Reset Kata Sandi |
| New Password | Kata Sandi Baru |
| Confirm New Password | Konfirmasi Kata Sandi Baru |
| Password must be at least 8 characters long. | Kata sandi harus minimal 8 karakter. |

[image-or-design-ui-from-figma](https://example-image.com)

# 7. SCENARIO: DISPLAY ERROR WHEN NEW PASSWORD LACKS UPPERCASE CHARACTER

GIVEN the user is on the "Reset Password" page via a valid link,
AND the user enters a new password "password123" (no uppercase) in the "New Password" field,
AND the user enters "password123" in the "Confirm New Password" field,

WHEN the user clicks the "Reset Password" button,

THEN an error message "Password must contain at least one uppercase letter." is displayed below the "New Password" field,
AND the password is not updated.

| EN | ID |
|---|---|
| Reset Password | Reset Kata Sandi |
| New Password | Kata Sandi Baru |
| Confirm New Password | Konfirmasi Kata Sandi Baru |
| Password must contain at least one uppercase letter. | Kata sandi harus mengandung setidaknya satu huruf kapital. |

[image-or-design-ui-from-figma](https://example-image.com)

# 8. SCENARIO: DISPLAY ERROR WHEN NEW PASSWORD LACKS NUMBER

GIVEN the user is on the "Reset Password" page via a valid link,
AND the user enters a new password "PasswordABC" (no number) in the "New Password" field,
AND the user enters "PasswordABC" in the "Confirm New Password" field,

WHEN the user clicks the "Reset Password" button,

THEN an error message "Password must contain at least one number." is displayed below the "New Password" field,
AND the password is not updated.

| EN | ID |
|---|---|
| Reset Password | Reset Kata Sandi |
| New Password | Kata Sandi Baru |
| Confirm New Password | Konfirmasi Kata Sandi Baru |
| Password must contain at least one number. | Kata sandi harus mengandung setidaknya satu angka. |

[image-or-design-ui-from-figma](https://example-image.com)

# 9. SCENARIO: DISPLAY ERROR WHEN NEW PASSWORD AND CONFIRM PASSWORD DO NOT MATCH

GIVEN the user is on the "Reset Password" page via a valid link,
AND the user enters "NewPassword123" in the "New Password" field,
AND the user enters "Mismatch123" in the "Confirm New Password" field,

WHEN the user clicks the "Reset Password" button,

THEN an error message "New password and confirm password do not match." is displayed below the "Confirm New Password" field,
AND the password is not updated.

| EN | ID |
|---|---|
| Reset Password | Reset Kata Sandi |
| New Password | Kata Sandi Baru |
| Confirm New Password | Konfirmasi Kata Sandi Baru |
| New password and confirm password do not match. | Kata sandi baru dan konfirmasi kata sandi tidak cocok. |

[image-or-design-ui-from-figma](https://example-image.com)

# 10. SCENARIO: DISPLAY ERROR WHEN RESET PASSWORD LINK IS EXPIRED

GIVEN a password reset link was sent to "user@example.com",
AND 31 minutes have passed since the link was sent (making the link expired),

WHEN the user clicks the expired reset password link,

THEN the user is redirected to an error page or a specific "Link Expired" page,
AND a message "This password reset link has expired. Please request a new one." is displayed.

| EN | ID |
|---|---|
| This password reset link has expired. Please request a new one. | Tautan reset kata sandi ini telah kedaluwarsa. Mohon minta tautan baru. |

[image-or-design-ui-from-figma](https://example-image.com)

# 11. SCENARIO: DISPLAY ERROR WHEN RESET PASSWORD LINK IS ALREADY USED

GIVEN a password reset link for "user@example.com" has been successfully used once,

WHEN the user attempts to click the same reset password link again,

THEN the user is redirected to an error page or a specific "Link Used" page,
AND a message "This password reset link has already been used. Please request a new one if you need to reset your password again." is displayed.

| EN | ID |
|---|---|
| This password reset link has already been used. Please request a new one if you need to reset your password again. | Tautan reset kata sandi ini telah digunakan. Mohon minta tautan baru jika Anda perlu mereset kata sandi Anda lagi. |

[image-or-design-ui-from-figma](https://example-image.com)

# 12. SCENARIO: DISPLAY ERROR FOR INVALID OR MALFORMED RESET PASSWORD LINK

GIVEN the user attempts to access a malformed or non-existent reset password link (e.g., manually typing an incorrect URL),

WHEN the user navigates to the invalid link,

THEN the user is redirected to an error page or a specific "Invalid Link" page,
AND a message "This password reset link is invalid. Please ensure you copied the link correctly or request a new one." is displayed.

| EN | ID |
|---|---|
| This password reset link is invalid. Please ensure you copied the link correctly or request a new one. | Tautan reset kata sandi ini tidak valid. Mohon pastikan Anda menyalin tautan dengan benar atau minta tautan baru. |

[image-or-design-ui-from-figma](https://example-image.com)

# 13. SCENARIO: LOADING STATE WHEN REQUESTING RESET LINK

GIVEN the user is on the "Forgot Password" page,
AND the user enters a registered email address,

WHEN the user clicks the "Send Reset Link" button,

THEN the "Send Reset Link" button is disabled,
AND a loading indicator (e.g., spinner) is displayed on or near the button,
AND the loading indicator disappears and the button becomes enabled once the request is complete.

| EN | ID |
|---|---|
| Forgot Password | Lupa Kata Sandi |
| Send Reset Link | Kirim Tautan Reset |

[image-or-design-ui-from-figma](https://example-image.com)

# 14. SCENARIO: LOADING STATE WHEN SUBMITTING NEW PASSWORD

GIVEN the user is on the "Reset Password" page via a valid link,
AND the user has entered valid new password details,

WHEN the user clicks the "Reset Password" button,

THEN the "Reset Password" button is disabled,
AND a loading indicator (e.g., spinner) is displayed on or near the button,
AND the loading indicator disappears and the button becomes enabled once the request is complete (or user is redirected).

| EN | ID |
|---|---|
| Reset Password | Reset Kata Sandi |

[image-or-design-ui-from-figma](https://example-image.com)
