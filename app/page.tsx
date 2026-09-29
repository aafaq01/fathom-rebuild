// ponytail: placeholder until box 5 (meetings list + search) replaces it
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">Fathom rebuild</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        An AI meeting notetaker built for the long, crowded call. Seeded meetings are on the way.
      </p>
    </main>
  );
}
