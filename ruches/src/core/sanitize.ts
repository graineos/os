/**
 * Nettoyage du HTML des documents Plume avant affichage.
 * Une capsule importée peut venir de quelqu'un d'autre : on ne garde que la mise en forme
 * (aucun script, aucun attribut d'événement, aucun style, liens http/https/mailto uniquement).
 */
const ALLOWED = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "A", "CODE", "PRE", "HR", "DIV", "SPAN", "SUB", "SUP", "MARK"]);
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "SVG", "MATH", "NOSCRIPT", "LINK", "META", "TITLE", "HEAD"]);

export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as Element;
      if (DROP_WITH_CONTENT.has(el.tagName)) {
        el.remove();
        continue;
      }
      walk(el);
      if (!ALLOWED.has(el.tagName)) {
        el.replaceWith(...Array.from(el.childNodes));
        continue;
      }
      const href = el.tagName === "A" ? el.getAttribute("href") ?? "" : "";
      for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
      if (el.tagName === "A" && /^(https?:|mailto:)/i.test(href.trim())) {
        el.setAttribute("href", href.trim());
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer nofollow");
      }
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}
