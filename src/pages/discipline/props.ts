import type { PageKey } from '@/lib/nav';
import type { Role } from '@/lib/discipline/types';

export type NavFn = (page: PageKey, param?: Record<string, string>) => void;

export type PageProps = {
  role: Role;
  onNavigate: NavFn;
  param?: Record<string, string>;
};
