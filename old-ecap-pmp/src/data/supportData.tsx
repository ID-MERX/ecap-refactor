import { Book, FileText, HelpCircle, ExternalLink } from "lucide-react";

export const faqs = [
  {
    question: "How do I reset my password?",
    answer:
      "You can reset your password by clicking on the 'Forgot Password' link on the login page. Follow the instructions sent to your email to create a new password.",
  },
  {
    question: "Where can I find the latest weekly extract?",
    answer:
      "Weekly extracts are available in the 'Data Pipeline' section under 'Weekly Extracts'. You can download the latest report from there.",
  },
  {
    question: "How do I add a new household?",
    answer:
      "Navigate to the 'Households' register and click the 'Add Household' button in the top right corner. Fill in the required details and save.",
  },
  {
    question: "Who should I contact for technical issues?",
    answer:
      "For technical support, please use the contact form on this page or email our support team directly at info@bluecodeltd.com.",
  },
];

export const quickHelpLinks = [
  {
    title: "Data Entry Guide",
    description: "Step-by-step guide for entering household and VCA data.",
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-100",
    time: "5 min read",
    content: (
      <div className="space-y-4 text-sm text-slate-600">
        <p><strong>1. Accessing Registers:</strong> Navigate to the 'Households' or 'VCAs' tab from the sidebar.</p>
        <p><strong>2. Adding New Records:</strong> Click the 'Add New' button in the top right corner. A form will appear.</p>
        <p><strong>3. Required Fields:</strong> Ensure all fields marked with an asterisk (*) are filled. This includes Name, Age, and Location.</p>
        <p><strong>4. Saving:</strong> Click 'Save Record' at the bottom. If there are errors, they will be highlighted in red.</p>
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-blue-800 text-xs">
          <strong>Tip:</strong> You can save a draft if you don't have all the information yet.
        </div>
      </div>
    )
  },
  {
    title: "Troubleshooting Sync",
    description: "Solutions for common data synchronization issues.",
    icon: HelpCircle,
    color: "text-amber-600",
    bg: "bg-amber-100",
    time: "3 min read",
    content: (
      <div className="space-y-4 text-sm text-slate-600">
        <p>If you aren't seeing recent data, try these steps:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Check your internet connection.</li>
          <li>Refresh the page using the browser reload button.</li>
          <li>Clear your browser cache if the issue persists.</li>
          <li>Log out and log back in to force a session refresh.</li>
        </ul>
        <p>If the problem continues, please contact support with a screenshot of any error messages.</p>
      </div>
    )
  },
  {
    title: "User Permissions",
    description: "Understanding roles and access levels in PMP.",
    icon: Book,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    time: "8 min read",
    content: (
      <div className="space-y-4 text-sm text-slate-600">
        <p><strong>Admin:</strong> Full access to all modules, user management, and system settings.</p>
        <p><strong>Data Entrant:</strong> Can view and add records to Households and VCAs. Cannot delete records.</p>
        <p><strong>read-only:</strong> Can view reports and charts but cannot edit any data.</p>
        <p><strong>Case Worker:</strong> Access limited to assigned districts and beneficiaries.</p>
      </div>
    )
  },
];

export const fullManual = {
  title: "Full System Manual",
  description: "Access the complete ECAP+ PMP documentation.",
  content: (
    <div className="space-y-6 text-sm text-slate-600">
      <p>The Full System Manual is a comprehensive document covering all aspects of the ECAP+ PMP system.</p>

      <div className="space-y-2">
        <h4 className="font-semibold text-slate-900">Table of Contents</h4>
        <ul className="list-decimal pl-5 space-y-1">
          <li>Introduction & System Overview</li>
          <li>User Management & Security</li>
          <li>Beneficiary Registration (Households & VCAs)</li>
          <li>Service Delivery Recording</li>
          <li>Reports & Analytics</li>
          <li>Data Quality Assurance</li>
          <li>Troubleshooting & Support</li>
        </ul>
      </div>

      <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto gap-2 mt-4" onClick={() => window.open('#', '_blank')}>
        <ExternalLink className="h-4 w-4" />
        Download PDF Manual (v2.4)
      </button>
    </div>
  )
};
