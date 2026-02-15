import { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Target, Settings, TrendingUp } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const pillars = [
  {
    icon: Target,
    title: 'Acquire',
    description: 'We target profitable electrical contractors with strong local reputations.',
  },
  {
    icon: Settings,
    title: 'Operate',
    description: 'We preserve culture, invest in systems, and support field teams.',
  },
  {
    icon: TrendingUp,
    title: 'Grow',
    description: 'We add capabilities, expand geography, and improve margins.',
  },
];

const WhatWeDo = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const headlineCardRef = useRef<HTMLDivElement>(null);
  const pillarCardsRef = useRef<(HTMLDivElement | null)[]>([]);

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
      // Left image card
      scrollTl.fromTo(
        imageRef.current,
        { x: '-60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0
      );

      // Headline card
      scrollTl.fromTo(
        headlineCardRef.current,
        { x: '60vw', opacity: 0 },
        { x: 0, opacity: 1, ease: 'none' },
        0.05
      );

      // Pillar cards (staggered)
      pillarCardsRef.current.forEach((card, i) => {
        if (card) {
          scrollTl.fromTo(
            card,
            { y: '60vh', opacity: 0 },
            { y: 0, opacity: 1, ease: 'none' },
            0.12 + i * 0.04
          );
        }
      });

      // Phase 3 - EXIT (70% - 100%)
      scrollTl.fromTo(
        headlineCardRef.current,
        { y: 0, opacity: 1 },
        { y: '-18vh', opacity: 0, ease: 'power2.in' },
        0.70
      );

      scrollTl.fromTo(
        imageRef.current,
        { x: 0, opacity: 1 },
        { x: '-12vw', opacity: 0.6, ease: 'power2.in' },
        0.70
      );

      pillarCardsRef.current.forEach((card, i) => {
        if (card) {
          scrollTl.fromTo(
            card,
            { y: 0, opacity: 1 },
            { y: '18vh', opacity: 0, ease: 'power2.in' },
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
      id="what-we-do"
      className="section-pinned bg-[#F4F2EE] z-20"
    >
      {/* Left Image Card */}
      <div
        ref={imageRef}
        className="absolute left-[6vw] top-[14vh] w-[28vw] h-[72vh] rounded-[34px] overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.10)]"
      >
        <img
          src="/whatwedo_conduit.jpg"
          alt="Electrician installing conduit"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Headline Card */}
      <div
        ref={headlineCardRef}
        className="absolute left-[36vw] top-[14vh] w-[58vw] h-[28vh] bg-white rounded-[34px] shadow-[0_18px_60px_rgba(0,0,0,0.10)] p-10 flex flex-col justify-center"
      >
        <h2 className="text-[clamp(2rem,4vw,3.5rem)] font-bold text-[#111111] leading-[1.05] tracking-[-0.02em]">
          Acquire. Operate. Grow.
        </h2>
        <p className="mt-4 text-[#6E6E6E] text-lg">
          A disciplined approach to buying and building trades businesses.
        </p>
      </div>

      {/* Pillar Cards */}
      <div className="absolute left-[36vw] top-[46vh] w-[58vw] h-[40vh] flex gap-[1.2vw]">
        {pillars.map((pillar, i) => (
          <div
            key={pillar.title}
            ref={(el) => { pillarCardsRef.current[i] = el; }}
            className="flex-1 bg-white rounded-[28px] shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-6 flex flex-col"
          >
            <div className="w-12 h-12 bg-[#2F6BFF]/10 rounded-xl flex items-center justify-center mb-5 icon-pulse">
              <pillar.icon className="w-6 h-6 text-[#2F6BFF]" />
            </div>
            <h3 className="text-xl font-semibold text-[#111111] mb-3">
              {pillar.title}
            </h3>
            <p className="text-[#6E6E6E] text-sm leading-relaxed">
              {pillar.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default WhatWeDo;
