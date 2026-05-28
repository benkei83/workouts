export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm text-center flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-muted-foreground">
          We sent a confirmation link to your email address. Click the link to
          activate your account.
        </p>
      </div>
    </div>
  );
}
