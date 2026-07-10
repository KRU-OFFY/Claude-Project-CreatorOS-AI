import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLiveInvite, normalizeEmail } from "@/lib/team";
import { acceptInvite } from "./actions";

// Public route: renders the invite details, requires sign-in with the invited
// email, and offers an accept button. Server-only fetch bypasses RLS via the
// admin client because the token IS the secret — anyone with the token can
// see who it was for and which workspace it's for.
export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) redirect("/setup");

  const invite = await fetchLiveInvite(admin, token);

  const supabase = await createClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-sm font-bold text-white">
            C
          </div>
          <div>
            <h1 className="text-lg font-bold">คำเชิญเข้าร่วมทีม</h1>
            <p className="text-xs text-black/50">CreatorOS AI</p>
          </div>
        </div>

        {!invite ? (
          <Invalid />
        ) : !user ? (
          <NotSignedIn email={invite.email} />
        ) : normalizeEmail(user.email ?? "") !== normalizeEmail(invite.email) ? (
          <WrongEmail expected={invite.email} actual={user.email ?? ""} />
        ) : (
          <ReadyToAccept
            token={token}
            role={invite.role}
            email={invite.email}
          />
        )}
      </div>
    </main>
  );
}

function Invalid() {
  return (
    <div>
      <p className="text-sm">คำเชิญนี้ใช้งานไม่ได้ (หมดอายุ / ถูกยกเลิก / รับไปแล้ว)</p>
      <Link href="/login" className="mt-4 inline-block text-xs text-brand underline">
        กลับหน้าเข้าสู่ระบบ
      </Link>
    </div>
  );
}

function NotSignedIn({ email }: { email: string }) {
  return (
    <div>
      <p className="text-sm">
        คุณได้รับเชิญเข้าร่วมทีมด้วยอีเมล{" "}
        <span className="font-semibold">{email}</span>
      </p>
      <p className="mt-2 text-xs text-black/60">
        กรุณาเข้าสู่ระบบด้วยอีเมลนี้เพื่อยอมรับคำเชิญ
      </p>
      <Link
        href="/login"
        className="mt-4 inline-block rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white"
      >
        เข้าสู่ระบบ
      </Link>
    </div>
  );
}

function WrongEmail({ expected, actual }: { expected: string; actual: string }) {
  return (
    <div>
      <p className="text-sm text-red-600">
        คำเชิญนี้ออกให้กับ <b>{expected}</b> แต่คุณเข้าสู่ระบบด้วย <b>{actual}</b>
      </p>
      <p className="mt-2 text-xs text-black/60">
        กรุณาออกจากระบบแล้วเข้าสู่ระบบด้วยอีเมลที่ถูกเชิญ
      </p>
      <form action="/api/auth/signout" method="post" className="mt-4">
        <button className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-black/5">
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}

function ReadyToAccept({
  token,
  role,
  email,
}: {
  token: string;
  role: string;
  email: string;
}) {
  return (
    <div>
      <p className="text-sm">
        คุณ (<b>{email}</b>) ได้รับเชิญให้เข้าร่วมในบทบาท{" "}
        <span className="rounded bg-black/5 px-1.5 py-0.5 text-xs font-semibold">
          {role}
        </span>
      </p>
      <form action={acceptInvite} className="mt-4">
        <input type="hidden" name="token" value={token} />
        <button className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-white">
          ยอมรับคำเชิญและเข้าร่วมทีม
        </button>
      </form>
    </div>
  );
}
