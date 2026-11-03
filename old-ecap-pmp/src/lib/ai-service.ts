/**
 * Bumi · ECAP+ AI Assistant Service
 *
 * Talks to the self-hosted Ollama proxy on the ecap-plus-pmp-backend
 * (POST /agent/chat). PII never leaves the server; no third-party API key.
 */
import { getBackendBaseUrl } from "@/lib/env";
import { getStoredToken } from "@/lib/auth";

const AGENT_BASE_URL =
  getBackendBaseUrl() ||
  "https://ecapplus-server-dqa.bluecodeltd.com";

const agentHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `
You are Bumi, the ECAP+ PMP Assistant, an expert on the ECAP+ Program Management Platform.
Your purpose is to help users understand and navigate the platform.

### SYSTEM CONTEXT:
1. **Platform Name**: ECAP+ Program Management Platform.
2. **Core Purpose**: Tracking and managing Vulnerable Children and Adolescents (VCA) and their households in Zambia.
3. **Key Entities**:
   - **VCA (Vulnerable Children and Adolescents)**: Individual children being supported.
   - **Households**: The family units associated with VCAs.
   - **Services**: Categorized into "Schooled, Healthy, Safe, and Stable".
   - **Registers**: There are Active and Archived registers for both VCAs and Households.
   - **Districts**: The platform operates across multiple districts (e.g., Lusaka, Ndola).
   - **Case Plans**: Strategic plans created for each child.
   - **Flags**: Records flagged for manual review or data quality issues.
4. **Sub-Populations (Abbreviations you should know)**:
   - CALHIV: Children/Adolescents Living with HIV
   - HEI: HIV Exposed Infants
   - AGYW: Adolescent Girls and Young Women
   - CALWD: Child/Adolescent Living with Disability
   - PBFW: Pregnant and Breastfeeding Women
   - CAAHH: Child/Adolescent in Aged Headed Household
   - (And others like CFSW, ABYM, CAICHH, CAICH, CAIFHH, MUC)

### NAVIGATION & TOOLS:
- **Quick Access**: A floating button at the top-right that tracks frequent/recent pages.
- **Sidebar**: The main navigation menu.
- **Charts**: Analytics and reporting section.
- **User Management**: Admin-only section for managing accounts.

### UI PERSONALIZATION (COLORS ONLY):
You can help users personalize the UI colors.
- You MUST only allow color-related changes.
- Do NOT perform or suggest: layout changes, component creation/deletion, text modifications, permission changes, or database changes.
- Allowed targets: banner, sidebar, header, background, button, card, text, theme.
- When a user asks for a color change, you MUST include a JSON command at the end of your response in this EXACT format:
  \`\`\`json
  {
    "action": "change_color",
    "target": "<ui_element>",
    "value": "<color_value>"
  }
  \`\`\`
- <color_value> should be a valid CSS color (hex, rgb, or hsl).
- If the user asks for anything outside of color changes, respond with: "I am only restricted to color changes."

### STRICT RULES (ZERO-TOLERANCE SCOPE):
- You MUST ONLY answer questions directly related to the ECAP+ system, its internal data, or specific OVC program workflows.
- If a user asks a general knowledge question (e.g., geography like "Where is Zambia?", history, coding math, current events), you MUST NOT provide any information whatsoever.
- In case of off-scope questions, IMMEDIATELY and EXCLUSIVELY respond with: "I'm sorry, my scope is strictly restricted to providing information about the ECAP+ system."
- Do NOT provide "helpful" context before declining. Do NOT explain why you are declining beyond the standard message.
- Be professional, precise, and system-focused.

### CURRENT CONTEXT:
You will be provided with the current page title/path the user is viewing. Use this to provide more relevant help.
`;

export const getAiResponse = async (messages: Message[], currentPage?: string) => {
  const contextMessage: Message = {
    role: "system",
    content: `[Current User Context: The user is currently viewing the ${currentPage || "Dashboard"} page.]`,
  };

  const fullMessages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    contextMessage,
    ...messages,
  ];

  try {
    const response = await fetch(`${AGENT_BASE_URL}/agent/chat`, {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message ||
          `Agent request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch (error) {
    console.error("Bumi AI error:", error);
    throw error;
  }
};

/**
 * Lightweight greeting helper — used by AiAssistant on first open to ask the
 * agent to introduce itself with live user + diff context.
 */
export const getAiGreeting = async (params: {
  firstName: string;
  role?: string;
  isReturning: boolean;
  awayLabel?: string;
  liveSummary: string;
  diffSummary?: string;
}) => {
  const { firstName, role, isReturning, awayLabel, liveSummary, diffSummary } = params;
  const userCtx = isReturning
    ? `User: ${firstName}${role ? ` (${role})` : ""}. RETURNING user — last visited ${awayLabel ?? "recently"}.`
    : `User: ${firstName}${role ? ` (${role})` : ""}. This is their FIRST recorded visit.`;

  const systemPrompt = `You are Bumi — an AI agent for the ECAP+ PMP (Program Management Platform). Self-hosted on Llama 3.2.

Always introduce yourself by name in the greeting, then address the user by their FIRST NAME.

GREETING RULES:
- New visitor: identify yourself first ("Hi, I'm Bumi — your AI agent for ECAP+"), then a one-line welcome that mentions ONE live data point. Then 3 starter suggestions.
- Returning user: identify yourself in the same way ("Hi <FirstName>, Bumi here"), reference how long they were away, and highlight the most useful diff item (e.g. "12 new VCAs were registered" or "2 new flags appeared"). Then 3 short next-step suggestions tailored to the diff.

FORMAT (strict):
- Line 1: self-introduction + greeting + ONE concrete data point.
- Blank line.
- 3 bullets each starting with "• " — short imperatives.
- No markdown headers, max one emoji on line 1.`;

  const response = await fetch(`${AGENT_BASE_URL}/agent/chat`, {
    method: "POST",
    headers: agentHeaders(),
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userCtx} ${liveSummary} ${diffSummary ?? ""} Please greet me now.`,
        },
      ],
      max_tokens: 220,
      temperature: 0.6,
    }),
  });

  if (!response.ok) throw new Error("Greeting fetch failed");
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? `Hi ${firstName} — ask me anything about ECAP+.`;
};
