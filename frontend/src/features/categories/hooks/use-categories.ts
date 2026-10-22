import { useQuery } from '@tanstack/react-query';
import { categoryApi, categoryKeys } from '../api/category-api';
import type { CategoryResponse } from '@/types/category';

/**
 * Hook to retrieve active community categories
 */
export function useCategories() {
  return useQuery<CategoryResponse[]>({
    queryKey: categoryKeys.all,
    queryFn: () => categoryApi.getCategories(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export default useCategories;
