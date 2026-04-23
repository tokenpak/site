/*
 * Typed accessor for data/product-config.json. Every component that
 * needs install commands, package names, or CTA destinations MUST
 * import from here — never inline URL strings in components.
 */
import raw from '../../data/product-config.json';

export interface ProductConfig {
  brand_name: string;
  package_public: string;
  package_paid: string;
  github_repo: string;
  pypi_repo: string;
  private_index_url_public_label: string;
  docs_base_url: string;
  feature_flags: {
    analytics: boolean;
    show_paid_page: boolean;
    show_product_page: boolean;
  };
  cta_urls: {
    get_started: string;
    view_on_github: string;
    read_docs: string;
    explore_pro: string;
    see_latest_release: string;
    request_access: string;
  };
}

export const config: ProductConfig = raw as ProductConfig;
