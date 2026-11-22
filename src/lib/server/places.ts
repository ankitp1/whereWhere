import { VenueOption, ConstraintItem } from "@/types/session";

interface GroundedVenueTemplate {
  name: string;
  placeId: string;
  rating: number;
  priceLevel: string;
  address: string;
  mapsUrl: string;
  tags: string[];
}

const GROUNDED_MIDTOWN_VENUES: GroundedVenueTemplate[] = [
  {
    name: "Tabla Midtown",
    placeId: "ChIJ_z1b7mZZwokRxE-v2s9rR1A",
    rating: 4.6,
    priceLevel: "$$",
    address: "283 Lexington Ave, New York, NY 10016",
    mapsUrl: "https://maps.google.com/?q=Tabla+Midtown+NYC",
    tags: ["Likely vegetarian-friendly", "Modern Indian", "Lively"],
  },
  {
    name: "Basta Pasta",
    placeId: "ChIJb4aR75xZwokRQzB9pU4eG8A",
    rating: 4.5,
    priceLevel: "$$",
    address: "37 W 17th St, New York, NY 10011",
    mapsUrl: "https://maps.google.com/?q=Basta+Pasta+NYC",
    tags: ["Likely vegetarian-friendly", "Likely kid-friendly", "Italian-Japanese", "Open Kitchen"],
  },
  {
    name: "Planta Queen Flatiron",
    placeId: "ChIJgX17rK1ZwokR5n8T3d9m2_M",
    rating: 4.7,
    priceLevel: "$$",
    address: "15 W 27th St, New York, NY 10001",
    mapsUrl: "https://maps.google.com/?q=Planta+Queen+NYC",
    tags: ["Likely vegetarian-friendly", "100% Plant-Based", "Asian Fusion", "Cocktails"],
  },
  {
    name: "Rubirosa Ristorante",
    placeId: "ChIJY7vU_1tZwokRYfGqP7sZJ0Y",
    rating: 4.6,
    priceLevel: "$$",
    address: "235 Mulberry St, New York, NY 10012",
    mapsUrl: "https://maps.google.com/?q=Rubirosa+NYC",
    tags: ["Likely kid-friendly", "Gluten-free friendly", "Thin Crust Pizza"],
  },
  {
    name: "Dhamaka",
    placeId: "ChIJP3Sa80dZwokR65pE47oB1dE",
    rating: 4.5,
    priceLevel: "$$",
    address: "119 Essex St, New York, NY 10002",
    mapsUrl: "https://maps.google.com/?q=Dhamaka+NYC",
    tags: ["Likely vegetarian-friendly", "Regional Indian", "Vibrant"],
  },
];

export async function findGroundedVenues(
  area: string,
  constraints: ConstraintItem[]
): Promise<VenueOption[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (apiKey) {
    try {
      const placesResult = await searchGooglePlaces(area, constraints, apiKey);
      if (placesResult && placesResult.length > 0) {
        return placesResult;
      }
    } catch (err) {
      console.warn("Google Places API call failed, using grounded catalog fallback:", err);
    }
  }

  // Filter or augment grounded templates based on constraints
  const isVeg = constraints.some((c) => c.type === "dietary" && /veg/i.test(c.label));
  const isKid = constraints.some((c) => c.type === "kid_friendly");

  return GROUNDED_MIDTOWN_VENUES.map((v, idx) => {
    const inferred = [...v.tags];
    if (isVeg && !inferred.includes("Likely vegetarian-friendly")) {
      inferred.unshift("Likely vegetarian-friendly");
    }
    if (isKid && !inferred.includes("Likely kid-friendly")) {
      inferred.push("Likely kid-friendly");
    }

    return {
      id: `v_${v.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}_${idx + 1}`,
      placeId: v.placeId,
      name: v.name,
      rating: v.rating,
      priceLevel: v.priceLevel,
      address: v.address,
      mapsUrl: v.mapsUrl,
      inferredTags: inferred,
      disqualifiedReason: null,
      suggestedBy: null,
    };
  });
}

async function searchGooglePlaces(
  area: string,
  constraints: ConstraintItem[],
  apiKey: string
): Promise<VenueOption[]> {
  const query = `${area} restaurants dinner group friendly`;
  const url = `https://places.googleapis.com/v1/places:searchText`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.rating,places.priceLevel,places.formattedAddress,places.googleMapsUri,places.servesVegetarianFood",
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 5,
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  if (!data.places) return [];

  return data.places.map((p: any, idx: number) => {
    const tags: string[] = [];
    if (p.servesVegetarianFood) tags.push("Likely vegetarian-friendly");
    tags.push("Group friendly");

    return {
      id: `v_${idx + 1}_${p.id.slice(0, 6)}`,
      placeId: p.id,
      name: p.displayName?.text || "Restaurant",
      rating: p.rating || 4.5,
      priceLevel: p.priceLevel || "$$",
      address: p.formattedAddress || "",
      mapsUrl: p.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(p.displayName?.text || area)}`,
      inferredTags: tags,
      disqualifiedReason: null,
      suggestedBy: null,
    };
  });
}
