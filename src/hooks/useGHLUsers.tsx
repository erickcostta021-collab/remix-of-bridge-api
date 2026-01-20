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
      // Primary endpoint for fetching users by location
      const response = await fetch(
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

      if (!response.ok) {
        // Try search endpoint as fallback
        const altResponse = await fetch(
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

        if (!altResponse.ok) {
          const errorData = await altResponse.json().catch(() => ({}));
          console.error("Failed to fetch GHL users:", errorData);
          return [];
        }

        const altData = await altResponse.json();
        const usersArray = altData.users || altData.data || [];
        return usersArray.map((u: any) => ({
          id: u.id,
          name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
          firstName: u.firstName || "",
          lastName: u.lastName || "",
          email: u.email || "",
          phone: u.phone,
          role: u.role || u.type,
        }));
      }

      const data = await response.json();
      const usersArray = data.users || data.data || [];
      return usersArray.map((u: any) => ({
        id: u.id,
        name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
        firstName: u.firstName || "",
        lastName: u.lastName || "",
        email: u.email || "",
        phone: u.phone,
        role: u.role || u.type,
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
