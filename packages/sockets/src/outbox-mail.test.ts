import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOutboxMail } from "./outbox-mail.ts";

test("sent mail is kept per tenant, in order, with one log line each", async () => {
  const lines: string[] = [];
  const mail = buildOutboxMail({ writeLine: (line) => lines.push(line) });

  await mail.sendMail({ tenantId: "tenant-a", toAddress: "ruth@example.com", subject: "Order 1", textBody: "Thanks" });
  await mail.sendMail({ tenantId: "tenant-a", toAddress: "sam@example.com", subject: "Order 2", textBody: "Thanks" });

  assert.deepEqual(mail.listSent({ tenantId: "tenant-a" }).map((sent) => sent.subject), ["Order 1", "Order 2"]);
  assert.deepEqual(mail.listSent({ tenantId: "tenant-b" }), []);
  assert.deepEqual(lines, ["Mail to ruth@example.com: Order 1", "Mail to sam@example.com: Order 2"]);
});

test("an address without exactly one @ and text on both sides is refused", async () => {
  const mail = buildOutboxMail({ writeLine: () => {} });
  for (const toAddress of ["nobody", "a@b@c", "@example.com", "ruth@"]) {
    await assert.rejects(mail.sendMail({ tenantId: "tenant-a", toAddress, subject: "S", textBody: "B" }), { message: "Invalid mail address" }, toAddress);
  }
  assert.deepEqual(mail.listSent({ tenantId: "tenant-a" }), []);
});
