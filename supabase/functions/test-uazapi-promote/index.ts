import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const baseUrl = "https://atllassa.uazapi.com";
  const instanceToken = "5f221e93-a42a-4904-b941-a98e54514d5b";
  const adminToken = "R8TEjFq6OJckzxRvOY5D9ag5jyMVtal7wPVaqriykahd8xluKT";
  const instanceName = "teste2323";

  const results: any[] = [];

  // 1. Check instance status with admin token
  try {
    const res = await fetch(`${baseUrl}/instance/info/${instanceName}`, {
      headers: { admintoken: adminToken },
    });
    const text = await res.text();
    results.push({
      test: "Instance info (admin)",
      status: res.status,
      response: text.substring(0, 1000),
    });
  } catch (e) {
    results.push({ test: "Instance info (admin)", error: String(e) });
  }

  // 2. Check instance status with instance token
  try {
    const res = await fetch(`${baseUrl}/instance/info`, {
      headers: { token: instanceToken },
    });
    const text = await res.text();
    results.push({
      test: "Instance info (instance token)",
      status: res.status,
      response: text.substring(0, 1000),
    });
  } catch (e) {
    results.push({ test: "Instance info (instance token)", error: String(e) });
  }

  // 3. List all groups - this works for sending messages so token should be valid
  try {
    const res = await fetch(`${baseUrl}/group/all`, {
      headers: { token: instanceToken },
    });
    const text = await res.text();
    results.push({
      test: "List all groups",
      status: res.status,
      response: text.substring(0, 1500),
    });
  } catch (e) {
    results.push({ test: "List all groups", error: String(e) });
  }

  // 4. Try fetching a specific group's info
  try {
    const res = await fetch(`${baseUrl}/group/metadata/120363422933828762@g.us`, {
      headers: { token: instanceToken },
    });
    const text = await res.text();
    results.push({
      test: "Group metadata",
      status: res.status,
      response: text.substring(0, 1000),
    });
  } catch (e) {
    results.push({ test: "Group metadata", error: String(e) });
  }

  // 5. Check if there's a /group/participants endpoint
  try {
    const res = await fetch(`${baseUrl}/group/participants/120363422933828762@g.us`, {
      headers: { token: instanceToken },
    });
    const text = await res.text();
    results.push({
      test: "Group participants",
      status: res.status,
      response: text.substring(0, 1000),
    });
  } catch (e) {
    results.push({ test: "Group participants", error: String(e) });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
