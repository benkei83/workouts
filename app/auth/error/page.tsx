export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm text-center flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">
          {error ?? "An unexpected error occurred. Please try again."}
        </p>
        <a href="/auth/sign-up" className="underline underline-offset-4 text-sm">
          Back to sign up
        </a>
      </div>
    </div>
  );
}
