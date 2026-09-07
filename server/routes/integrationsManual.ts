import { Router, Response } from "express";
import { supabase } from "../lib/supabase";
import { requireAuth, type AuthenticatedRequest } from "../lib/auth";

const router = Router();

router.post("/integrations/save-manual", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { service, api_key, account_label } = req.body;
  if (!service || !api_key?.trim()) {
    res.status(400).json({ error: "service and api_key are required" });
    return;
  }

  const { data, error } = await supabase
    .from("user_integrations")
    .upsert(
      {
        user_id: req.userId!,
        service,
        api_key: api_key.trim(),
        account_label: account_label ?? null,
        is_connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,service" }
    )
    .select()
    .single();

  if (error) { res.status(500).json({ error: "Failed to save" }); return; }
  res.json({ connected: true, integration: data });
});

router.post("/integrations/disconnect-manual", requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { service } = req.body;
  if (!service) { res.status(400).json({ error: "service is required" }); return; }

  const { error } = await supabase
    .from("user_integrations")
    .update({ is_connected: false, updated_at: new Date().toISOString() })
    .eq("user_id", req.userId!)
    .eq("service", service);

  if (error) { res.status(500).json({ error: "Failed to disconnect" }); return; }
  res.json({ disconnected: true });
});

export default router;