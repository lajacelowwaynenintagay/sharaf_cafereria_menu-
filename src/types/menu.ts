export type MenuLanguage = "en" | "de" | "fr" | "ar";

export type LocalizedText = Record<MenuLanguage, string>;

export type MenuSettings = {
  restaurant_name: string;
  currency: string;
  default_language: MenuLanguage;
  theme_auto: boolean;
};

export type MenuCategory = {
  id: string;
  icon: string;
  name: LocalizedText;
};

export type MenuIngredient = {
  n: LocalizedText;
  c: string;
};

export type MenuItem = {
  id: string;
  category: string;
  subgroup?: string;
  price: number;
  price_label?: string;
  calories?: string;
  type: "veg" | "non-veg";
  is_4d: boolean;
  title: LocalizedText;
  description?: LocalizedText;
  ingredients: MenuIngredient[];
  formatted_price: string;
  image?: string;
};

export type MenuData = {
  settings: MenuSettings;
  categories: MenuCategory[];
  items: MenuItem[];
};

export type MenuStatusEntry = {
  stock?: "available" | "few" | "out";
  price?: number;
  offer?: number;
  badges?: string[];
};

export type MenuStatusMap = Record<string, MenuStatusEntry>;

export type CartItem = {
  id: string;
  title: string;
  price: number;
  qty: number;
  category: string;
};
