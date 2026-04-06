---
layout: default
title: Privacy Policy - Dwella
permalink: /privacy-policy
---

# Privacy Policy

**Version 1.0** | **Effective Date: {EFFECTIVE_DATE}** | **Last Updated: {EFFECTIVE_DATE}**

Dwella is a rental property management app for landlords and tenants. This Privacy Policy explains what personal data we collect, why we collect it, how we use and protect it, and what rights you have over your data. We are committed to transparency and to complying with applicable data protection laws, including the EU General Data Protection Regulation (GDPR), the Indian Digital Personal Data Protection Act 2023 (DPDP Act), and the California Consumer Privacy Act as amended by the California Privacy Rights Act (CCPA/CPRA).

**Contents:**
1. [Data Controller](#1-data-controller)
2. [Data Protection Officer](#2-data-protection-officer)
3. [Information We Collect](#3-information-we-collect)
4. [Legitimate Interests](#4-legitimate-interests)
5. [Sub-Processors and Recipients](#5-sub-processors-and-recipients)
6. [International Data Transfers](#6-international-data-transfers)
7. [Retention Periods](#7-retention-periods)
8. [Your Rights](#8-your-rights)
9. [Right to Withdraw Consent](#9-right-to-withdraw-consent)
10. [Right to Complain](#10-right-to-complain)
11. [Statutory and Contractual Requirements](#11-statutory-and-contractual-requirements)
12. [Automated Decision-Making](#12-automated-decision-making)
13. [Cookies and Tracking Technologies](#13-cookies-and-tracking-technologies)
14. [Children's Privacy](#14-childrens-privacy)
15. [Changes to This Policy](#15-changes-to-this-policy)
16. [For Users in India (DPDP Act 2023)](#16-for-users-in-india-dpdp-act-2023)
17. [For Users in California (CCPA/CPRA)](#17-for-users-in-california-ccpacpra)
18. [Contact Us](#18-contact-us)

---

## 1. Data Controller

The data controller responsible for your personal data is:

**{DEVELOPER_NAME}**
Email: {DEVELOPER_EMAIL}
Address: Aizawl, Mizoram, India

As the data controller, {DEVELOPER_NAME} determines the purposes and means of processing your personal data in connection with the Dwella application.

## 2. Data Protection Officer

Dwella is operated by a sole individual developer. Under GDPR Article 37, the appointment of a Data Protection Officer is not required as we do not carry out large-scale systematic monitoring or processing of special categories of data. For all privacy inquiries, contact {DEVELOPER_EMAIL}.

## 3. Information We Collect

We collect the following categories of personal data, each for a specific purpose and on a specific legal basis:

| Data Category | Examples | Purpose | Legal Basis (GDPR) | Retention Period |
|---------------|----------|---------|-------------------|------------------|
| Account/Identity | Email, full name, phone number, avatar image | User authentication and profile management | Art 6(1)(b) performance of contract | Active account + 30 days after deletion |
| Property Data | Property name, address, city, unit count, color, notes | Rental property management (core functionality) | Art 6(1)(b) performance of contract | Active use + 30 days after archival |
| Tenant Data | Tenant name, flat number, monthly rent, security deposit, due day, lease dates, invite status, photo | Tenant management and rent tracking | Art 6(1)(b) performance of contract; Art 6(1)(a) consent for tenant-side users accepting invites | Active use + 30 days after archival |
| Payment/Financial Data | Amount due, amount paid, payment status, proof images, payment dates, confirmation timestamps | Rent payment tracking and receipt generation | Art 6(1)(b) performance of contract; Art 6(1)(c) compliance with legal obligation (tax record-keeping) | 7 years (Indian Income Tax Act, Section 44AA) |
| Bot Conversation Logs | Message content, AI responses, conversation metadata | AI-powered rental management assistance | Art 6(1)(a) explicit consent (AI features require opt-in) | 90 days rolling |
| Notifications | Notification type, title, body, read status | Payment reminders and confirmations | Art 6(1)(b) performance of contract | 90 days |
| Push Tokens | Expo push token (device identifier for APNs/FCM) | Push notification delivery | Art 6(1)(b) performance of contract | Until user logs out or deletes account |

## 4. Legitimate Interests

Our primary legal basis for processing your personal data is the performance of our contract with you (GDPR Article 6(1)(b)) -- that is, providing the Dwella rental management service you signed up for.

We do not rely on legitimate interests (Article 6(1)(f)) as a primary basis for processing. Where legitimate interests may apply -- for example, in maintaining security logs to protect the integrity of our service -- the interest pursued is the security and availability of the application. You have the right to object to processing based on legitimate interests at any time by contacting {DEVELOPER_EMAIL}. We will cease such processing unless we can demonstrate compelling legitimate grounds that override your interests, rights, and freedoms.

## 5. Sub-Processors and Recipients

We share your personal data with the following service providers (sub-processors) who process data on our behalf:

| Processor | Country/Region | Purpose | Data Categories Received | Transfer Basis | DPA Reference |
|-----------|---------------|---------|--------------------------|----------------|---------------|
| Supabase Inc. | Japan (ap-northeast-1, AWS Tokyo) | Backend infrastructure: authentication, database, file storage, edge functions, realtime subscriptions | All user data categories listed above | EU adequacy decision (Japan, 2019) + Standard Contractual Clauses (Supabase DPA) | [Supabase DPA](https://supabase.com/legal/dpa) |
| Anthropic PBC | United States | AI inference for bot features (tenant-context-aware responses) | Tenant context: property names, addresses, cities; tenant names, flat numbers, monthly rent amounts, due days; payment statuses and amounts for current month. **Consent-gated: only for users who opt into AI features.** | Standard Contractual Clauses (Anthropic Commercial Terms) | Incorporated in [Anthropic Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) |
| Telegram | Global (distributed infrastructure) | User-initiated bot messaging channel | Bot messages, Telegram user ID. **User-initiated only: data flows only after user explicitly links a Telegram chat.** | User-initiated transfer (not a systematic data sharing arrangement) | [Telegram Bot Developer Terms](https://telegram.org/tos/bot-developers) |
| Expo (via Apple APNs, Google FCM) | United States (relay to Apple/Google push services) | Push notification delivery for payment reminders and confirmations | Device push tokens, notification content (title and body text) | Standard Contractual Clauses (Expo Terms of Service) | [Expo Terms](https://expo.dev/terms) |

We do not sell, rent, or trade your personal data to any third party. Data is shared with sub-processors only to the extent necessary to provide the Dwella service.

## 6. International Data Transfers

Your personal data is stored on servers in **Japan (ap-northeast-1, AWS Tokyo, operated by Supabase)**. Japan benefits from an EU adequacy decision (European Commission, January 2019), supplemented by Standard Contractual Clauses incorporated in Supabase's DPA.

For AI features, data is transferred to the **United States (Anthropic)** under Standard Contractual Clauses incorporated in Anthropic's Commercial Terms of Service. This transfer occurs only when you opt into AI bot features.

Push notification tokens are relayed through **Expo's US-based service** to Apple APNs and Google FCM under Standard Contractual Clauses incorporated in Expo's Terms of Service.

Telegram data flows are **user-initiated** -- data is transferred to Telegram's global infrastructure only after you explicitly link your Telegram account to Dwella.

## 7. Retention Periods

We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, or as required by law:

- **Account/Identity data:** Retained while your account is active, plus 30 days after account deletion to allow for recovery.
- **Property and Tenant data:** Retained while actively in use, plus 30 days after archival.
- **Payment/Financial data:** Retained for 7 years from the date of the transaction, in compliance with Indian tax and financial record-keeping requirements (Indian Income Tax Act, Section 44AA).
- **Bot Conversation Logs:** Retained on a 90-day rolling basis. Conversations older than 90 days are automatically deleted.
- **Notifications:** Retained for 90 days, then automatically deleted.
- **Push Tokens:** Retained until you log out or delete your account.

When you delete content within the app, it is initially archived (soft-deleted) and retained for up to 30 days before permanent deletion. You may request immediate permanent deletion by contacting {DEVELOPER_EMAIL}.

## 8. Your Rights

Under the GDPR, you have the following rights regarding your personal data:

- **Right of Access (Art 15):** You have the right to obtain confirmation of whether your personal data is being processed and, if so, to access that data and receive a copy. You can request a data export from the app settings or by contacting {DEVELOPER_EMAIL}.

- **Right to Rectification (Art 16):** You have the right to have inaccurate personal data corrected. You can update most of your information directly in the app, or contact {DEVELOPER_EMAIL} for assistance.

- **Right to Erasure (Art 17):** You have the right to request the deletion of your personal data. Account deletion is available in the app settings. For immediate permanent deletion (bypassing the 30-day soft-delete period), contact {DEVELOPER_EMAIL}.

- **Right to Restriction of Processing (Art 18):** You have the right to request that we restrict the processing of your personal data in certain circumstances (for example, while we verify the accuracy of contested data). Contact {DEVELOPER_EMAIL} to exercise this right.

- **Right to Data Portability (Art 20):** You have the right to receive your personal data in a structured, commonly used, machine-readable format and to transmit that data to another controller. Data export is available in the app settings or by contacting {DEVELOPER_EMAIL}.

- **Right to Object (Art 21):** You have the right to object to the processing of your personal data where we rely on legitimate interests as the legal basis. Contact {DEVELOPER_EMAIL} to exercise this right.

We will respond to all data subject requests within 30 days. If we need more time (up to an additional 60 days for complex requests), we will inform you of the extension and the reasons for the delay.

## 9. Right to Withdraw Consent

Where we process your data based on consent (specifically: AI bot features and tenant-side data sharing via invites), you have the right to withdraw consent at any time. Withdrawing consent does not affect the lawfulness of processing carried out before withdrawal.

- **To withdraw consent for AI features:** Disable them in the app settings.
- **To withdraw consent for data sharing as a tenant:** Contact {DEVELOPER_EMAIL}.

## 10. Right to Complain

You have the right to lodge a complaint with your local data protection supervisory authority if you believe your personal data has been processed unlawfully. A list of EU/EEA supervisory authorities is available at [https://edpb.europa.eu/about-edpb/about-edpb/members_en](https://edpb.europa.eu/about-edpb/about-edpb/members_en).

## 11. Statutory and Contractual Requirements

Providing your email address is required to create an account and use Dwella. All other personal data is provided voluntarily. If you do not provide required information, you may not be able to use certain features of the app.

Providing property and tenant information is necessary for the performance of the rental management service. You are not obligated to provide this data, but the core functionality of Dwella depends on it.

## 12. Automated Decision-Making

Dwella uses AI (powered by Anthropic's Claude) to assist with rental management tasks such as logging payments, generating reminders, and answering questions about your properties. The AI provides suggestions and drafts -- it does not make automated decisions that produce legal effects or similarly significant effects on you. All AI-assisted actions require your explicit confirmation before execution.

No profiling that produces legal or similarly significant effects is carried out.

## 13. Cookies and Tracking Technologies

Dwella is a mobile application and does not use cookies. We do not use any third-party analytics SDKs, advertising SDKs, or tracking technologies. No data is collected for advertising purposes.

## 14. Children's Privacy

Dwella is not directed at children under the age of 16. We do not knowingly collect personal data from children. If you believe we have inadvertently collected data from a child, contact {DEVELOPER_EMAIL} and we will promptly delete the data.

## 15. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of material changes through the app or by email. The "Last Updated" date at the top of this policy indicates when it was last revised. Continued use of the app after changes take effect constitutes your acknowledgment of the updated policy.

## 16. For Users in India (DPDP Act 2023)

Under the Digital Personal Data Protection Act, 2023, you have the right to access, correct, and erase your personal data, and to nominate a representative to exercise these rights on your behalf.

### Grievance Officer

For complaints or queries regarding your personal data, contact:

**Grievance Officer:** {DEVELOPER_NAME}
**Email:** {DEVELOPER_EMAIL}

If you are not satisfied with our response, you may complain to the Data Protection Board of India once it is constituted and operational.

### Cross-Border Transfers

Cross-border transfers of your data to Japan and the United States are permitted under Section 16 of the DPDP Act, as no restricted-country list has been notified by the Central Government as of {EFFECTIVE_DATE}.

## 17. For Users in California (CCPA/CPRA)

### Do Not Sell or Share My Personal Information

**Dwella does not sell or share your personal information as defined by the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA). We have not sold or shared personal information in the preceding 12 months.**

### Categories of Personal Information Collected

In the preceding 12 months, we have collected the following categories of personal information as defined by the CCPA:

- **Identifiers:** Name, email address, phone number
- **Financial Information:** Rent amounts, payment records, payment proof images
- **Internet or Other Electronic Network Activity Information:** Bot conversation logs, app usage data
- **Geolocation Data:** Property addresses (as provided by users, not collected automatically)
- **Professional or Employment-Related Information:** Landlord/tenant role data, property management information

### Your California Privacy Rights

As a California resident, you have the following rights:

- **Right to Know:** You may request disclosure of the categories and specific pieces of personal information we have collected about you, the sources of that information, the business purposes for collecting it, and the categories of third parties with whom we share it.
- **Right to Delete:** You may request that we delete your personal information, subject to certain exceptions (such as legal record-keeping obligations).
- **Right to Correct:** You may request that we correct inaccurate personal information.
- **Right to Opt-Out of Sale or Sharing:** Not applicable -- Dwella does not sell or share personal information.
- **Right to Non-Discrimination:** We will not discriminate against you for exercising any of your CCPA rights.

To exercise any of these rights, contact {DEVELOPER_EMAIL}. We will respond to verifiable consumer requests within 45 days.

## 18. Contact Us

If you have any questions about this Privacy Policy or our data practices, please contact:

**{DEVELOPER_NAME}**
Email: {DEVELOPER_EMAIL}
Address: Aizawl, Mizoram, India
