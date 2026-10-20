export function Footer() {
  // Exempt: a copyright year is not a moment anything is measured against.
  // Nothing on the page agrees or disagrees with it, so there is no render-top
  // it needs to be handed down from.
  // eslint-disable-next-line no-restricted-syntax
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-200 bg-white px-6 py-3 text-center text-xs text-gray-500 shrink-0">
      © {year} City Government of Lucena
    </footer>
  );
}
