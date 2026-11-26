/** Composition of the sockets: picks each implementation from the environment. */
import { buildFolderStorage, buildKeySetIdentity, buildMemoryStorage, buildOutboxMail, buildOwnerAuthoriser, buildTokenIdentity } from "@the-market/sockets";
import type { AppAuthoriser, FileStorage, FolderFiles, IdentitySocket, MailSender } from "@the-market/sockets";

export interface Sockets {
  identity: IdentitySocket;
  /** True when IDENTITY_SECRET or IDENTITY_KEYS_URL is set; without either every token is refused. */
  identityEnabled: boolean;
  storage: FileStorage;
  mail: MailSender;
  authoriser: AppAuthoriser;
}

export function composeSockets(input: {
  environment: Record<string, string | undefined>;
  readNow: () => number;
  writeLine: (line: string) => void;
  files: FolderFiles;
  /** Reads a JSON document, for the published key set at IDENTITY_KEYS_URL. */
  loadJson: (url: string) => Promise<unknown>;
}): Sockets {
  const identitySecret = input.environment.IDENTITY_SECRET ?? "";
  const keysUrl = input.environment.IDENTITY_KEYS_URL ?? "";
  const filesFolder = input.environment.FILES_FOLDER ?? "";
  const secretIdentity = buildTokenIdentity({ secret: identitySecret, readNow: input.readNow });
  return {
    identity: keysUrl === "" ? secretIdentity : buildKeySetIdentity({ keysUrl, loadJson: input.loadJson, fallback: secretIdentity, readNow: input.readNow }),
    identityEnabled: identitySecret !== "" || keysUrl !== "",
    storage: filesFolder === "" ? buildMemoryStorage() : buildFolderStorage({ rootFolder: filesFolder, files: input.files }),
    mail: buildOutboxMail({ writeLine: input.writeLine }),
    authoriser: buildOwnerAuthoriser(),
  };
}
