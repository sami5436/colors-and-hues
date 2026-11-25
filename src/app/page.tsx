import { Board } from "@/components/board";
import { CreateRoomForm, JoinRoomForm } from "@/components/entry-forms";
import { Wordmark } from "@/components/ui";

const demoMarkers = [
  { cell: 4 * 28 + 6, label: "M" },
  { cell: 5 * 28 + 8, label: "J" },
  { cell: 3 * 28 + 7, label: "R", mine: true },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <Wordmark />
        <a href="#how" className="text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline">
          How to play
        </a>
      </header>

      <main className="flex-1">
        <section className="grid items-end gap-8 border-b border-rule pb-10 pt-6 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted">A party game for 2 to 12</p>
            <h1 className="mt-4 font-display text-[52px] leading-[0.95] tracking-tight sm:text-7xl">
              Find the color
              <br />
              <span className="italic">behind the word.</span>
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
              Describe a shade with a single word and watch your friends argue over what &ldquo;avocado&rdquo; means. Or
              flash a color, then try to rebuild it from memory. Everyone plays from their own phone.
            </p>
          </div>
          <div aria-hidden className="pointer-events-none">
            <Board compact markers={demoMarkers} target={4 * 28 + 7} />
            <div className="mt-3 flex items-baseline justify-between text-xs text-muted">
              <span>
                Clue: <span className="font-display text-base italic text-ink">&ldquo;moss&rdquo;</span>
              </span>
              <span>3 guesses placed</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 py-10 md:grid-cols-2 md:gap-6">
          <CreateRoomForm />
          <JoinRoomForm />
        </section>

        <section id="how" className="grid gap-8 border-t border-rule py-12 md:grid-cols-2 md:gap-12">
          <div>
            <h2 className="font-display text-4xl leading-none">Clue</h2>
            <ol className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-2">
              <li>
                <span className="mr-2 font-mono text-xs text-muted">01</span>Each round one player is the clue giver and
                secretly sees one square on the board.
              </li>
              <li>
                <span className="mr-2 font-mono text-xs text-muted">02</span>They give a one word clue. Everyone else
                drops a marker where they think it is.
              </li>
              <li>
                <span className="mr-2 font-mono text-xs text-muted">03</span>A second clue of up to two words follows,
                and everyone places a second marker.
              </li>
              <li>
                <span className="mr-2 font-mono text-xs text-muted">04</span>Your closer marker scores up to 5. The
                giver earns the average of the table, so clear clues pay.
              </li>
            </ol>
          </div>
          <div>
            <h2 className="font-display text-4xl leading-none">Recall</h2>
            <ol className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-2">
              <li>
                <span className="mr-2 font-mono text-xs text-muted">01</span>A color fills every screen for five
                seconds.
              </li>
              <li>
                <span className="mr-2 font-mono text-xs text-muted">02</span>It disappears. You get 35 seconds to mix it
                back with hue, saturation and lightness.
              </li>
              <li>
                <span className="mr-2 font-mono text-xs text-muted">03</span>Scores go up to 10, judged by perceptual
                distance rather than raw numbers.
              </li>
              <li>
                <span className="mr-2 font-mono text-xs text-muted">04</span>Highest total after the last round takes
                it.
              </li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="flex items-center justify-between border-t border-rule py-5 text-xs text-muted">
        <span>Colors &amp; Hues</span>
        <span>No accounts, no sign up.</span>
      </footer>
    </div>
  );
}
