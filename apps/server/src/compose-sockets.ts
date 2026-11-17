/** Composition of the sockets: picks each implementation from the environment. */
import { buildFolderStorage, buildMemoryStorage, buildOutboxMail, buildOwnerAuthoriser, buildTokenIdentity } from "@the-market/sockets";
import type { AppAuthoriser, FileStorage, FolderFiles, IdentitySocket, MailSender } from "@the-market/sockets";

export interface Sockets {
  identity: IdentitySocket;
  /** True when IDENTITY_SECRET is set; without it every token is refused. */
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
}): Sockets {
  const identitySecret = input.environment.IDENTITY_SECRET ?? "";
  const filesFolder = input.environment.FILES_FOLDER ?? "";
  return {
    identity: buildTokenIdentity({ secret: identitySecret, readNow: input.readNow }),
    identityEnabled: identitySecret !== "",
    storage: filesFolder === "" ? buildMemoryStorage() : buildFolderStorage({ rootFolder: filesFolder, files: input.files }),
    mail: buildOutboxMail({ writeLine: input.writeLine }),
    authoriser: buildOwnerAuthoriser(),
  };
}
