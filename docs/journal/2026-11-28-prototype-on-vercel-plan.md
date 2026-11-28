# Session log entry — 2026-11-28, the prototype on Vercel: plan

- **What happened:** the owner decided the prototype is for testing only, on Vercel's free plan with `vercel.app` addresses only, and asked for the missing pieces to be planned.
- **Checked before planning:**
  - Vercel's docs: 300 seconds per request; domains can be added to a project by API; nothing on free `vercel.app` names.
  - The tenant app: event delivery isn't awaited, and has a 5-second post timeout.
  - Supabase Auth: `/otp` and `/verify` for sign-in by emailed code.
- **Key changes:** `docs/plans/2026-11-28-prototype-on-vercel.md`, the tenant app's part and the order across the three repositories. The publisher's and agent's parts are planned in their own private repositories.
- **Artifacts:**
  - [D] Merchants sign in with a code Supabase emails, verified server-side, so no browser script is needed — invalidates if Supabase's code sign-in is unavailable for invited users [high] [2026-11-28]
  - [E] Event delivery isn't awaited, so on Vercel an event can be lost when the function ends after its reply. fix: task 3 hands delivery to Vercel's after-the-reply mechanism [high] [2026-11-28]
- **Next steps:** the owner reviews the three plans. Task 1 needs the owner to create the tenant app's Vercel project.
