import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Building, RefreshCw, Shield, Users } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const thesisPoints = [
  {
    icon: Building,
    title: 'Essential infrastructure demand',
    description: 'Electrical work is non-discretionary and recession-resistant.',
  },
  {
    icon: RefreshCw,
    title: 'Recurring maintenance revenue',
    description: 'Service contracts create predictable, long-term cash flows.',
  },
  {
    icon: Shield,
    title: 'Skilled labor moats',
    description: 'Licensed electricians are scarce—creating competitive barriers.',
  },
  {
    icon: Users,
    title: 'Consolidation opportunity',
    description: 'Fragmented market with room for strategic roll-ups.',
  },
];

const InvestmentThesis = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const headlineCardRef = useRef<HTMLDivElement>(null);
  const thesisCardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const scrollTl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=130%',
          pin: true,
          scrub: 0.5,
        },
      });

      // Phase 1 - ENTRANCE (0% - 30%)
      scrollTl.fromTo(
        imageRef.current,
        { x: '-60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0
      );

      scrollTl.fromTo(
        headlineCardRef.current,
        { x: '60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.06
      );

      thesisCardsRef.current.forEach((card, i) => {
        if (card) {
          scrollTl.fromTo(
            card,
            { y: '50vh', opacity: 0 },
            { y: 0, opacity: 1, ease: 'none' },
            0.14 + i * 0.04
          );
        }
      });

      // Phase 3 - EXIT (70% - 100%)
      scrollTl.fromTo(
        headlineCardRef.current,
        { y: 0, opacity: 1 },
        { y: '-16vh', opacity: 0, ease: 'power2.in' },
        0.70
      );

      scrollTl.fromTo(
        imageRef.current,
        { y: 0, opacity: 1 },
        { y: '10vh', opacity: 0.6, ease: 'power2.in' },
        0.70
      );

      thesisCardsRef.current.forEach((card, i) => {
        if (card) {
          scrollTl.fromTo(
            card,
            { x: 0, opacity: 1 },
            { x: '-14vw', opacity: 0, ease: 'power2.in' },
            0.72 + i * 0.02
          );
        }
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="for-investors"
      className="section-pinned bg-[#F4F2EE] z-[60]"
    >
      {/* Left Image Card */}
      <div
        ref={imageRef}
        className="absolute left-[6vw] top-[14vh] w-[30vw] h-[72vh] rounded-[34px] overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.10)]"
      >
        <img
          src="/thesis_control.jpg"
          alt="Electrical control room"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Headline Card (Dark) */}
      <div
        ref={headlineCardRef}
        className="absolute left-[38vw] top-[14vh] w-[56vw] h-[22vh] bg-[#111111] rounded-[34px] p-10 flex flex-col justify-center"
      >
        <h2 className="text-[clamp(1.75rem,3.5vw,3rem)] font-bold text-[#F4F2EE] leading-[1.05] tracking-[-0.02em]">
          Why electrical services?
        </h2>
        <p className="mt-3 text-[#6E6E6E] text-lg">
          A resilient, non-discretionary trade with strong tailwinds.
        </p>
      </div>

      {/* Thesis Cards */}
      <div className="absolute left-[38vw] top-[40vh] w-[56vw] h-[46vh] grid grid-cols-2 grid-rows-2 gap-[1.2vw]">
        {thesisPoints.map((item, i) => (
          <div
            key={item.title}
            ref={(el) => { thesisCardsRef.current[i] = el; }}
            className="bg-white rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-8 flex flex-col justify-center"
          >
            <div className="w-12 h-12 bg-[#2F6BFF]/10 rounded-xl flex items-center justify-center mb-5">
              <item.icon className="w-6 h-6 text-[#2F6BFF]" />
            </div>
            <h3 className="text-lg font-semibold text-[#111111] mb-2">
              {item.title}
            </h3>
            <p className="text-[#6E6E6E] text-sm leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InvestmentThesis;
