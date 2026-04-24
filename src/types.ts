// Shared types untuk seluruh Worker.

export type Category =
  | "Appetizer"
  | "MainCourse"
  | "SideDish"
  | "Dessert"
  | "Beverage"
  | "Snack"
  | "Soup"
  | "Sambal";

export type RecipeStatus = "draft" | "generated" | "published";

export interface Bindings {
  DB: D1Database;
  IMAGES: KVNamespace;
  // vars (R2_PUBLIC_BASE dihapus)
  AI_POOL_URL: string;
  RECIPES_SYNC_URL: string;
  // secrets
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  ACCOUNT_POOL_JSON: string;
}

export interface RecipeRow {
  id: string;
  title: string;
  category: Category;
  description: string;
  difficulty: string;
  cooking_time_minutes: number;
  servings: number;
  tags_csv: string;
  image_key: string | null;
  status: RecipeStatus;
  generated_at: number | null;
  image_generated_at: number | null;
  published_at: number | null;
  updated_at: number;
  report_count: number;
}

export type ReportReason = "inaccurate" | "offensive" | "dangerous" | "other";

export interface RecipeReportRow {
  id: string;
  recipe_id: string;
  reason: ReportReason;
  detail: string;
  client_ip: string | null;
  created_at: number;
}

export interface IngredientRow {
  recipe_id: string;
  position: number;
  name: string;
  quantity: string;
  unit: string;
}

export interface StepRow {
  recipe_id: string;
  step_order: number;
  instruction: string;
}

export interface RecipeFull {
  recipe: RecipeRow;
  ingredients: IngredientRow[];
  steps: StepRow[];
  imageUrl: string | null;
}

export interface GeneratedRecipeContent {
  description: string;
  difficulty: string;
  cookingTimeMinutes: number;
  servings: number;
  ingredients: { name: string; quantity: string; unit: string }[];
  steps: { order: number; instruction: string }[];
  tags: string[];
}

export interface GeneratedImageBytes {
  bytes: ArrayBuffer;
  extension: "png" | "jpg" | "webp";
  contentType: string;
}

export type RequestStatus = "processing" | "completed" | "failed";

export interface GenerationRequestRow {
  id: string;
  query: string;
  slug_target: string;
  status: RequestStatus;
  client_ip: string | null;
  requested_at: number;
  completed_at: number | null;
  error_message: string | null;
  resulting_recipe_id: string | null;
}
