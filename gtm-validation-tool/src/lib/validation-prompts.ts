import { createClient } from "@/lib/supabase/server";
import { ICP_VERTICALS } from "@/types";

export async function getValidationPrompt(
  userId: string,
  projectId: string,
  type: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("validation_prompts")
    .select("prompt")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("type", type)
    .maybeSingle();

  if (error) throw error;
  return data?.prompt ?? null;
}

export async function saveValidationPrompt(
  userId: string,
  projectId: string,
  type: string,
  prompt: string,
  model?: string | null
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("validation_prompts")
    .upsert(
      {
        user_id: userId,
        project_id: projectId,
        type,
        prompt,
        model: model ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,project_id,type" }
    );

  if (error) throw error;
}

export function getDefaultIcpPrompt(): string {
  const verticals = ICP_VERTICALS.map((v) => `- ${v}`).join("\n");

  return `You are an ICP classification engine.

Determine whether this company matches our target ICP.

Company: /company
Industry: /industry
Position: /position
Domain: /domain
Employee Size: /employee_size
Country: /country
Company Description: /description
Website: /website

Target verticals:

${verticals}

Evaluate the company primarily using its business, products, industry, company description, website and domain.

Do not classify a company based solely on the person's job title.

Return structured JSON:

{
  "vertical_match": true,
  "matched_vertical": "one of the target verticals or null",
  "reasoning": "short explanation"
}

If there is insufficient evidence:

{
  "vertical_match": false,
  "matched_vertical": null,
  "reasoning": "Insufficient evidence"
}

Do not invent company information.`;
}
