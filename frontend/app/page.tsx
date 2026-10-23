import type { Metadata } from "next";
import { CodeDemo } from "./components/landing/code-demo";
import { Icon } from "./components/landing/landing-icon";
import { AccessButton, LandingInteractions } from "./components/landing/interactions";
import { Navbar } from "./components/landing/navbar";
import { Wordmark } from "./components/landing/wordmark";
import "./components/landing/landing.css";

export const metadata: Metadata = {
  title: "DECODE — Your first website starts here",
  description: "Learn HTML, CSS, and JavaScript with simple explanations, practical exercises, coding labs, and guided workshops. Your web development journey starts with DECODE.",
};

const paths = [
  { name: "HTML", title: "Structure the web", description: "Give your ideas a home. Learn to create headings, links, buttons, and the building blocks of a webpage.", color: "html", icon: "code" },
  { name: "CSS", title: "Style your ideas", description: "Make it your own. Bring your pages to life with color, typography, spacing, and responsive layouts.", color: "css", icon: "style" },
  { name: "JavaScript", title: "Make it interactive", description: "Add a little possibility. Make buttons respond, work with data, and build experiences people can use.", color: "js", icon: "interact" },
] as const;

const steps = [
  { name: "Theory", description: "Understand concepts through simple explanations.", icon: "book" },
  { name: "Quiz", description: "Test what you have learned and connect the dots.", icon: "check" },
  { name: "Lab", description: "Write and experiment with real code.", icon: "terminal" },
  { name: "Workshop", description: "Build something step by step, with guidance.", icon: "build" },
] as const;

function MarqueeRow({ text, reverse = false }: { text: string; reverse?: boolean }) {
  return (
    <div className={`decode-marquee-row${reverse ? " decode-marquee-reverse" : ""}`} aria-hidden="true">
      <div className="decode-marquee-track">
        {[0, 1].map((copy) => (
          <span className="decode-marquee-group" key={copy}><span>{text}&nbsp;</span><span className="decode-marquee-repeat">{text}&nbsp;</span></span>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <LandingInteractions>
      <a className="decode-skip" href="#main-content">Skip to content</a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <section id="home" aria-labelledby="hero-title" className="decode-container decode-hero grid items-center gap-12 lg:grid-cols-[1.08fr_1fr] lg:gap-14">
          <div>
            <p className="decode-eyebrow mb-6 flex items-center gap-3"><span className="decode-small-line" /> A little code. A world of possibility.</p>
            <h1 id="hero-title" className="decode-hero-title">Your first website starts here<span className="text-action">.</span></h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-secondary">Learn HTML, CSS, and JavaScript through simple explanations and practical exercises. Go from your first line of code to something you can call your own.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <AccessButton className="decode-button decode-button-primary">Get Started <Icon name="arrow" /></AccessButton>
              <a className="decode-button decode-button-secondary" href="#skills">Explore Skills <Icon name="down" className="decode-arrow-down size-4" /></a>
            </div>
            <p className="mt-6 flex items-center gap-2 text-sm text-secondary"><Icon name="check" className="size-4 shrink-0" /> No experience needed. Just curiosity.</p>
          </div>
          <CodeDemo />
        </section>

        <section id="skills" aria-labelledby="skills-title" className="decode-container decode-section">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div><p className="decode-eyebrow mb-3">YOUR BUILDING BLOCKS</p><h2 id="skills-title" className="decode-section-title">Start with the essentials.</h2></div>
            <p className="max-w-64 text-sm leading-relaxed text-secondary">Three languages. Endless ways to bring your ideas to life.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {paths.map((path, index) => (
              <article className={`decode-path decode-path-${path.color} flex flex-col rounded-xl bg-white p-6 lg:p-8`} key={path.name}>
                <div className="mb-6 flex items-center justify-between"><span className="decode-subject-icon"><Icon name={path.icon} className="size-7" /></span><span className="font-mono text-xs text-secondary">0{index + 1}</span></div>
                <p className="mb-2 font-mono text-sm font-medium">{path.name}</p>
                <h3 className="text-xl font-semibold tracking-tight">{path.title}</h3>
                <p className="mt-3 mb-6 text-sm leading-7 text-secondary">{path.description}</p>
                <AccessButton intent={path.name} className="decode-path-link mt-auto inline-flex min-h-11 items-center justify-between gap-4 text-sm font-semibold">Explore {path.name}<Icon name="arrow" /></AccessButton>
              </article>
            ))}
          </div>
        </section>

        <section className="decode-marquee" aria-label="Learn, understand, practice. Build, test, improve, repeat.">
          <MarqueeRow text="LEARN · UNDERSTAND · PRACTICE ·" />
          <MarqueeRow text="BUILD · TEST · IMPROVE · REPEAT ·" reverse />
        </section>

        <section aria-labelledby="journey-title" className="decode-container decode-section decode-journey-section">
          <div className="mb-8 md:mb-10"><p className="decode-eyebrow mb-3">THE DECODE WAY</p><h2 id="journey-title" className="decode-section-title">From learning to building.</h2><p className="mt-4 text-secondary">A practical learning journey, one step at a time.</p></div>
          <ol className="decode-journey grid gap-8 md:grid-cols-4 md:gap-6">
            {steps.map((step, index) => (
              <li key={step.name} className="decode-step relative flex gap-5 md:block">
                <div className="decode-step-icon relative mb-0 flex size-12 shrink-0 items-center justify-center rounded-xl border border-border md:mb-4"><Icon name={step.icon} className="size-5" /></div>
                <div><p className="mb-2 font-mono text-xs text-secondary">STEP 0{index + 1}</p><h3 className="text-lg font-semibold">{step.name}</h3><p className="mt-2 max-w-56 text-sm leading-7 text-secondary">{step.description}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section id="our-goal" aria-labelledby="goal-title" className="decode-container decode-section decode-goal-section">
          <div className="decode-goal grid gap-8 border-t border-border pt-12 md:grid-cols-2 md:gap-16 md:pt-14">
            <div><p className="decode-eyebrow mb-5">OUR GOAL</p><h2 id="goal-title" className="decode-section-title max-w-sm">Everyone starts somewhere.</h2></div>
            <div className="md:pt-10"><p className="text-lg leading-8 text-secondary">Learning to code shouldn&apos;t feel overwhelming. DECODE helps beginners understand web development through simple explanations, hands-on practice, and guided projects.</p><p className="mt-6 text-base font-medium">Start with the basics. Build with confidence.</p></div>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="decode-final-cta text-center">
          <div className="decode-container"><span className="decode-cta-mark" aria-hidden="true">&lt;/&gt;</span><h2 id="cta-title" className="decode-section-title mx-auto max-w-xl">Ready to build your first website?</h2><p className="mx-auto mt-4 max-w-md leading-7 text-secondary">Start with the basics and grow your skills, one lesson at a time.</p><AccessButton className="decode-button decode-button-primary mt-6">Get Started <Icon name="arrow" /></AccessButton></div>
        </section>
      </main>
      <footer className="decode-container py-10">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <div className="min-w-0">
            <a className="decode-logo-link inline-flex" href="#home" aria-label="DECODE home">
              <Wordmark animated={false} />
            </a>
            <p className="mt-4 max-w-xs text-sm leading-6 text-secondary">
              A better place to begin your coding journey.
            </p>
            <p className="mt-3 font-mono text-xs font-medium text-action">Learn. Practice. Build.</p>
          </div>
          <nav aria-label="Footer" className="grid min-w-0 grid-cols-2 gap-6 sm:gap-8">
            <div>
              <h2 className="text-sm font-semibold">Explore</h2>
              <ul className="mt-2 text-sm text-secondary">
                <li><a className="decode-nav-link" href="#home">Home</a></li>
                <li><a className="decode-nav-link" href="#skills">Skills</a></li>
                <li><a className="decode-nav-link" href="#our-goal">Our Goal</a></li>
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Get Started</h2>
              <ul className="mt-2 text-sm text-secondary">
                {paths.map((path) => (
                  <li key={path.name}>
                    <AccessButton intent={path.name} className="decode-nav-link text-left">
                      Learn {path.name}
                    </AccessButton>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-8 flex flex-col justify-between gap-3 border-t border-border pt-5 text-xs text-secondary sm:flex-row sm:items-center">
          <p>© 2026 DECODE. All rights reserved.</p>
          <p>Made for curious minds.</p>
        </div>
      </footer>
    </LandingInteractions>
  );
}
