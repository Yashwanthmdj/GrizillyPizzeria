export function itemSlug(name: string, id: string) {
  const base = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || id;
}

export function findBySlug<T extends { id: string; name: string }>(items: T[], slug: string) {
  return (
    items.find((item) => itemSlug(item.name, item.id) === slug) ??
    items.find((item) => item.id === slug)
  );
}
