import { z } from "zod";

/** Input for creating or editing a place. Shared by the form (client) and the action (server). */
export const placeSchema = z.object({
  name: z.string().trim().min(1, "اكتب اسم المكان").max(120),
  type: z.enum(["MOSQUE", "DAR"]),
  address: z.string().trim().max(300).default(""),
});
export type PlaceInput = z.input<typeof placeSchema>;

export const updatePlaceSchema = placeSchema.extend({ id: z.uuid() });

export const placeIdSchema = z.object({ id: z.uuid() });
