# JIRA Ticket Description Template

A standard structure for writing JIRA ticket titles and descriptions.

## Title

**Pattern:** `[feature_name_in_app][sub_feature_name] short_description`

**Examples:**

- `[Login] Integration`
- `[Home][Notification] Mark notification as read`

## Body

### Description

A short overview of the ticket and links to all related resources:

- Short description of the ticket (optional)
- Figma link
- PRD / Confluence link, or other related links
- Postman link
- API contract and API path

### User Acceptance Criteria (UAC)

The steps, conditions, and key considerations that must be met for the task to be
considered complete. Write each scenario in **Given / When / Then** (Gherkin) form.

#### Example — Referral Menu UAC

```markdown
# 1. ENTRY POINT TO REFERRAL MENU FOR A VERIFIED USER

GIVEN the user has already created an account in MyHero,
AND the user is currently logged in,
AND the user has successfully completed KYC verification,
AND the user navigates to the profile bottom tab,
AND the user can see the referral menu in the list,
WHEN the user taps the referral menu,
THEN the user is navigated to the Referral page,
AND the page loads the user's personal referral code and rewards summary.

[image-or-design-ui-from-figma](https://example-image.com)

# 2. ENTRY POINT TO REFERRAL MENU FOR A NON-LOGGED-IN USER

GIVEN the user is not logged in,
AND the user navigates to the profile bottom tab,
AND the user can see the referral menu in the list,
WHEN the user taps the referral menu,
THEN a bottom sheet is displayed with the copy shown below,
AND the user can see two buttons labeled "Register" and "Login".

| EN | ID |
|---|---|
| To continue with this menu, please log in or register first. | Untuk melanjutkan menu tersebut, harap masuk atau lakukan registrasi terlebih dahulu |

WHEN the user taps the "Login" button,
THEN the user is navigated to the Login page.

WHEN the user taps the "Register" button,
THEN the user is navigated to the Registration page.

[image-or-design-ui-from-figma](https://example-image.com)

# 3. ENTRY POINT TO REFERRAL MENU FOR A NON-VERIFIED USER

GIVEN the user has already created an account in MyHero,
AND the user is currently logged in,
AND the user has not yet completed KYC verification,
AND the user navigates to the profile bottom tab,
AND the user can see the referral menu in the list,
WHEN the user taps the referral menu,
THEN a bottom sheet is displayed prompting the user to complete KYC verification,
AND the user can see a button labeled "Verify Now".

| EN | ID |
|---|---|
| Please complete your identity verification to access the referral program. | Harap selesaikan verifikasi identitas Anda untuk mengakses program referral. |

WHEN the user taps the "Verify Now" button,
THEN the user is navigated to the KYC verification flow.

[image-or-design-ui-from-figma](https://example-image.com)

# 4. LOADING STATE ON THE REFERRAL PAGE

GIVEN the user has navigated to the Referral page,
WHEN the page is still fetching data from the API,
THEN a shimmering skeleton placeholder is displayed in place of the referral code and rewards summary,
AND the shimmer animation runs continuously until the request completes.

WHEN the API request succeeds,
THEN the shimmering placeholder is replaced with the actual referral content.

[image-or-design-ui-from-figma](https://example-image.com)

# 5. ERROR HANDLING ON THE REFERRAL PAGE

GIVEN the user has navigated to the Referral page,
AND the page has attempted to fetch data from the API,
WHEN the API request fails (for example, due to a network error or a server error),
THEN the shimmering placeholder is removed,
AND an error state is displayed with the copy shown below,
AND the user can see a button labeled "Retry".

| EN | ID |
|---|---|
| Something went wrong. Please try again. | Terjadi kesalahan. Silakan coba lagi. |

WHEN the user taps the "Retry" button,
THEN the shimmering loading state is shown again,
AND the page re-attempts to fetch the referral data.

[image-or-design-ui-from-figma](https://example-image.com)
```

note: example UAC above need to be converted to JIRA style.
