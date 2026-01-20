import { useState } from "react";
import { useSettings } from "./useSettings";

export interface GHLUser {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
}

export function useGHLUsers() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);

  const fetchLocationUsers = async (locationId: string): Promise<GHLUser[]> => {
    if (!settings?.ghl_agency_token) {
      throw new Error("Token de agência GHL não configurado");
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://services.leadconnectorhq.com/users/search?locationId=${locationId}&limit=100`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${settings.ghl_agency_token}`,
            "Version": "2021-07-28",
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        // Try alternative endpoint
        const altResponse = await fetch(
          `https://services.leadconnectorhq.com/users/?locationId=${locationId}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${settings.ghl_agency_token}`,
              "Version": "2021-07-28",
              "Accept": "application/json",
            },
          }
        );

        if (!altResponse.ok) {
          console.error("Failed to fetch GHL users");
          return [];
        }

        const altData = await altResponse.json();
        return (altData.users || []).map((u: any) => ({
          id: u.id,
          name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          email: u.email || "",
          phone: u.phone,
          role: u.role,
        }));
      }

      const data = await response.json();
      return (data.users || []).map((u: any) => ({
        id: u.id,
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        email: u.email || "",
        phone: u.phone,
        role: u.role,
      }));
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchLocationUsers,
    loading,
  };
}
