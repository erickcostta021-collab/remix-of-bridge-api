import { useState } from "react";

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
  const [loading, setLoading] = useState(false);

  // Fetch users using the subaccount's location token (not agency token)
  const fetchLocationUsers = async (locationId: string, locationToken?: string | null): Promise<GHLUser[]> => {
    if (!locationToken) {
      console.warn("Token de subconta não configurado - não é possível buscar usuários");
      return [];
    }

    setLoading(true);
    try {
      // Use location-specific token for fetching users
      const response = await fetch(
        `https://services.leadconnectorhq.com/users/?locationId=${locationId}`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${locationToken}`,
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
              "Authorization": `Bearer ${locationToken}`,
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
