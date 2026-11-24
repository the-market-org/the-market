/**
 * The tenant app's sockets: what it asks of identity, file storage, mail and app
 * authorisation. Each has a plain default in this package and a hosted one elsewhere.
 */

/** Who a verified token belongs to, and for which store. */
export interface Identity {
  subject: string;
  tenantId: string;
  role: string;
}

/** "Is this token valid, and who is it?" The tenant app never stores passwords. */
export interface IdentitySocket {
  verifyToken: (input: { token: string }) => Promise<Identity | undefined>;
}

export interface StoredFile {
  contentType: string;
  bytes: Uint8Array;
}

/** Put, get and delete a file, always inside one tenant. */
export interface FileStorage {
  putFile: (input: { tenantId: string; fileKey: string; contentType: string; bytes: Uint8Array }) => Promise<void>;
  getFile: (input: { tenantId: string; fileKey: string }) => Promise<StoredFile | undefined>;
  deleteFile: (input: { tenantId: string; fileKey: string }) => Promise<void>;
}

/** Send one message. */
export interface MailSender {
  sendMail: (input: { tenantId: string; toAddress: string; subject: string; textBody: string }) => Promise<void>;
}

export type AppDecision = "allowed" | "refused" | "pending";

/** "May this app be connected with these permissions?" Answered by the publisher, or by the store owner. */
export interface AppAuthoriser {
  decideApp: (input: { tenantId: string; appUrl: string; permissions: string[] }) => Promise<AppDecision>;
}

/** File keys are short lowercase names: no slashes, no leading dot, so never a path. */
export const FILE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
