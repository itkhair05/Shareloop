import type { CategoryDistributionItem, ReportDistributionItem } from '@/types/reporting';
import type { DistributionBarItem } from '../components/DistributionBars';
import type { DonutChartItem } from '../components/DonutChart';
import { getDistributionColor, getDistributionLabel } from './reporting-labels';

export function buildDistributionBars(
  items: ReportDistributionItem[],
  domain: string
): DistributionBarItem[] {
  return items.map((item, index) => ({
    key: item.key,
    label: getDistributionLabel(domain, item.key),
    value: item.value,
    color: getDistributionColor(item.key, index),
  }));
}

export function buildDistributionDonut(
  items: ReportDistributionItem[],
  domain: string
): DonutChartItem[] {
  return items.map((item, index) => ({
    key: item.key,
    label: getDistributionLabel(domain, item.key),
    value: item.value,
    color: getDistributionColor(item.key, index),
  }));
}

export function buildCategoryBars(items: CategoryDistributionItem[]): DistributionBarItem[] {
  return items.map((item, index) => ({
    key: item.categoryId,
    label: item.categoryName,
    value: item.value,
    color: getDistributionColor(item.categoryId, index),
  }));
}

export function getDistributionValue(
  items: ReportDistributionItem[],
  key: string
): number {
  return items.find((item) => item.key === key)?.value ?? 0;
}

export function buildRatingBars(
  items: ReportDistributionItem[],
  variant: 'ALL' | 'VISIBLE'
): DistributionBarItem[] {
  return items.map((item, index) => ({
    key: `${variant}-${item.key}`,
    label: `${item.key} sao`,
    value: item.value,
    color: getDistributionColor(item.key, index),
  }));
}
