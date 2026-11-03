export const toSlug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export interface Article {
  title: string;
  slug: string;
  category: string;
  content: string;
}

export const articles: Article[] = [
  // Getting Started
  {
    title: "Platform overview",
    slug: toSlug("Platform overview"),
    category: "Getting Started",
    content: `The ECAP+ Program Management Platform (PMP) is a web-based data quality and program monitoring tool designed for PEPFAR-funded OVC programs in Zambia.\n\nIt connects to Directus and a backend DQA API to provide real-time visibility into household registrations, child (VCA) records, service delivery, HIV tracking, and caseworker performance.\n\nKey capabilities:\n- Household, VCA, HTS, and PMTCT registers\n- Service delivery tracking across health, schooled, safe, and stable domains\n- Data quality insight cards that flag issues in real time\n- Role-based access for district, provincial, and national users\n- CSV export on every table for offline analysis`,
  },
  {
    title: "Logging in and navigation",
    slug: toSlug("Logging in and navigation"),
    category: "Getting Started",
    content: `To log in, navigate to the platform URL and enter your email and password. If you don't have an account, contact your administrator.\n\nOnce logged in you'll see the dashboard with a sidebar on the left. The sidebar organizes pages into sections:\n- **Overview**: Dashboard, Calendar, Districts, Charts, Caseworkers\n- **Registers**: Households, VCAs, HTS, PMTCT\n- **Archived**: Graduated/exited households and VCAs\n- **Services**: Household Services, VCA Services, Caregiver Services, Flags\n- **Admin**: User management (administrators only)\n- **Help & Support**: Support Center, Documentation`,
  },
  {
    title: "Understanding your dashboard",
    slug: toSlug("Understanding your dashboard"),
    category: "Getting Started",
    content: `The home dashboard shows:\n- **Welcome banner** with your name and assigned location\n- **Metric cards** for total VCAs, Households, and Caseworkers\n- **Data quality chart** showing district-level completeness\n- **Flagged records** requiring attention\n- **Upcoming schedule** from the calendar\n\nAll data on the dashboard respects your role-based access. District users see only their district. Provincial users see all districts in their province.`,
  },
  {
    title: "Role-based access levels",
    slug: toSlug("Role-based access levels"),
    category: "Getting Started",
    content: `The platform has four access levels:\n\n**Administrator** — Full access to all data, all districts, and the Admin/Users page.\n\n**Provincial User** — Can view data for all districts within their assigned province. Cannot access the Admin page.\n\n**District User** — Locked to their assigned district. The district selector is disabled and they cannot change it. Cannot access Districts or Caseworkers pages.\n\n**Support User** — Can view and manage all users. Has access to the Data Pipeline section.\n\nRoles are assigned when creating a user and stored in the user's profile.`,
  },
  // User Management
  {
    title: "Adding new users",
    slug: toSlug("Adding new users"),
    category: "User Management",
    content: `Only administrators can add new users.\n\n1. Go to **Admin > Users** in the sidebar\n2. Click **Add user**\n3. Fill in the user's name, email, and password\n4. Select a **Custom Role**: Administrator, Provincial User, District User, or Support User\n5. For Provincial and District users, select the appropriate province and district\n6. Click **Create user**\n\nThe user will be able to log in immediately with the credentials you set.`,
  },
  {
    title: "Assigning districts and provinces",
    slug: toSlug("Assigning districts and provinces"),
    category: "User Management",
    content: `When creating or editing a user:\n- **Provincial Users** must be assigned a province. They will see data from all districts in that province.\n- **District Users** must be assigned both a province and a district. They will only see data from their specific district.\n- **Administrators** and **Support Users** have access to all locations.\n\nThe province and district lists are dynamically populated from actual program data.`,
  },
  {
    title: "Editing user profiles",
    slug: toSlug("Editing user profiles"),
    category: "User Management",
    content: `To edit a user:\n1. Go to **Admin > Users**\n2. Hover over the user row and click **Edit**\n3. Update the user's details, role, province, or district\n4. Click **Save changes**\n\nYou can also suspend (trash) users or permanently delete them from the user list.`,
  },
  {
    title: "Understanding role permissions",
    slug: toSlug("Understanding role permissions"),
    category: "User Management",
    content: `Each role determines what a user can see and do:\n\n| Role | Data Access | Admin Page | Districts Page |\n|------|------------|------------|----------------|\n| Administrator | All | Yes | Yes |\n| Provincial User | Province only | No | Yes |\n| District User | District only | No | No |\n| Support User | All users | No | Yes |\n\nAll filtering is enforced in the UI based on the user's profile from the server.`,
  },
  // Registers
  {
    title: "Household register",
    slug: toSlug("Household register"),
    category: "Registers",
    content: `The Household Register shows all registered households.\n\nFeatures:\n- Search by household ID, address, facility, or caseworker\n- Filter by district (locked for district users)\n- Sub-population filters for specific demographics\n- Click a row to view the full household profile\n- Export to CSV\n\nData is sorted by household ID in descending order (newest first).`,
  },
  {
    title: "VCA register",
    slug: toSlug("VCA register"),
    category: "Registers",
    content: `The VCA (Vulnerable Children and Adolescents) Register lists all registered children.\n\nFeatures:\n- Search by VCA ID, name, or household\n- District filtering with province-level access control\n- Sub-population filters (HIV status, disability, household type, etc.)\n- Click a row to view the full VCA profile with service history\n- Export to CSV`,
  },
  {
    title: "Mother index register",
    slug: toSlug("Mother index register"),
    category: "Registers",
    content: `The HTS (HIV Testing Services) Register tracks mother index testing data.\n\nFeatures:\n- View test results, facility, and dates\n- Filter by district\n- Special filters for positives not on ART, pending outcomes, and new positives\n- Click a row to view the full HTS profile\n- Export to CSV`,
  },
  {
    title: "HTS and PMTCT registers",
    slug: toSlug("HTS and PMTCT registers"),
    category: "Registers",
    content: `**HTS Register** — Tracks HIV testing services including test results, referrals, and ART linkage.\n\n**PMTCT Register** — Prevention of Mother-to-Child Transmission tracking.\n\nBoth registers follow the same UI pattern: searchable, filterable tables with district access control and CSV export.`,
  },
  // Services
  {
    title: "Household services",
    slug: toSlug("Household services"),
    category: "Services",
    content: `The Household Services page shows service delivery data for households.\n\nSections:\n- **Banner**: Total households, service events, and location\n- **Coverage KPIs**: Health, Schooled, Safe, Stable domain coverage with click-through to risk registers\n- **Most common health services**: Horizontal bar chart\n- **Data quality cards**: Click to filter the table by specific issues\n- **Service table**: Full audit log with search, pagination, and CSV export\n\nServices are filtered by June reporting year (June–May cycle).`,
  },
  {
    title: "VCA services",
    slug: toSlug("VCA services"),
    category: "Services",
    content: `The VCA Services page tracks service delivery for vulnerable children.\n\nIt includes the same layout as Household Services plus:\n- HIV status, viral load date, VL result, and MMD level columns\n- VCA-specific data quality insights (HIV+ missing VL, overdue VL tests, no MMD level)\n- Service events counted per VCA`,
  },
  {
    title: "Caregiver services",
    slug: toSlug("Caregiver services"),
    category: "Services",
    content: `The Caregiver Services page monitors service delivery for caregivers.\n\nIt includes:\n- Coverage KPIs for all four domains\n- Graduation readiness tracking\n- HIV and viral load monitoring columns\n- Data quality insight cards with click-to-filter\n- Most common health services chart\n- Full audit table with CSV export`,
  },
  {
    title: "Data quality insights",
    slug: toSlug("Data quality insights"),
    category: "Services",
    content: `Each service page has a **Data quality & insights** section with clickable cards.\n\nEach card shows a count of records with a specific issue:\n- **Missing service date** — No date recorded\n- **No health/education/safety/stability services** — Domain is empty\n- **Incomplete coverage** — One or more domains missing\n- **HIV+ missing VL** — Positive client without viral load\n- **Future-dated** — Service date after today\n- **Duplicate records** — Same ID + date + services\n\nClick a card to filter the table to show only those records. Click again to clear the filter. Use **Export CSV** to download the filtered data.`,
  },
  // Data Quality
  {
    title: "Flagged records review",
    slug: toSlug("Flagged records review"),
    category: "Data Quality",
    content: `The Flags page shows records that have been flagged for data quality issues.\n\nFeatures:\n- View flagged household ID, caseworker, caregiver, and comments\n- Resolve flags directly from the table\n- All users are notified when a flag is resolved\n- Search and export to CSV\n- Records are filtered by your district/province access level`,
  },
  {
    title: "Data quality insight cards",
    slug: toSlug("Data quality insight cards"),
    category: "Data Quality",
    content: `Data quality insight cards appear on all three service pages (Household, VCA, Caregiver).\n\nHow they work:\n1. The system analyzes all service records in the selected reporting period\n2. Each card counts records matching a specific quality issue\n3. Click a card to filter the table below to show only matching records\n4. The active filter is shown as a badge above the table\n5. Click the card again or "Clear filter" to reset\n\nThis helps you quickly identify and export problematic records for correction.`,
  },
  {
    title: "Exporting service data",
    slug: toSlug("Exporting service data"),
    category: "Data Quality",
    content: `Every table in the platform has an **Export CSV** button.\n\nThe export includes:\n- All columns visible in the table\n- Only the currently filtered/displayed records\n- If a data quality filter is active, only those flagged records are exported\n\nCSV files can be opened in Excel, Google Sheets, or any spreadsheet application for further analysis.`,
  },
  {
    title: "District-level reporting",
    slug: toSlug("District-level reporting"),
    category: "Data Quality",
    content: `The Districts page provides a bird's-eye view of program coverage across all districts.\n\nIt shows:\n- Total households and VCAs per district\n- Service delivery rates\n- Comparative metrics across locations\n\nProvincial users see all districts in their province. District users do not have access to this page.`,
  },
  // Troubleshooting
  {
    title: "Login and access issues",
    slug: toSlug("Login and access issues"),
    category: "Troubleshooting",
    content: `**Can't log in?**\n- Verify your email and password are correct\n- Click "Forgot your password?" on the login page to reset\n- Contact your administrator if your account has been suspended\n\n**Can't see certain pages?**\n- Your role determines which pages are visible in the sidebar\n- District users cannot access Districts, Caseworkers, or Admin pages\n- Contact your administrator to update your access level`,
  },
  {
    title: "Data not loading",
    slug: toSlug("Data not loading"),
    category: "Troubleshooting",
    content: `If data is not loading:\n1. Check your internet connection\n2. Click the **Sync** button on service pages to force a refresh\n3. Try refreshing the browser page\n4. Clear your browser cache if the issue persists\n5. Contact support if the problem continues\n\nThe platform caches data for performance. Some queries may take a moment on first load.`,
  },
  {
    title: "Export problems",
    slug: toSlug("Export problems"),
    category: "Troubleshooting",
    content: `If CSV export isn't working:\n- Make sure there are records in the table to export\n- Check if a data quality filter is active (it will export only filtered records)\n- Try a different browser if the download doesn't start\n- Large exports may take a few seconds to generate\n\nExported files are named with the page type and current date for easy identification.`,
  },
  {
    title: "Contacting support",
    slug: toSlug("Contacting support"),
    category: "Troubleshooting",
    content: `You can reach our support team through:\n\n**Live Chat** — Click "Support Center" in the sidebar, then "Start Chat"\n\n**Email** — info@bluecodeltd.com\n\n**Phone** — +260 211 355 204 / +260 973 203 144\n\nWhen contacting support, please include:\n- Your username and role\n- The page where the issue occurs\n- A screenshot if possible\n- Steps to reproduce the problem`,
  },
];
