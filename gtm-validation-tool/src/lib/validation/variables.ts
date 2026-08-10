import type { Lead } from "@/types";

export const VARIABLE_MAP: Record<string, keyof Lead> = {
  "/name": "full_name",
  "/company": "company_name",
  "/email": "email",
  "/industry": "industry",
  "/email_check": "email_check",
  "/icp": "vertical_match",
  "/vertical": "matched_vertical",
  "/position": "position",
  "/state": "state",
  "/domain": "domain",
  "/employee_size": "employee_size",
  "/country": "country",
  "/score": "email_score",
  "/status": "status",
  "/safe": "safe_to_send",
  "/description": "company_description",
  "/website": "website",
  "/company_linkedin": "company_linkedin",
  "/linkedin": "linkedin_url",
};

export const VARIABLE_OPTIONS = [
  { variable: "/name", label: "Full Name" },
  { variable: "/company", label: "Company Name" },
  { variable: "/email", label: "Email" },
  { variable: "/industry", label: "Industry" },
  { variable: "/email_check", label: "Email Check" },
  { variable: "/icp", label: "ICP Match" },
  { variable: "/vertical", label: "Matched Vertical" },
  { variable: "/position", label: "Position" },
  { variable: "/state", label: "State" },
  { variable: "/domain", label: "Domain" },
  { variable: "/employee_size", label: "Employee Size" },
  { variable: "/country", label: "Country" },
  { variable: "/score", label: "Email Score" },
  { variable: "/status", label: "Status" },
  { variable: "/safe", label: "Safe to Send" },
  { variable: "/description", label: "Company Description" },
  { variable: "/website", label: "Website" },
  { variable: "/company_linkedin", label: "Company LinkedIn" },
  { variable: "/linkedin", label: "LinkedIn URL" },
];

export function resolvePrompt(template: string, lead: Lead): string {
  let resolved = template;
  for (const [variable, field] of Object.entries(VARIABLE_MAP)) {
    const value = lead[field];
    const replacement =
      value === null || value === undefined
        ? "N/A"
        : typeof value === "boolean"
          ? String(value)
          : String(value);
    resolved = resolved.replaceAll(variable, replacement);
  }
  return resolved;
}
