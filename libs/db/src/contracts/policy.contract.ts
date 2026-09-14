export interface PolicyItemEntity {
  id: string;
  title: string;
  // Rich HTML authored via the CMS's Tiptap editor - sanitized server-side (see
  // libs/api-core/src/schemas/policy.schema.ts) before it ever reaches this layer, since it's
  // rendered as raw HTML on the public policies page.
  content: string;
  // Display order within its parent category (ascending, ties broken by createdAt) - mirrors
  // StaffEntity.order's own precedent for admin-controlled ordering independent of creation order.
  order: number;
}

export interface PolicyCategoryEntity {
  id: string;
  title: string;
  // Plain string at this layer (kept UI-framework-agnostic, same reasoning as
  // PageNavigationConfig.icon in page.contract.ts) - the frontend casts it to Phosphor's IconName
  // when rendering.
  icon?: string;
  order: number;
  items: PolicyItemEntity[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreatePolicyCategoryInput = { title: string; icon?: string; order?: number };
export type UpdatePolicyCategoryInput = Partial<CreatePolicyCategoryInput>;

export type CreatePolicyItemInput = { title: string; content: string; order?: number };
export type UpdatePolicyItemInput = Partial<CreatePolicyItemInput>;

export interface PolicyRepository {
  // No pagination/search - a studio's set of policy categories is small and curated, the same
  // "small enumerable set" shape as TimeEntryTypeRepository.findAll, unlike Staff/Gallery's
  // paginated findMany.
  findAll: () => Promise<PolicyCategoryEntity[]>;
  findCategoryById: (id: string) => Promise<PolicyCategoryEntity | null>;
  createCategory: (input: CreatePolicyCategoryInput) => Promise<PolicyCategoryEntity>;
  updateCategory: (id: string, input: UpdatePolicyCategoryInput) => Promise<PolicyCategoryEntity | null>;
  // Cascades - deletes the whole category document, items included.
  deleteCategory: (id: string) => Promise<boolean>;
  // Item mutations return the updated parent category (or null if the category/item wasn't
  // found) rather than the bare item, since items only ever exist embedded in a category.
  createItem: (categoryId: string, input: CreatePolicyItemInput) => Promise<PolicyCategoryEntity | null>;
  updateItem: (categoryId: string, itemId: string, input: UpdatePolicyItemInput) => Promise<PolicyCategoryEntity | null>;
  deleteItem: (categoryId: string, itemId: string) => Promise<PolicyCategoryEntity | null>;
}
