export const PRESET_PROMPTS = [
  {
    title: 'US Monthly Bookkeeping & Financial Clean-Up (LLC / S-Corp)',
    category: 'US Accounting & Bookkeeping',
    badge: 'US Bookkeeping',
    description: 'IRS Form W-9, EIN CP 575 verification, 12 months business checking & credit card statements, prior year tax returns (1120/1120-S), and QuickBooks/Xero connection.',
    prompt:
      'Onboard new US corporate bookkeeping client. Collect legal entity name, DBA name, federal tax classification (LLC / S-Corp / C-Corp), state of formation, primary accounting software (QuickBooks Online / Xero), IRS Form W-9, IRS EIN confirmation letter (CP 575 or 147C), last 12 months business bank statements, last 12 months business credit card statements, and prior year corporate tax return (Form 1120 or 1120-S). All financial statements and tax forms require verification. Send reminders 30 days before annual tax filing deadlines.'
  },
  {
    title: 'UK Limited Company Bookkeeping & Year-End Accounts (Companies House & HMRC)',
    category: 'UK Accounting & Bookkeeping',
    badge: 'UK Bookkeeping',
    description: 'Companies House CRN, HMRC Corporation Tax UTR, Memorandum & Articles of Association, 12 months bank statements, and Director KYC identity verification.',
    prompt:
      'Onboard UK private limited company (Ltd) for monthly bookkeeping and annual statutory accounts. Collect registered company name, 8-digit Companies House registration number (CRN), registered office address, primary bookkeeping software (Xero / QuickBooks Online), accounting reference date (year-end), Companies House Certificate of Incorporation, HMRC Corporation Tax UTR confirmation notice, last 12 months UK business bank statements, prior year CT600 tax return and statutory accounts, and Director photo ID with proof of address (< 3 months old). Track 12-month accounting reference expiry and send reminders 30 and 14 days before Companies House filing deadline.'
  },
  {
    title: 'UK VAT Registration & Making Tax Digital (MTD) Compliance',
    category: 'UK VAT & Indirect Tax',
    badge: 'UK VAT (MTD)',
    description: 'HMRC VAT registration certificate (VAT 484), Making Tax Digital (MTD) quarterly filing setup, e-commerce sales reports, and merchant payout summaries.',
    prompt:
      'Collect UK VAT registration certificate (VAT 484), 9-digit VAT registration number, effective date of VAT registration, VAT accounting scheme (Standard Accrual / Flat Rate Scheme / Cash Accounting), last 4 quarters VAT return summaries, digital record-keeping software authorization, and merchant payment gateway statements (Stripe / Shopify Payments / PayPal). Remind client 14 and 7 days prior to quarterly MTD VAT return deadlines.'
  },
  {
    title: 'US Multi-State E-commerce & Sales Tax Intake (Shopify / Amazon / Stripe)',
    category: 'US Sales Tax & E-commerce',
    badge: 'US Sales Tax',
    description: 'Multi-state sales tax nexus review, state resale & exemption certificates, merchant gateway payouts, and inventory asset balance sheets.',
    prompt:
      'Intake for US multi-state e-commerce business selling on Shopify, Amazon, and Walmart. Collect primary operating state, list of physical and economic nexus states, state sales tax permits, resale exemption certificates, Stripe/PayPal monthly merchant payout reports, cost of goods sold (COGS) inventory reports, and bank settlement statements. State sales tax exemption certificates require annual expiry tracking. Administrator review mandatory. Send reminders 30 and 15 days before state sales tax license renewal.'
  },
  {
    title: 'US & UK Payroll Compliance & Year-End Tax Filings (941/W-2 & PAYE/P60)',
    category: 'Payroll & Wage Compliance',
    badge: 'Payroll Compliance',
    description: 'Wage tax withholdings, state unemployment insurance (SUI) IDs, IRS Form 941/940 (US) or HMRC PAYE / Real Time Information (RTI) P60/P45 reports (UK).',
    prompt:
      'Onboard client for payroll processing and wage compliance across US and UK jurisdictions. Collect employer identification numbers (IRS EIN or HMRC Employer PAYE Reference and Accounts Office Reference), state unemployment tax rate notices, employee direct deposit authorization, last 4 quarters payroll wage summaries (IRS Form 941 / Form 940 or HMRC FPS / P60 summaries), workers compensation policy certificate, and payroll representation consent. Workers compensation policy and state SUI tax notices require annual expiration tracking. Send reminders 30 and 7 days prior to policy expiration.'
  }
];
