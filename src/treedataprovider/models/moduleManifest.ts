export interface Manifest {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  website?: string;
  license?:
    | 'GPL-2'
    | 'GPL-2 or any later version'
    | 'GPL-3'
    | 'GPL-3 or any later version'
    | 'AGPL-3'
    | 'LGPL-3'
    | 'Other OSI approved licence'
    | 'OEEL-1'
    | 'OPL-1'
    | 'Other proprietary';
  category?: 'Uncategorized' | string;
  depends?: string[];
  data?: string[];
  demo?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  auto_install?: boolean | string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  external_dependencies: Map<string, string[]>;
  application: boolean;
  assets: Map<string, [string]>;
  installable: boolean;
  maintainer: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  pre_init_hook: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  post_init_hook: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  uninstall_hook: string;
}
