export function MaintenanceMessage() {
  return (
    <section
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-6 py-16 text-slate-100"
      style={{ backgroundImage: "url('/evernight.gif')" }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/75 to-slate-950/90" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.35),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-[10%] h-[420px] w-[420px] rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-120px] right-[5%] h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/15 px-4 py-1 text-sm font-medium uppercase tracking-[0.2em] text-white/80">
          <span className="font-bold">SuicaoDex đang bảo trì</span>
        </div>

        {/* <div className="space-y-6">
          <h1 className="text-balance text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Chúng tôi đang tinh chỉnh trải nghiệm tốt hơn cho bạn
          </h1>
          <p className="text-pretty text-base/relaxed text-slate-200 sm:text-lg">
            Hệ thống SuicaoDex đang được nâng cấp trong thời gian ngắn. Trong lúc này
            chúng tôi tạm thời đóng quyền truy cập để đảm bảo mọi thứ diễn ra an toàn
            và ổn định. Cảm ơn bạn đã kiên nhẫn chờ đợi!
          </p>
        </div> */}

        <div className="flex w-full flex-col items-center justify-center gap-4 rounded-3xl border border-white/10 bg-white/15 p-6 text-left sm:flex-row sm:text-center">
          {/* <RefreshCcw className="h-10 w-10 flex-none text-sky-300" aria-hidden /> */}
          <div className="space-y-1">
            <p className="text-lg font-semibold uppercase tracking-wide text-white/80">
              Thời gian dự kiến
            </p>
            <p className="text-pretty text-base text-slate-100">
              Đếch biết, tùy theo độ ngu của tôi 👍
            </p>
          </div>
        </div>

        {/* <div className="flex flex-col items-center gap-3 text-sm text-slate-300 sm:flex-row">
          <span className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-200" aria-hidden />
            <Link
              href="mailto:support@suicaodex.com"
              className="font-medium text-white transition hover:text-sky-300"
            >
              support@suicaodex.com
            </Link>
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-slate-400 sm:block" aria-hidden />
          <span>Chúng tôi sẽ phản hồi sớm nhất có thể.</span>
        </div> */}
      </div>
    </section>
  );
}
