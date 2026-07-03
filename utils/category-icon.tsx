/**
 * Maps a stored icon name (string from the DB) to a lucide icon component.
 * Categories store their icon as a name like "ShoppingCart"; this resolves it.
 * Unknown names fall back to a neutral Tag icon.
 */

import {
  Car,
  HeartPulse,
  House,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";

const ICONS: Record<string, LucideIcon> = {
  ShoppingCart,
  House,
  Car,
  ShoppingBag,
  Receipt,
  HeartPulse,
  Wallet,
  Tag,
};

export function categoryIcon(name: string | null): LucideIcon {
  if (name && ICONS[name]) return ICONS[name];
  return Tag;
}
