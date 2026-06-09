import { render } from "@react-email/components";
import { Resend } from "resend";
import { keys } from "./keys";
import { InviteTemplate } from "./templates/invite";

export const resend = new Resend(keys().RESEND_TOKEN);

export { ContactTemplate } from "./templates/contact";
export { InviteTemplate } from "./templates/invite";

type RenderInviteOptions = {
  inviteeName?: string;
  inviterName?: string;
  workspaceName: string;
  acceptUrl: string;
  expiresInDays?: number;
};

export async function renderInviteEmail(
  options: RenderInviteOptions
): Promise<string> {
  return render(
    InviteTemplate({
      inviteeName: options.inviteeName,
      inviterName: options.inviterName,
      workspaceName: options.workspaceName,
      acceptUrl: options.acceptUrl,
      expiresInDays: options.expiresInDays ?? 7,
    })
  );
}
