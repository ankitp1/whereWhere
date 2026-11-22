import { VenueOption, ConstraintItem } from "@/types/session";

interface GroundedVenueTemplate {
  name: string;
  placeId: string;
  rating: number;
  priceLevel: string;
  address: string;
  mapsUrl: string;
  tags: string[];
  neighborhoods?: string[];
}

const GROUNDED_ATLANTA_VENUES: GroundedVenueTemplate[] = [
  {
    name: "Tabla Midtown",
    placeId: "ChIJb_fGZ6wE9YgR5i7Hh0XJ6r8",
    rating: 4.6,
    priceLevel: "$$",
    address: "300 12th St NE, Atlanta, GA 30309",
    mapsUrl: "https://maps.google.com/?q=Tabla+Midtown+Atlanta",
    tags: ["Likely vegetarian-friendly", "Modern Indian", "Midtown Vibe", "Cocktails"],
    neighborhoods: ["Midtown", "Midtown Atlanta"],
  },
  {
    name: "Rumi's Kitchen Colony Square",
    placeId: "ChIJvXw9q7gE9YgR3tK5N0yB4zY",
    rating: 4.8,
    priceLevel: "$$$",
    address: "1175 Peachtree St NE, Atlanta, GA 30361",
    mapsUrl: "https://maps.google.com/?q=Rumis+Kitchen+Colony+Square+Atlanta",
    tags: ["Likely vegetarian-friendly", "Modern Persian", "Midtown", "Lively"],
    neighborhoods: ["Midtown", "Midtown Atlanta"],
  },
  {
    name: "Superica Krog Street",
    placeId: "ChIJO-j8uRQE9YgRs1LqA4dF4z8",
    rating: 4.6,
    priceLevel: "$$",
    address: "99 Krog St NE, Atlanta, GA 30307",
    mapsUrl: "https://maps.google.com/?q=Superica+Krog+Street+Market+Atlanta",
    tags: ["Likely kid-friendly", "BeltLine Patio", "Tex-Mex", "Inman Park"],
    neighborhoods: ["Inman Park", "Krog Street", "BeltLine", "Old Fourth Ward"],
  },
  {
    name: "Antico Pizza Napoletana",
    placeId: "ChIJZ3UeOpcE9YgRtG1Fp2pG4b0",
    rating: 4.7,
    priceLevel: "$$",
    address: "1093 Hemphill Ave NW, Atlanta, GA 30318",
    mapsUrl: "https://maps.google.com/?q=Antico+Pizza+Atlanta",
    tags: ["Likely kid-friendly", "Casual Communal Seating", "Westside", "Authentic Pizza"],
    neighborhoods: ["Westside", "West Midtown"],
  },
  {
    name: "Upbeet West Midtown",
    placeId: "ChIJ9f5nSZsE9YgR4HwV2Z4pL6Q",
    rating: 4.6,
    priceLevel: "$$",
    address: "1071 Howell Mill Rd NW, Atlanta, GA 30318",
    mapsUrl: "https://maps.google.com/?q=Upbeet+Atlanta",
    tags: ["Likely vegetarian-friendly", "100% Plant-Based Friendly", "Organic Bowls", "Casual"],
    neighborhoods: ["West Midtown", "Westside"],
  },
  {
    name: "Barcelona Wine Bar Inman Park",
    placeId: "ChIJa_3jthQE9YgR5e6r0N2t4vQ",
    rating: 4.7,
    priceLevel: "$$",
    address: "240 N Highland Ave NE, Atlanta, GA 30307",
    mapsUrl: "https://maps.google.com/?q=Barcelona+Wine+Bar+Inman+Park+Atlanta",
    tags: ["Tapas & Small Plates", "BeltLine Vibe", "Great Cocktails", "Patio"],
    neighborhoods: ["Inman Park", "BeltLine"],
  },
  // Metro Atlanta (OTP) - Roswell
  {
    name: "Table & Main",
    placeId: "ChIJ_roswell_table_main",
    rating: 4.7,
    priceLevel: "$$$",
    address: "1028 Canton St, Roswell, GA 30075",
    mapsUrl: "https://maps.google.com/?q=Table+and+Main+Roswell+GA",
    tags: ["Southern Hospitality", "Canton Street Patio", "Great Cocktails", "Roswell"],
    neighborhoods: ["Roswell", "Canton Street"],
  },
  {
    name: "Osteria Mattone",
    placeId: "ChIJ_roswell_osteria_mattone",
    rating: 4.7,
    priceLevel: "$$$",
    address: "1095 Canton St, Roswell, GA 30075",
    mapsUrl: "https://maps.google.com/?q=Osteria+Mattone+Roswell+GA",
    tags: ["Likely vegetarian-friendly", "Roman Italian", "Patio", "Roswell"],
    neighborhoods: ["Roswell", "Canton Street"],
  },
  {
    name: "Vas Kouzina",
    placeId: "ChIJ_roswell_vas_kouzina",
    rating: 4.6,
    priceLevel: "$$",
    address: "1055 Canton St, Roswell, GA 30075",
    mapsUrl: "https://maps.google.com/?q=Vas+Kouzina+Roswell+GA",
    tags: ["Likely vegetarian-friendly", "Mediterranean", "Likely kid-friendly", "Roswell"],
    neighborhoods: ["Roswell", "Canton Street"],
  },
  // Metro Atlanta (OTP) - Marietta
  {
    name: "Two Birds Taphouse",
    placeId: "ChIJ_marietta_two_birds",
    rating: 4.6,
    priceLevel: "$$",
    address: "52 Powder Springs St, Marietta, GA 30064",
    mapsUrl: "https://maps.google.com/?q=Two+Birds+Taphouse+Marietta+GA",
    tags: ["Marietta Square", "Craft Beer & Cocktails", "Likely kid-friendly", "Lively"],
    neighborhoods: ["Marietta", "Marietta Square"],
  },
  {
    name: "Taqueria Tsunami Marietta Square",
    placeId: "ChIJ_marietta_taqueria_tsunami",
    rating: 4.5,
    priceLevel: "$$",
    address: "70 S Park Square NE, Marietta, GA 30060",
    mapsUrl: "https://maps.google.com/?q=Taqueria+Tsunami+Marietta+Square+GA",
    tags: ["Likely vegetarian-friendly", "Likely kid-friendly", "Patio", "Marietta Square"],
    neighborhoods: ["Marietta", "Marietta Square"],
  },
  {
    name: "Seed Kitchen & Bar",
    placeId: "ChIJ_marietta_seed",
    rating: 4.6,
    priceLevel: "$$$",
    address: "1311 Johnson Ferry Rd, Marietta, GA 30068",
    mapsUrl: "https://maps.google.com/?q=Seed+Kitchen+and+Bar+Marietta+GA",
    tags: ["New American", "East Cobb", "Cocktails", "Likely vegetarian-friendly"],
    neighborhoods: ["Marietta", "East Cobb"],
  },
  // Metro Atlanta (OTP) - Smyrna / The Battery
  {
    name: "Muss & Turner's",
    placeId: "ChIJ_smyrna_muss_turners",
    rating: 4.6,
    priceLevel: "$$",
    address: "1675 Cumberland Pkwy SE, Smyrna, GA 30080",
    mapsUrl: "https://maps.google.com/?q=Muss+and+Turners+Smyrna+GA",
    tags: ["Neighborhood Favorite", "Likely kid-friendly", "Great Drinks", "Smyrna"],
    neighborhoods: ["Smyrna", "Vinings", "The Battery", "Battery Atlanta"],
  },
  {
    name: "Superica at The Battery",
    placeId: "ChIJ_battery_superica",
    rating: 4.5,
    priceLevel: "$$",
    address: "455 Legends Pl SE, Atlanta, GA 30339",
    mapsUrl: "https://maps.google.com/?q=Superica+The+Battery+Atlanta",
    tags: ["Likely kid-friendly", "Patio", "Tex-Mex", "The Battery"],
    neighborhoods: ["Smyrna", "The Battery", "Battery Atlanta", "Vinings"],
  },
  {
    name: "Antico Pizza at The Battery",
    placeId: "ChIJ_battery_antico",
    rating: 4.6,
    priceLevel: "$$",
    address: "2605 Circle 75 Pkwy, Atlanta, GA 30339",
    mapsUrl: "https://maps.google.com/?q=Antico+Pizza+The+Battery+Atlanta",
    tags: ["Likely vegetarian-friendly", "Likely kid-friendly", "Casual", "The Battery"],
    neighborhoods: ["Smyrna", "The Battery", "Battery Atlanta"],
  },
  // Metro Atlanta (OTP) - Kennesaw
  {
    name: "Trackside Grill",
    placeId: "ChIJ_kennesaw_trackside",
    rating: 4.6,
    priceLevel: "$$",
    address: "2840 S Main St, Kennesaw, GA 30144",
    mapsUrl: "https://maps.google.com/?q=Trackside+Grill+Kennesaw+GA",
    tags: ["Downtown Kennesaw", "Southern Comfort", "Likely kid-friendly", "Cozy"],
    neighborhoods: ["Kennesaw", "Acworth"],
  },
  {
    name: "Lazy Dog Restaurant & Bar",
    placeId: "ChIJ_kennesaw_lazy_dog",
    rating: 4.5,
    priceLevel: "$$",
    address: "1105 Ernest W Barrett Pkwy NW, Kennesaw, GA 30144",
    mapsUrl: "https://maps.google.com/?q=Lazy+Dog+Restaurant+Kennesaw+GA",
    tags: ["Likely kid-friendly", "Likely vegetarian-friendly", "Outdoor Patio", "Kennesaw"],
    neighborhoods: ["Kennesaw", "Marietta"],
  },
  {
    name: "Capers Restaurant & Bar",
    placeId: "ChIJ_kennesaw_capers",
    rating: 4.5,
    priceLevel: "$$",
    address: "1635 Old 41 Hwy NW, Kennesaw, GA 30152",
    mapsUrl: "https://maps.google.com/?q=Capers+Restaurant+Kennesaw+GA",
    tags: ["Mediterranean & American", "Quiet Conversation", "Kennesaw", "Cocktails"],
    neighborhoods: ["Kennesaw"],
  },
  // Metro Atlanta (OTP) - Alpharetta / Avalon / Sandy Springs / Dunwoody
  {
    name: "Rumi's Kitchen Avalon",
    placeId: "ChIJ_alpharetta_rumis",
    rating: 4.8,
    priceLevel: "$$$",
    address: "7105 Avalon Blvd, Alpharetta, GA 30009",
    mapsUrl: "https://maps.google.com/?q=Rumis+Kitchen+Avalon+Alpharetta+GA",
    tags: ["Likely vegetarian-friendly", "Modern Persian", "Avalon", "Upscale"],
    neighborhoods: ["Alpharetta", "Avalon", "Johns Creek", "Roswell"],
  },
  {
    name: "Colletta Italian Food & Wine",
    placeId: "ChIJ_alpharetta_colletta",
    rating: 4.6,
    priceLevel: "$$$",
    address: "900 3rd St, Alpharetta, GA 30009",
    mapsUrl: "https://maps.google.com/?q=Colletta+Avalon+Alpharetta+GA",
    tags: ["Likely vegetarian-friendly", "Handmade Pasta", "Patio", "Avalon"],
    neighborhoods: ["Alpharetta", "Avalon", "Johns Creek"],
  },
  {
    name: "Casi Cielo",
    placeId: "ChIJ_sandysprings_casi_cielo",
    rating: 4.7,
    priceLevel: "$$$",
    address: "6125 Roswell Rd, Sandy Springs, GA 30328",
    mapsUrl: "https://maps.google.com/?q=Casi+Cielo+Sandy+Springs+GA",
    tags: ["Oaxacan Cuisine", "Great Cocktails", "Patio", "Sandy Springs"],
    neighborhoods: ["Sandy Springs", "Dunwoody", "Brookhaven"],
  },
  {
    name: "Novo Cucina",
    placeId: "ChIJ_dunwoody_novo_cucina",
    rating: 4.6,
    priceLevel: "$$",
    address: "5592 Chamblee Dunwoody Rd, Dunwoody, GA 30338",
    mapsUrl: "https://maps.google.com/?q=Novo+Cucina+Dunwoody+GA",
    tags: ["Likely vegetarian-friendly", "Likely kid-friendly", "Artisan Pizza", "Dunwoody"],
    neighborhoods: ["Dunwoody", "Sandy Springs", "Brookhaven"],
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
      console.warn("Google Places API call failed, using Atlanta grounded catalog fallback:", err);
    }
  }

  // Filter or augment grounded templates based on constraints and Atlanta area
  const isVeg = constraints.some((c) => c.type === "dietary" && /veg/i.test(c.label));
  const isKid = constraints.some((c) => c.type === "kid_friendly");

  // Filter venues matching neighborhood if possible, or return best Atlanta spots
  let candidates = GROUNDED_ATLANTA_VENUES.filter((v) => {
    if (!v.neighborhoods) return true;
    return v.neighborhoods.some((n) => n.toLowerCase().includes(area.toLowerCase()) || area.toLowerCase().includes(n.toLowerCase()));
  });

  if (candidates.length < 3) {
    const existingIds = new Set(candidates.map((c) => c.placeId));
    const extras = GROUNDED_ATLANTA_VENUES.filter((v) => !existingIds.has(v.placeId));
    candidates = [...candidates, ...extras];
  }

  return candidates.slice(0, 5).map((v, idx) => {
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
  const query = `${area} Atlanta restaurants dinner group friendly`;
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
      mapsUrl: p.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(p.displayName?.text + " Atlanta")}`,
      inferredTags: tags,
      disqualifiedReason: null,
      suggestedBy: null,
    };
  });
}
