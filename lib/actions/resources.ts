"use server";

import { requireRegisteredUser } from "@/lib/auth-utils";
import { getDb } from "@/lib/db/queries";
import {
  insertResourceSchema,
  type NewResourceParams,
  resources,
} from "@/lib/db/schema/resources";
import { generateEmbeddings } from "../ai/embedding";
import { embeddings as embeddingsTable } from "../db/schema/embeddings";

export const createResource = async (input: NewResourceParams) => {
  try {
    await requireRegisteredUser();

    const { content } = insertResourceSchema.parse(input);

    const [resource] = await getDb()
      .insert(resources)
      .values({ content })
      .returning();

    const embeddings = await generateEmbeddings(content);
    await getDb()
      .insert(embeddingsTable)
      .values(
        embeddings.map((embedding) => ({
          resourceId: resource.id,
          ...embedding,
        })),
      );

    return "Resource successfully created and embedded.";
  } catch (e) {
    if (e instanceof Error)
      return e.message.length > 0 ? e.message : "Error, please try again.";
  }
};
