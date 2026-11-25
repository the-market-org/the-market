import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanFragment, isSafeUrl, scopeHtmxRequests, stripActiveContent } from "./fragment-sanitizer.ts";

const CASES: Array<[string, string]> = [
  ["<scr<script>x</script>ipt>alert(1)</script>", "xipt&gt;alert(1)"],
  ["<img src=x onerror=alert(1)>", "<img>"],
  ['<img\nsrc="https://cdn.example/a.png"\tonerror\n="alert(1)">', '<img src="https://cdn.example/a.png">'],
  ['<a href="&#106;avascript:alert(1)">go</a>', "<a>go</a>"],
  ['<a href=" javascript:alert(1)">go</a>', "<a>go</a>"],
  ['<a href="//evil.example/x">go</a>', "<a>go</a>"],
  ['<a href="/products/rope-lead" title="Lead">lead</a>', '<a href="/products/rope-lead" title="Lead">lead</a>'],
  ["<svg><animate onbegin=alert(1) attributeName=x></animate></svg>ok", "ok"],
  ['<p style="background:url(x)" class="stars">4.6</p>', '<p class="stars">4.6</p>'],
  ['<!-- note --><div><iframe src="https://x.example"></iframe>text</div>', "<div>text</div>"],
  ['<form action="https://evil.example"><input name=card></form>after', "after"],
  ['<math><mi xlink:href="javascript:alert(1)">x</mi></math>', ""],
  ["<p>Café &amp; <em>tea</em> &lt;3</p>", "<p>Café &amp; <em>tea</em> &lt;3</p>"],
  ['<button hx-get="/apps/reviews/list" hx-post="/apps/reviews/x" hx-on:click="alert(1)">More</button>', '<button hx-get="/apps/reviews/list">More</button>'],
];

test("known bypasses come out harmless, and ordinary markup and text are kept", () => {
  for (const [html, expected] of CASES) {
    assert.equal(stripActiveContent(html), expected, html);
  }
});

test("only https addresses and paths on the store itself count as safe links", () => {
  assert.deepEqual(["https://a.example", "/cart", "//a.example", "http://a.example", "javascript:x", "data:text/html,x", "\u0001javascript:x"].map(isSafeUrl), [true, true, false, false, false, false, false]);
});

test("a cleaned fragment keeps htmx requests only under the app's own prefix", () => {
  const html = '<div hx-get="/apps/reviews/more">more</div><div hx-get="/admin/change-sets">steal</div><script>x</script>';
  assert.equal(cleanFragment({ html, appId: "reviews", stripContent: stripActiveContent, scopeRequests: scopeHtmxRequests }), '<div hx-get="/apps/reviews/more">more</div><div>steal</div>');
});
