/**
 * Category Types matching backend models
 */

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  parentId?: string | null;
  displayOrder: number;
  active: boolean;
}

export interface CategoryDetail extends Category {
  activeListingCount: number;
}
